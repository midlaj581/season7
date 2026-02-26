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
const { registerSocketHandlers } = require('./src/socket/socketHandler');
const { getConfig } = require('./src/models/Config');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', playerRoutes);
app.use('/api', teamRoutes);
app.use('/api', auctionRoutes);

registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => initializeModels())
  .then(() => {
    server.listen(PORT, () => {
      const config = getConfig();
      console.log(`\nPPL Auction -> http://localhost:${PORT}`);
      console.log(`Admin       -> http://localhost:${PORT}/admin.html`);
      console.log(`Projector   -> http://localhost:${PORT}/projector.html`);
      console.log(`Manager     -> http://localhost:${PORT}/manager.html`);
      console.log(`\nDefault admin password: ${config.adminPassword}\n`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
