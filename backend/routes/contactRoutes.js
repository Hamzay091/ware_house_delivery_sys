const express = require('express');

const contactController = require('../controllers/contactController');
const { isManagerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(isManagerOrAdmin);

router.post('/read/:id', contactController.markMessageAsRead);
router.post('/read-all', contactController.markAllAsRead);

module.exports = router;
