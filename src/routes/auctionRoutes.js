// PPL Season 7 — auctionRoutes.js — upgraded
const express = require('express');
const { getState, getHistory } = require('../controllers/auctionController');
const {
  updateAuctionConfig,
  start,
  sold,
  unsold,
  idle,
  resetAll,
  undo,
} = require('../controllers/adminController');
const { requireAdminJwt } = require('../config/security');

const router = express.Router();

router.get('/state', getState);
router.get('/auction/history', getHistory);

router.post('/admin/start', requireAdminJwt, start);
router.post('/admin/sold', requireAdminJwt, sold);
router.post('/admin/unsold', requireAdminJwt, unsold);
router.post('/admin/idle', requireAdminJwt, idle);
router.post('/admin/reset', requireAdminJwt, resetAll);
router.post('/admin/undo', requireAdminJwt, undo);
router.patch('/admin/config', requireAdminJwt, updateAuctionConfig);

module.exports = router;
