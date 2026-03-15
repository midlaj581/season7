// PPL Season 7 — server.js — upgraded
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const { connectDB } = require('./src/config/db');
const { initializeModels } = require('./src/models/initModels');
const playerRoutes = require('./src/routes/playerRoutes');
const teamRoutes = require('./src/routes/teamRoutes');
const auctionRoutes = require('./src/routes/auctionRoutes');
const authRoutes = require('./src/routes/authRoutes');
const backupRoutes = require('./src/routes/backupRoutes');
const { registerSocketHandlers } = require('./src/socket/socketHandler');
const { getConfig } = require('./src/models/Config');
const { helmet, cors, apiLimiter, createCorsOptions } = require('./src/config/security');
const { startAutoBackupJob } = require('./src/services/backupService');

// Startup validation: JWT_SECRET must not be default in production
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET || '';
  if (secret === 'change-this-secret' || !secret.trim()) {
    console.error('FATAL: JWT_SECRET must be changed in production. Refusing to start.');
    process.exit(1);
  }
}

// CORS validation for production (throws if wildcard in prod)
let corsOptions;
try {
  corsOptions = createCorsOptions();
} catch (err) {
  console.error('FATAL:', err.message);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

app.set('trust proxy', 1);
app.use(helmet({
  // The current UI still uses inline scripts and inline event handlers.
  // Re-enable stricter CSP only after moving those pages to non-inline JS.
  contentSecurityPolicy: false,
}));
app.use(cors(corsOptions));
app.use(apiLimiter);
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'ppl-auction', ts: new Date().toISOString() });
});

app.use('/api', authRoutes);
app.use('/api', playerRoutes);
app.use('/api', teamRoutes);
app.use('/api', auctionRoutes);
app.use('/api', backupRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => initializeModels())
  .then(() => {
    const backupIntervalMs = Number(process.env.AUTO_BACKUP_INTERVAL_MS || 30_000);
    startAutoBackupJob(backupIntervalMs);

    server.listen(PORT, () => {
      console.log(`\nPPL Auction -> http://localhost:${PORT}`);
      console.log(`Admin       -> http://localhost:${PORT}/admin.html`);
      console.log(`Projector   -> http://localhost:${PORT}/projector.html`);
      console.log(`Manager     -> http://localhost:${PORT}/manager.html`);
      console.log('\nAdmin password is securely stored (hashed).\n');
      console.log(`Auto backup every ${Math.floor(backupIntervalMs / 1000)}s.`);
      const cfg = getConfig();
      if (!cfg.adminPassword) {
        console.warn('Admin password is not configured.');
      }
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    console.error('DB env detected:', {
      DATABASE_URL: !!process.env.DATABASE_URL,
      MYSQL_URL: !!process.env.MYSQL_URL,
      MYSQL_URL_PUBLIC: !!process.env.MYSQL_URL_PUBLIC,
      MYSQLHOST: !!process.env.MYSQLHOST,
      MYSQLPORT: !!process.env.MYSQLPORT,
      MYSQLUSER: !!process.env.MYSQLUSER,
      MYSQLDATABASE: !!process.env.MYSQLDATABASE,
      DB_HOST: !!process.env.DB_HOST,
      DB_PORT: !!process.env.DB_PORT,
      DB_USER: !!process.env.DB_USER,
      DB_NAME: !!process.env.DB_NAME,
      DB_SSL: process.env.DB_SSL || null,
    });
    process.exit(1);
  });
