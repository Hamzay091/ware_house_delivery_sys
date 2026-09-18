const express = require('express');

const deliveryController = require('../controllers/deliveryController');
const { isManagerOrAdmin, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/assign', isManagerOrAdmin, deliveryController.renderAssignForm);
router.post('/assign', isManagerOrAdmin, deliveryController.createDelivery);

// Staff update their own deliveries; the controller enforces ownership.
router.post(
    '/update-status/:id',
    requireRole('DeliveryStaff', 'Manager', 'Admin'),
    deliveryController.updateDeliveryStatus
);

module.exports = router;
