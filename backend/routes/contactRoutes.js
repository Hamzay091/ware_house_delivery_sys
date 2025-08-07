const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { isAuthenticated, isManagerOrAdmin } = require('../middleware/authMiddleware');

router.post('/read/:id', isAuthenticated, isManagerOrAdmin, contactController.markMessageAsRead);

module.exports = router;