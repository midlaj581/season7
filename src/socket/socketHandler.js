// PPL Season 7 — socketHandler.js — upgraded
const { verifyAdminPassword, updateConfig } = require('../models/Config');
const { addPlayer, editPlayer, removePlayer, resetPlayer } = require('../models/Player');
const { saveTeam, removeTeam } = require('../models/Team');
const { verifyAdminToken } = require('../services/authService');
const { exportBackupToFile, importBackup } = require('../services/backupService');
const {
  getPublicState,
  startAuction,
  placeBid,
  undoBid,
  markSold,
  markUnsold,
  stopLiveTimer,
  resumeLiveTimer,
  revertLastSold,
  setIdle,
  resetAuctionAndTeams,
  getUndoStackDepth,
} = require('../services/auctionService');
const { validate, placeBidSchema, playerIdSchema, teamIdSchema, playerFieldsSchema, teamFieldsSchema, playerEditSchema } = require('../utils/validation');
const { logger } = require('../utils/logger');

const PLACE_BID_MAX_PER_SECOND = 5;

function createPlaceBidRateLimiter() {
  const timestamps = new Map();
  return function checkLimit(socketId) {
    const now = Date.now();
    let list = timestamps.get(socketId) || [];
    list = list.filter((ts) => now - ts < 1000);
    if (list.length >= PLACE_BID_MAX_PER_SECOND) return false;
    list.push(now);
    timestamps.set(socketId, list);
    return true;
  };
}

