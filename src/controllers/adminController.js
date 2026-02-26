const { updateConfig, verifyAdminPassword } = require('../models/Config');
const {
  setIdle,
  resetAuctionAndTeams,
  startAuction,
  markSold,
  markUnsold,
  undoBid,
  getPublicState,
} = require('../services/auctionService');

function verifyPassword(req, res) {
  return res.json({ ok: verifyAdminPassword(req.body.password) });
}

async function updateAuctionConfig(req, res) {
  await updateConfig(req.body || {});
  return res.json({ config: getPublicState().config });
}

async function start(req, res) {
  const started = await startAuction(req.body.playerId);
  if (!started) return res.status(400).json({ error: 'Invalid player selection' });
  return res.json(getPublicState());
}

async function sold(req, res) {
  const result = await markSold();
  if (!result.ok) return res.status(400).json({ error: 'No active winning bid' });
  return res.json(result);
}

async function unsold(req, res) {
  const player = await markUnsold();
  if (!player) return res.status(400).json({ error: 'No active player' });
  return res.json({ player });
}

async function idle(req, res) {
  await setIdle();
  return res.json(getPublicState());
}

async function resetAll(req, res) {
  await resetAuctionAndTeams();
  return res.json(getPublicState());
}

async function undo(req, res) {
  const ok = await undoBid();
  if (!ok) return res.status(400).json({ error: 'Nothing to undo' });
  return res.json(getPublicState());
}

module.exports = {
  verifyPassword,
  updateAuctionConfig,
  start,
  sold,
  unsold,
  idle,
  resetAll,
  undo,
};
