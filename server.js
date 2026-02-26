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
const { registerSocketHandlers } = require('./src/socket/socketHandler');
const { getConfig } = require('./src/models/Config');
const { helmet, cors, apiLimiter, createCorsOptions } = require('./src/config/security');
const { startAutoBackupJob } = require('./src/services/backupService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: createCorsOptions(),
});

app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(apiLimiter);
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', authRoutes);
app.use('/api', playerRoutes);
app.use('/api', teamRoutes);
app.use('/api', auctionRoutes);

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
    process.exit(1);
  });
