const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/manage', isAuthenticated, isAdmin, userController.getAllUsers);
// THIS IS THE CORRECTED LINE:
router.get('/edit/:id', isAuthenticated, isAdmin, userController.renderEditForm);
// IT WAS: router.get('/edit/:id', isAuthenticated, isAdmin, user.renderEditForm);
//                                                          ^^^^
//                                                          Typo!
router.post('/edit/:id', isAuthenticated, isAdmin, userController.updateUser);
router.get('/delete/:id', isAuthenticated, isAdmin, userController.deleteUser);
router.get('/profile/edit', isAuthenticated, userController.renderEditProfileForm);
router.post('/profile/edit', isAuthenticated, userController.handleUpdateProfile);
router.get('/profile/change-password', isAuthenticated, userController.renderChangePasswordForm);
router.post('/profile/change-password', isAuthenticated, userController.handleChangePassword);

module.exports = router;