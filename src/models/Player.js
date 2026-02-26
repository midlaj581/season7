const { avatarUrl } = require('../utils/helpers');
const { loadPlayers, savePlayers } = require('../config/db');
const { defaultPlayers } = require('../config/defaultData');

let players = [];

function normalizePlayer(player) {
  const next = {
    id: Number(player.id),
    name: player.name,
    position: player.position,
    rating: Number(player.rating),
    basePrice: Number(player.basePrice),
    photo: player.photo || '',
    status: player.status || 'available',
  };

  if (player.soldTo !== undefined) next.soldTo = player.soldTo;
  if (player.soldPrice !== undefined) next.soldPrice = Number(player.soldPrice);

  if (!next.photo) {
    next.photo = avatarUrl(next.name);
  }

  return next;
}

async function initPlayers() {
  const fromDb = await loadPlayers();
  if (fromDb.length) {
    players = fromDb.map(normalizePlayer);
    return;
  }

  players = defaultPlayers.map(normalizePlayer);
  await savePlayers(players);
}

function getPlayers() {
  return players;
}

function findPlayerById(playerId) {
  return players.find((player) => player.id === Number(playerId));
}

async function persistPlayers() {
  await savePlayers(players);
}

async function addPlayer(player) {
  const nextPlayer = normalizePlayer({
    ...player,
    id: Math.max(...players.map((p) => p.id), 0) + 1,
    status: 'available',
  });

  players.push(nextPlayer);
  await persistPlayers();
  return nextPlayer;
}

async function editPlayer(updated) {
  const index = players.findIndex((player) => player.id === Number(updated.id));
  if (index === -1) return null;

  const merged = normalizePlayer({ ...players[index], ...updated, id: players[index].id });
  players[index] = merged;
  await persistPlayers();
  return merged;
}

async function removePlayer(playerId) {
  const before = players.length;
  players = players.filter((player) => player.id !== Number(playerId));
  if (before === players.length) return false;
  await persistPlayers();
  return true;
}

async function resetPlayer(playerId) {
  const player = findPlayerById(playerId);
  if (!player) return null;

  player.status = 'available';
  delete player.soldTo;
  delete player.soldPrice;
  await persistPlayers();
  return player;
}

async function resetAllSoldOrUnsoldPlayers() {
  players.forEach((player) => {
    if (player.status === 'sold' || player.status === 'unsold') {
      player.status = 'available';
      delete player.soldTo;
      delete player.soldPrice;
    }
  });

  await persistPlayers();
}

async function replacePlayers(nextPlayers) {
  players = (Array.isArray(nextPlayers) ? nextPlayers : []).map(normalizePlayer);
  await persistPlayers();
}

module.exports = {
  initPlayers,
  getPlayers,
  findPlayerById,
  persistPlayers,
  addPlayer,
  editPlayer,
  removePlayer,
  resetPlayer,
  resetAllSoldOrUnsoldPlayers,
  replacePlayers,
};
