const express = require('express');

const dashboardController = require('../controllers/dashboardController');
const { isAdmin, isManagerOrAdmin, isDeliveryStaff } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/admin-dashboard', isAdmin, dashboardController.renderAdminDashboard);
router.get('/manager-dashboard', isManagerOrAdmin, dashboardController.renderManagerDashboard);
router.get('/delivery-staff-dashboard', isDeliveryStaff, dashboardController.renderStaffDashboard);
router.get('/view-messages', isManagerOrAdmin, dashboardController.renderMessagesPage);
router.get('/delivery-reports', isManagerOrAdmin, dashboardController.renderDeliveryReportsPage);
router.get('/delivery-reports/export.csv', isManagerOrAdmin, dashboardController.exportDeliveryReports);

module.exports = router;
