const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController'); // Corrected Path
const { isAuthenticated, isAdmin, isManagerOrAdmin, isDeliveryStaff } = require('../middleware/authMiddleware'); // Corrected Path

router.get('/admin-dashboard', isAuthenticated, isAdmin, dashboardController.renderAdminDashboard);
router.get('/manager-dashboard', isAuthenticated, isManagerOrAdmin, dashboardController.renderManagerDashboard);
router.get('/delivery-staff-dashboard', isAuthenticated, isDeliveryStaff, dashboardController.renderStaffDashboard);
router.get('/view-messages', isAuthenticated, isManagerOrAdmin, dashboardController.renderMessagesPage);
router.get('/delivery-reports', isAuthenticated, isManagerOrAdmin, dashboardController.renderDeliveryReportsPage);

module.exports = router;