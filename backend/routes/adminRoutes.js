const express = require('express');

const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(isAdmin);

router.get('/managers', adminController.viewAllManagers);
router.get('/delivery-staff', adminController.viewAllDeliveryStaff);
router.get('/user-detail/:id', adminController.viewUserDetail);
router.get('/view-as/manager', adminController.viewAsManager);

module.exports = router;