function registerSocketHandlers(io) {
  const placeBidCheckLimit = createPlaceBidRateLimiter();
  let timerInterval = null;
  let lastTimerSecondNotified = null;
  let lastTimerSecondBroadcast = null;

  function broadcastState() {
    io.emit('stateUpdate', getPublicState());
  }

  function stopAuctionTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    lastTimerSecondNotified = null;
    lastTimerSecondBroadcast = null;
  }

  function getTimerRemainingSeconds() {
    const state = getPublicState().auctionState;
    if (!state.timerEndsAt) return 0;
    return Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
  }

  async function closeOnTimerEnd() {
    const state = getPublicState().auctionState;
    if (state.phase !== 'live' || !state.timerEndsAt) {
      stopAuctionTimer();
      return;
    }

    if (state.leadingTeam) {
      const result = await markSold();
      if (result.ok) {
        broadcastState();
        io.emit('playerSold', {
          player: result.player,
          team: result.team,
          price: result.price,
        });
      }
    } else {
      const player = await markUnsold();
      if (player) {
        broadcastState();
        io.emit('playerUnsold', { player });
      }
    }

    io.emit('timerExpired');
    stopAuctionTimer();
  }

  function ensureAuctionTimer() {
    stopAuctionTimer();
    const state = getPublicState().auctionState;
    if (state.phase !== 'live' || !state.timerEndsAt) return;

    timerInterval = setInterval(async () => {
      const latestState = getPublicState().auctionState;
      if (latestState.phase !== 'live' || !latestState.timerEndsAt) {
        stopAuctionTimer();
        return;
      }

      const remaining = getTimerRemainingSeconds();
      if (remaining !== lastTimerSecondBroadcast) {
        lastTimerSecondBroadcast = remaining;
        io.emit('timerUpdate', { remaining });
      }

      if (remaining > 0 && remaining <= 3 && remaining !== lastTimerSecondNotified) {
        lastTimerSecondNotified = remaining;
        io.emit('timerFinalSeconds', { remaining });
      }

      if (remaining <= 0) {
        await closeOnTimerEnd();
      }
    }, 250);
  }

  function isAdmin(socket) {
    return !!socket.data?.isAdmin;
  }

  function denyIfNotAdmin(socket) {
    if (isAdmin(socket)) return false;
    socket.emit('authError', { msg: 'Admin authentication required.' });
    return true;
  }

  io.on('connection', (socket) => {
    socket.data.isAdmin = false;
    socket.emit('stateUpdate', getPublicState());
    logger.info({ socketId: socket.id }, 'Socket connected');

    socket.on('admin:auth', ({ token }, cb) => {
      try {
        verifyAdminToken(token);
        socket.data.isAdmin = true;
        if (cb) cb({ ok: true });
      } catch (error) {
        socket.data.isAdmin = false;
        if (cb) cb({ ok: false });
      }
    });

    socket.on('admin:verifyPassword', async ({ password }, cb) => {
      const ok = await verifyAdminPassword(password);
      socket.data.isAdmin = ok;
      if (cb) cb({ ok });
    });

    socket.on('admin:startAuction', async (payload, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const v = validate(playerIdSchema, payload);
      if (!v.ok) {
        socket.emit('authError', { msg: v.error });
        if (cb) cb({ ok: false });
        return;
      }
      const started = await startAuction(v.data.playerId);
      if (!started) return;
      broadcastState();
      ensureAuctionTimer();
    });

    socket.on('placeBid', async (payload) => {
      if (!placeBidCheckLimit(socket.id)) {
        socket.emit('bidError', { msg: 'Too many bids. Max 5 per second.' });
        return;
      }
      const v = validate(placeBidSchema, payload);
      if (!v.ok) {
        socket.emit('bidError', { msg: v.error });
        return;
      }
      const result = await placeBid({ teamId: v.data.teamId, amount: v.data.amount });

      if (!result.ok) {
        socket.emit('bidError', { msg: result.error });
        return;
      }

      broadcastState();
      io.emit('bidFlash', { team: result.team, amount: result.amount });
      ensureAuctionTimer();
    });

    socket.on('admin:undoBid', async () => {
      if (denyIfNotAdmin(socket)) return;
      const ok = await undoBid();
      if (!ok) return;

      broadcastState();
      io.emit('bidUndo');
      ensureAuctionTimer();
    });

    socket.on('admin:undoStack', (_, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const depth = getUndoStackDepth();
      if (cb) cb({ depth });
    });

    socket.on('admin:sold', async () => {
      if (denyIfNotAdmin(socket)) return;
      const result = await markSold();
      if (!result.ok) return;

      broadcastState();
      io.emit('playerSold', {
        player: result.player,
        team: result.team,
        price: result.price,
      });
      stopAuctionTimer();
    });

    socket.on('admin:unsold', async () => {
      if (denyIfNotAdmin(socket)) return;
      const player = await markUnsold();
      if (!player) return;

      broadcastState();
      io.emit('playerUnsold', { player });
      stopAuctionTimer();
    });

    socket.on('admin:stopTimer', async (_, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const result = await stopLiveTimer();
      if (!result.ok) {
        if (cb) cb({ ok: false, error: result.error });
        return;
      }
      broadcastState();
      stopAuctionTimer();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:resumeTimer', async (_, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const result = await resumeLiveTimer();
      if (!result.ok) {
        if (cb) cb({ ok: false, error: result.error });
        return;
      }
      broadcastState();
      ensureAuctionTimer();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:revertLastSold', async (_, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const result = await revertLastSold();
      if (!result.ok) {
        if (cb) cb({ ok: false, error: result.error || 'Revert failed.' });
        return;
      }

      broadcastState();
      io.emit('saleReverted', {
        player: result.player,
        team: result.team,
        price: result.price,
      });
      stopAuctionTimer();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:idle', async () => {
      if (denyIfNotAdmin(socket)) return;
      await setIdle();
      broadcastState();
      stopAuctionTimer();
    });

    socket.on('admin:resetAllTeams', async () => {
      if (denyIfNotAdmin(socket)) return;
      await resetAuctionAndTeams();
      broadcastState();
      stopAuctionTimer();
    });

    socket.on('admin:addPlayer', async (player, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const v = validate(playerFieldsSchema, player);
      if (!v.ok) {
        socket.emit('authError', { msg: v.error });
        if (cb) cb({ ok: false });
        return;
      }
      await addPlayer(v.data);
      broadcastState();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:editPlayer', async (updated, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const v = validate(playerEditSchema, updated);
      if (!v.ok) {
        socket.emit('authError', { msg: v.error });
        if (cb) cb({ ok: false });
        return;
      }
      await editPlayer(v.data);
      broadcastState();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:removePlayer', async (payload, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const v = validate(playerIdSchema, payload);
      if (!v.ok) {
        socket.emit('authError', { msg: v.error });
        if (cb) cb({ ok: false });
        return;
      }
      await removePlayer(v.data.playerId);
      broadcastState();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:resetPlayer', async (payload, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const v = validate(playerIdSchema, payload);
      if (!v.ok) {
        socket.emit('authError', { msg: v.error });
        if (cb) cb({ ok: false });
        return;
      }
      await resetPlayer(v.data.playerId);
      broadcastState();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:saveTeam', async (team, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const v = validate(teamFieldsSchema, team);
      if (!v.ok) {
        socket.emit('authError', { msg: v.error });
        if (cb) cb({ ok: false });
        return;
      }
      await saveTeam({ ...team, id: team.id || 'T' + Date.now() });
      broadcastState();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:removeTeam', async (payload, cb) => {
      if (denyIfNotAdmin(socket)) return;
      const v = validate(teamIdSchema, payload);
      if (!v.ok) {
        socket.emit('authError', { msg: v.error });
        if (cb) cb({ ok: false });
        return;
      }
      await removeTeam(v.data.teamId);
      broadcastState();
      if (cb) cb({ ok: true });
    });

    socket.on('admin:updateConfig', async (cfg) => {
      if (denyIfNotAdmin(socket)) return;
      await updateConfig(cfg || {});
      broadcastState();
      ensureAuctionTimer();
    });

    socket.on('admin:exportBackup', async (_, cb) => {
      if (denyIfNotAdmin(socket)) return;
      try {
        const { filename, snapshot } = await exportBackupToFile();
        if (cb) cb({ ok: true, filename, snapshot });
      } catch (error) {
        if (cb) cb({ ok: false, error: error.message });
      }
    });

    socket.on('admin:importBackup', async ({ payload }, cb) => {
      if (denyIfNotAdmin(socket)) return;
      try {
        await importBackup(payload);
        broadcastState();
        ensureAuctionTimer();
        io.emit('backupImported');
        if (cb) cb({ ok: true });
      } catch (error) {
        if (cb) cb({ ok: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Socket disconnected');
    });
  });

  ensureAuctionTimer();
}

module.exports = {
  registerSocketHandlers,
};
