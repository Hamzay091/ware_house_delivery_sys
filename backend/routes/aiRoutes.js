const express = require('express');

const aiController = require('../controllers/aiController');
const { isManagerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/optimize-delivery-route/:id', isManagerOrAdmin, aiController.getOptimizedRoute);

module.exports = router;
