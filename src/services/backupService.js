// PPL Season 7 — backupService.js — upgraded
const fs = require('fs/promises');
const path = require('path');

const { getConfig, replaceConfigFromBackup } = require('../models/Config');
const { getPlayers, replacePlayers } = require('../models/Player');
const { getTeams, replaceTeams } = require('../models/Team');
const {
  getAuctionState,
  getUndoStack,
  replaceAuction,
} = require('../models/Auction');
const { sanitizeConfig } = require('../utils/helpers');
const { logger } = require('../utils/logger');

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_AUTO_BACKUPS = 50;

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function buildSnapshot() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      config: sanitizeConfig(getConfig()),
      players: getPlayers(),
      teams: getTeams(),
      auctionState: getAuctionState(),
      undoStack: getUndoStack(),
    },
  };
}

async function rotateAutoBackups() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const autoBackups = files
      .filter((f) => f.startsWith('auto-backup-'))
      .map((f) => ({ name: f, path: path.join(BACKUP_DIR, f) }));

    if (autoBackups.length > MAX_AUTO_BACKUPS) {
      const statPromises = autoBackups.map(async (f) => ({
        ...f,
        mtime: (await fs.stat(f.path)).mtime.getTime(),
      }));
      const withStats = await Promise.all(statPromises);
      withStats.sort((a, b) => a.mtime - b.mtime);
      const toDelete = withStats.slice(0, withStats.length - MAX_AUTO_BACKUPS);
      for (const f of toDelete) {
        await fs.unlink(f.path);
      }
    }
  } catch (err) {
    // ignore
  }
}

async function writeSnapshotToFile(snapshot, prefix = 'auction-backup') {
  await ensureBackupDir();
  const filename = `${prefix}-${ts()}.json`;
  const fullpath = path.join(BACKUP_DIR, filename);
  await fs.writeFile(fullpath, JSON.stringify(snapshot, null, 2), 'utf8');
  if (prefix === 'auto-backup') await rotateAutoBackups();
  return { filename, fullpath };
}

async function exportBackupToFile() {
  const snapshot = buildSnapshot();
  const file = await writeSnapshotToFile(snapshot, 'manual-export');
  return {
    ...file,
    snapshot,
  };
}

async function createAutoBackup() {
  const snapshot = buildSnapshot();
  return writeSnapshotToFile(snapshot, 'auto-backup');
}

function normalizeIncomingSnapshot(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!parsed || typeof parsed !== 'object' || !parsed.data) {
    throw new Error('Invalid backup format.');
  }

  const { config, players, teams, auctionState, previousBidSnapshot, undoStack } = parsed.data;
  if (!Array.isArray(players) || !Array.isArray(teams) || !auctionState || typeof auctionState !== 'object') {
    throw new Error('Backup missing required sections.');
  }

  const stack = Array.isArray(undoStack)
    ? undoStack
    : previousBidSnapshot
      ? (Array.isArray(previousBidSnapshot) ? previousBidSnapshot : [previousBidSnapshot])
      : [];

  return {
    config: config || {},
    players,
    teams,
    auctionState,
    undoStack: stack,
  };
}

async function importBackup(payload) {
  const normalized = normalizeIncomingSnapshot(payload);

  await replaceConfigFromBackup(normalized.config);
  await replacePlayers(normalized.players);
  await replaceTeams(normalized.teams);
  await replaceAuction(normalized.auctionState, normalized.undoStack);

  return normalized;
}

function startAutoBackupJob(intervalMs = 30_000) {
  let running = false;
  const interval = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await createAutoBackup();
    } catch (error) {
      logger.error({ err: error }, 'Auto-backup failed');
    } finally {
      running = false;
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

module.exports = {
  BACKUP_DIR,
  buildSnapshot,
  exportBackupToFile,
  createAutoBackup,
  importBackup,
  startAutoBackupJob,
};
