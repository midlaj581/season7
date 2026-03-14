// PPL Season 7 — auctionController.js — upgraded
const { getPublicState } = require('../services/auctionService');
const { getAuctionState } = require('../models/Auction');

function getState(req, res) {
  res.json(getPublicState());
}

function getHistory(req, res) {
  const state = getAuctionState();
  const soldPlayers = (state.soldPlayers || []).map((s) => ({
    player: s.player,
    team: s.team,
    teamColor: s.teamColor,
    teamLogo: s.teamLogo,
    price: s.price,
    soldAt: s.soldAt || null,
  }));
  res.json({ soldPlayers });
}

module.exports = {
  getState,
  getHistory,
};
