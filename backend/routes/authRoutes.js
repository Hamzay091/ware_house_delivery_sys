const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { body } = require('express-validator'); // Import the validator

// --- ADD VALIDATION MIDDLEWARE ---

router.get('/register', authController.renderRegisterPage);

router.post('/register', [
    // Sanitize the name field to prevent XSS attacks
    body('name').trim().notEmpty().withMessage('Name is required.').escape(),
    
    // Validate that the email is in the correct format
    body('email').isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
    
    // Validate that the password meets a minimum length requirement
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')

], authController.handleRegister);


router.get('/login', authController.renderLoginPage);

router.post('/login', [
    // Also validate and sanitize login inputs
    body('email').isEmail().withMessage('Please enter a valid email address.').normalizeEmail()

], authController.handleLogin);


router.get('/logout', authController.handleLogout);

module.exports = router;