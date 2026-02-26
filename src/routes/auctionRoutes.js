const express = require('express');
const { getState } = require('../controllers/auctionController');
const {
  verifyPassword,
  updateAuctionConfig,
  start,
  sold,
  unsold,
  idle,
  resetAll,
  undo,
} = require('../controllers/adminController');

const router = express.Router();

router.get('/state', getState);

router.post('/admin/verify-password', verifyPassword);
router.post('/admin/start', start);
router.post('/admin/sold', sold);
router.post('/admin/unsold', unsold);
router.post('/admin/idle', idle);
router.post('/admin/reset', resetAll);
router.post('/admin/undo', undo);
router.patch('/admin/config', updateAuctionConfig);

module.exports = router;
