const express = require('express');

const userController = require('../controllers/userController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Self-service routes are declared first so /profile/edit is never matched
// by the admin patterns below.
router.get('/profile/edit', isAuthenticated, userController.renderEditProfileForm);
router.post('/profile/edit', isAuthenticated, userController.handleUpdateProfile);
router.get('/profile/change-password', isAuthenticated, userController.renderChangePasswordForm);
router.post('/profile/change-password', isAuthenticated, userController.handleChangePassword);

router.get('/manage', isAdmin, userController.getAllUsers);
router.post('/approve/:id', isAdmin, userController.approveUser);
router.post('/reject/:id', isAdmin, userController.rejectUser);
router.get('/edit/:id', isAdmin, userController.renderEditForm);
router.post('/edit/:id', isAdmin, userController.updateUser);
router.post('/delete/:id', isAdmin, userController.deleteUser);

module.exports = router;
