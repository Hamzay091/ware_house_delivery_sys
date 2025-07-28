const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// All routes in this file are for Admins only
router.use(isAuthenticated, isAdmin);

// Routes for the new dropdown menu
router.get('/managers', adminController.viewAllManagers);
router.get('/delivery-staff', adminController.viewAllDeliveryStaff);
router.get('/user-detail/:id', adminController.viewUserDetail);

// Route for "impersonating" or viewing the manager dashboard
router.get('/view-as/manager', adminController.viewAsManager);

module.exports = router;