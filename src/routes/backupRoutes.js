// PPL Season 7 — backupRoutes.js — upgraded
const express = require('express');
const { listBackups } = require('../controllers/backupController');
const { requireAdminJwt } = require('../config/security');

const router = express.Router();
router.get('/backups', requireAdminJwt, listBackups);

module.exports = router;
