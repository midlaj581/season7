// PPL Season 7 — playerRoutes.js — upgraded
const express = require('express');
const multer = require('multer');
const {
  uploadImage,
  getImage,
  listPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  restorePlayer,
} = require('../controllers/playerController');
const { importPlayers } = require('../controllers/playerImportController');
const { requireAdminJwt } = require('../config/security');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', uploadImage);
router.post('/players/import', requireAdminJwt, upload.single('file'), importPlayers);
router.get('/img/:id', getImage);

router.get('/players', listPlayers);
router.post('/players', createPlayer);
router.put('/players/:id', updatePlayer);
router.delete('/players/:id', deletePlayer);
router.post('/players/:id/reset', restorePlayer);

module.exports = router;
