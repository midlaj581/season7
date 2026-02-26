const { loadConfig, saveConfig } = require('../config/db');
const { defaultConfig } = require('../config/defaultData');

let config = { ...defaultConfig };

async function initConfig() {
  const fromDb = await loadConfig();
  if (fromDb) {
    config = { ...config, ...fromDb };
    return;
  }
  await saveConfig(config);
}

function getConfig() {
  return config;
}

function verifyAdminPassword(password) {
  return password === config.adminPassword;
}

async function updateConfig(nextConfig) {
  if (nextConfig.adminPassword !== undefined) {
    config.adminPassword = nextConfig.adminPassword;
  }

  const { adminPassword, ...rest } = nextConfig;
  config = { ...config, ...rest };
  await saveConfig(config);
  return config;
}

module.exports = {
  initConfig,
  getConfig,
  updateConfig,
  verifyAdminPassword,
};
