const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.use(isAuthenticated, isAdmin);

router.get('/managers', adminController.viewAllManagers);
router.get('/delivery-staff', adminController.viewAllDeliveryStaff);
router.get('/user-detail/:id', adminController.viewUserDetail);

router.get('/view-as/manager', adminController.viewAsManager);

module.exports = router;