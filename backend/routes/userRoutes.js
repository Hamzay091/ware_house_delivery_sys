const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/manage', isAuthenticated, isAdmin, userController.getAllUsers);
router.get('/edit/:id', isAuthenticated, isAdmin, userController.renderEditForm);
router.post('/edit/:id', isAuthenticated, isAdmin, userController.updateUser);
router.get('/delete/:id', isAuthenticated, isAdmin, userController.deleteUser);

router.post('/approve/:id', isAuthenticated, isAdmin, userController.approveUser);
router.post('/reject/:id', isAuthenticated, isAdmin, userController.rejectUser);

router.get('/profile/edit', isAuthenticated, userController.renderEditProfileForm);
router.post('/profile/edit', isAuthenticated, userController.handleUpdateProfile);
router.get('/profile/change-password', isAuthenticated, userController.renderChangePasswordForm);
router.post('/profile/change-password', isAuthenticated, userController.handleChangePassword);

module.exports = router;