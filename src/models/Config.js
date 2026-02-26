const bcrypt = require('bcryptjs');
const { loadConfig, saveConfig } = require('../config/db');
const { defaultConfig } = require('../config/defaultData');

let config = { ...defaultConfig };

function isPasswordHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function ensurePasswordHash() {
  if (isPasswordHash(config.adminPassword)) return;

  config.adminPassword = await bcrypt.hash(String(config.adminPassword || defaultConfig.adminPassword), 10);
  await saveConfig(config);
}

async function initConfig() {
  const fromDb = await loadConfig();
  if (fromDb) {
    config = { ...config, ...fromDb };
  } else {
    await saveConfig(config);
  }

  await ensurePasswordHash();
}

function getConfig() {
  return config;
}

async function verifyAdminPassword(password) {
  if (!password) return false;

  if (!isPasswordHash(config.adminPassword)) {
    await ensurePasswordHash();
  }

  return bcrypt.compare(String(password), config.adminPassword);
}

async function updateConfig(nextConfig) {
  if (nextConfig.adminPassword !== undefined) {
    config.adminPassword = await bcrypt.hash(String(nextConfig.adminPassword), 10);
  }

  const { adminPassword, ...rest } = nextConfig;
  config = { ...config, ...rest };
  await saveConfig(config);
  return config;
}

async function replaceConfigFromBackup(nextConfig) {
  if (!nextConfig || typeof nextConfig !== 'object') return config;
  const { adminPassword, ...safeConfig } = nextConfig;
  config = { ...config, ...safeConfig };
  await saveConfig(config);
  return config;
}

module.exports = {
  initConfig,
  getConfig,
  updateConfig,
  verifyAdminPassword,
  replaceConfigFromBackup,
};
