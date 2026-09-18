const express = require('express');
const { body } = require('express-validator');
const passport = require('passport');

const authController = require('../controllers/authController');
const User = require('../models/user');

const router = express.Router();

const ensureAuthProfile = (req, res, next) => {
    if (req.session.oauthProfile) return next();
    res.redirect('/login');
};

const registerValidators = [
    body('name').trim().notEmpty().withMessage('Your name is required.').escape(),
    body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Your password must be at least 8 characters long.'),
    body('role').isIn(User.ROLES).withMessage('Choose a valid role.'),
    body('phone').optional({ checkFalsy: true }).trim().escape(),
    body('socialLink')
        .optional({ checkFalsy: true })
        .isURL({ require_protocol: true })
        .withMessage('Your social link must be a full URL, including https://')
];

router.get('/register', authController.renderRegisterPage);
router.post('/register', registerValidators, authController.handleRegister);

router.get('/login', authController.renderLoginPage);
router.post('/login', [
    body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
    body('password').notEmpty().withMessage('Enter your password.')
], authController.handleLogin);

// Logging out changes state, so it is a POST guarded by the CSRF token.
router.post('/logout', authController.handleLogout);

router.get('/auth/google', (req, res, next) => {
    if (!req.app.locals.googleAuthEnabled) {
        req.flash('error', 'Google sign-in is not configured on this server.');
        return res.redirect('/login');
    }
    return passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })(req, res, next);
});

router.get('/auth/google/callback', authController.handleGoogleCallback);

router.get('/choose-role', ensureAuthProfile, authController.renderChooseRolePage);
router.post('/choose-role', ensureAuthProfile, authController.handleChooseRole);

module.exports = router;
