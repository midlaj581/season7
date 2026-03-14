// PPL Season 7 — backupController.js — upgraded
const fs = require('fs/promises');
const path = require('path');
const { requireAdminJwt } = require('../config/security');
const { BACKUP_DIR } = require('../services/backupService');

async function listBackups(req, res) {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const files = await fs.readdir(BACKUP_DIR);
    const stats = await Promise.all(
      files.map(async (f) => {
        const fp = path.join(BACKUP_DIR, f);
        const stat = await fs.stat(fp);
        return {
          filename: f,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        };
      }),
    );
    stats.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list backups' });
  }
}

module.exports = { listBackups };
