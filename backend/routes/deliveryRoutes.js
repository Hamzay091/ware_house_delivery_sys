const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController'); 
const { isAuthenticated, isManagerOrAdmin, isDeliveryStaff } = require('../middleware/authMiddleware');

router.get('/assign', isAuthenticated, isManagerOrAdmin, deliveryController.renderAssignForm);
router.post('/assign', isAuthenticated, isManagerOrAdmin, deliveryController.createDelivery);
router.post('/update-status/:id', isAuthenticated, isDeliveryStaff, deliveryController.updateDeliveryStatus);

module.exports = router;