const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { body } = require('express-validator'); 



router.get('/register', authController.renderRegisterPage);

router.post('/register', [

    body('name').trim().notEmpty().withMessage('Name is required.').escape(),
   
    body('email').isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
    
    
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')

], authController.handleRegister);


router.get('/login', authController.renderLoginPage);

router.post('/login', [

    body('email').isEmail().withMessage('Please enter a valid email address.').normalizeEmail()

], authController.handleLogin);


router.get('/logout', authController.handleLogout);

module.exports = router;