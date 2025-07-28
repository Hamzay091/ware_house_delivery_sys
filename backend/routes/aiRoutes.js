const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController'); // Corrected Path
const { isAuthenticated, isManagerOrAdmin } = require('../middleware/authMiddleware'); // Corrected Path

router.get('/optimize-delivery-route/:id', isAuthenticated, isManagerOrAdmin, aiController.getOptimizedRoute);

module.exports = router;