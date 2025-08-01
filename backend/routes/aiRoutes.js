const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController'); 
const { isAuthenticated, isManagerOrAdmin } = require('../middleware/authMiddleware');

router.get('/optimize-delivery-route/:id', isAuthenticated, isManagerOrAdmin, aiController.getOptimizedRoute);

module.exports = router;