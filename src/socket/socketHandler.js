const { verifyAdminPassword, updateConfig } = require('../models/Config');
const { addPlayer, editPlayer, removePlayer, resetPlayer } = require('../models/Player');
const { saveTeam, removeTeam } = require('../models/Team');
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

  io.on('connection', (socket) => {
    socket.emit('stateUpdate', getPublicState());
    console.log(`[+] ${socket.id}`);

    socket.on('admin:verifyPassword', ({ password }, cb) => {
      if (cb) cb({ ok: verifyAdminPassword(password) });
    });

    socket.on('admin:startAuction', async ({ playerId }) => {
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
      const ok = await undoBid();
      if (!ok) return;

      broadcastState();
      io.emit('bidUndo');
    });

    socket.on('admin:sold', async () => {
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
      const player = await markUnsold();
      if (!player) return;

      broadcastState();
      io.emit('playerUnsold', { player });
    });

    socket.on('admin:idle', async () => {
      await setIdle();
      broadcastState();
    });

    socket.on('admin:resetAllTeams', async () => {
      await resetAuctionAndTeams();
      broadcastState();
    });

    socket.on('admin:addPlayer', async (player) => {
      await addPlayer(player);
      broadcastState();
    });

    socket.on('admin:editPlayer', async (updated) => {
      await editPlayer(updated);
      broadcastState();
    });

    socket.on('admin:removePlayer', async ({ playerId }) => {
      await removePlayer(playerId);
      broadcastState();
    });

    socket.on('admin:resetPlayer', async ({ playerId }) => {
      await resetPlayer(playerId);
      broadcastState();
    });

    socket.on('admin:saveTeam', async (team) => {
      await saveTeam(team);
      broadcastState();
    });

    socket.on('admin:removeTeam', async ({ teamId }) => {
      await removeTeam(teamId);
      broadcastState();
    });

    socket.on('admin:updateConfig', async (cfg) => {
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
