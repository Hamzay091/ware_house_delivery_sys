const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { isAuthenticated, isManagerOrAdmin } = require('../middleware/authMiddleware');

router.get('/', isAuthenticated, isManagerOrAdmin, notificationController.renderNotificationsPage);

router.get('/read/:id', isAuthenticated, notificationController.markAsRead);

module.exports = router;