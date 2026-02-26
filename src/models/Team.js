const { loadTeams, saveTeams } = require('../config/db');
const { defaultTeams } = require('../config/defaultData');
const { getConfig } = require('./Config');

let teams = [];
const HARD_BUDGET_LIMIT = 1500;

function resolveBudgetLimit() {
  const fromConfig = Number(getConfig()?.teamBudgetLimit || HARD_BUDGET_LIMIT);
  return Number.isFinite(fromConfig) ? Math.max(1, fromConfig) : HARD_BUDGET_LIMIT;
}

function clampBudget(value) {
  const limit = resolveBudgetLimit();
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return limit;
  return Math.max(1, Math.min(limit, Math.round(numeric)));
}

function normalizeTeam(team) {
  return {
    id: team.id,
    name: team.name,
    color: team.color,
    logo: team.logo || '',
    budget: clampBudget(team.budget),
    spent: Number(team.spent || 0),
    players: Array.isArray(team.players) ? team.players : [],
  };
}

async function initTeams() {
  const fromDb = await loadTeams();
  if (fromDb.length) {
    teams = fromDb.map(normalizeTeam);
    await saveTeams(teams);
    return;
  }

  teams = defaultTeams.map(normalizeTeam);
  await saveTeams(teams);
}

function getTeams() {
  return teams;
}

function findTeamById(teamId) {
  return teams.find((team) => team.id === teamId);
}

async function persistTeams() {
  await saveTeams(teams);
}

async function saveTeam(team) {
  const index = teams.findIndex((current) => current.id === team.id);

  if (index === -1) {
    const nextTeam = normalizeTeam({ ...team, spent: 0, players: [] });
    teams.push(nextTeam);
    await persistTeams();
    return nextTeam;
  }

  teams[index] = normalizeTeam({
    ...teams[index],
    name: team.name,
    color: team.color,
    logo: team.logo,
    budget: Number(team.budget),
  });

  await persistTeams();
  return teams[index];
}

async function removeTeam(teamId) {
  const before = teams.length;
  teams = teams.filter((team) => team.id !== teamId);
  if (before === teams.length) return false;

  await persistTeams();
  return true;
}

async function resetAllTeams() {
  teams.forEach((team) => {
    team.spent = 0;
    team.players = [];
  });

  await persistTeams();
}

async function replaceTeams(nextTeams) {
  teams = (Array.isArray(nextTeams) ? nextTeams : []).map(normalizeTeam);
  await persistTeams();
}

module.exports = {
  initTeams,
  getTeams,
  findTeamById,
  persistTeams,
  saveTeam,
  removeTeam,
  resetAllTeams,
  replaceTeams,
};
