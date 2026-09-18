const express = require('express');

const notificationController = require('../controllers/notificationController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(isAuthenticated);

router.get('/', notificationController.renderNotificationsPage);
router.post('/read/:id', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);

module.exports = router;
