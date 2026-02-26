const { verifyAdminPassword, updateConfig } = require('../models/Config');
const { addPlayer, editPlayer, removePlayer, resetPlayer } = require('../models/Player');
const { saveTeam, removeTeam } = require('../models/Team');
const { verifyAdminToken } = require('../services/authService');
const {
  getPublicState,
  startAuction,
  placeBid,
  undoBid,
  markSold,
  markUnsold,
  setIdle,
  resetAuctionAndTeams,
} = require('../services/auctionService');

function registerSocketHandlers(io) {
  function broadcastState() {
    io.emit('stateUpdate', getPublicState());
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
    console.log(`[+] ${socket.id}`);

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

    socket.on('admin:startAuction', async ({ playerId }) => {
      if (denyIfNotAdmin(socket)) return;
      const started = await startAuction(playerId);
      if (!started) return;
      broadcastState();
    });

    socket.on('placeBid', async ({ teamId, amount }) => {
      const result = await placeBid({ teamId, amount });

      if (!result.ok) {
        socket.emit('bidError', { msg: result.error });
        return;
      }

      broadcastState();
      io.emit('bidFlash', { team: result.team, amount: result.amount });
    });

    socket.on('admin:undoBid', async () => {
      if (denyIfNotAdmin(socket)) return;
      const ok = await undoBid();
      if (!ok) return;

      broadcastState();
      io.emit('bidUndo');
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
    });

    socket.on('admin:unsold', async () => {
      if (denyIfNotAdmin(socket)) return;
      const player = await markUnsold();
      if (!player) return;

      broadcastState();
      io.emit('playerUnsold', { player });
    });

    socket.on('admin:idle', async () => {
      if (denyIfNotAdmin(socket)) return;
      await setIdle();
      broadcastState();
    });

    socket.on('admin:resetAllTeams', async () => {
      if (denyIfNotAdmin(socket)) return;
      await resetAuctionAndTeams();
      broadcastState();
    });

    socket.on('admin:addPlayer', async (player) => {
      if (denyIfNotAdmin(socket)) return;
      await addPlayer(player);
      broadcastState();
    });

    socket.on('admin:editPlayer', async (updated) => {
      if (denyIfNotAdmin(socket)) return;
      await editPlayer(updated);
      broadcastState();
    });

    socket.on('admin:removePlayer', async ({ playerId }) => {
      if (denyIfNotAdmin(socket)) return;
      await removePlayer(playerId);
      broadcastState();
    });

    socket.on('admin:resetPlayer', async ({ playerId }) => {
      if (denyIfNotAdmin(socket)) return;
      await resetPlayer(playerId);
      broadcastState();
    });

    socket.on('admin:saveTeam', async (team) => {
      if (denyIfNotAdmin(socket)) return;
      await saveTeam(team);
      broadcastState();
    });

    socket.on('admin:removeTeam', async ({ teamId }) => {
      if (denyIfNotAdmin(socket)) return;
      await removeTeam(teamId);
      broadcastState();
    });

    socket.on('admin:updateConfig', async (cfg) => {
      if (denyIfNotAdmin(socket)) return;
      await updateConfig(cfg || {});
      broadcastState();
    });

    socket.on('disconnect', () => {
      console.log(`[-] ${socket.id}`);
    });
  });
}

module.exports = {
  registerSocketHandlers,
};
