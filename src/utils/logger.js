// PPL Season 7 — logger.js — upgraded
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'ppl-auction' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

function reqId() {
  return (Math.random().toString(36).slice(2, 9) + Date.now().toString(36)).slice(-12);
}

module.exports = { logger, reqId };
