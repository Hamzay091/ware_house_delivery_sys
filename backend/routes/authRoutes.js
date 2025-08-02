const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { body } = require('express-validator');
const passport = require('passport');

const ensureAuthProfile = (req, res, next) => {
    if (req.session.oauthProfile) {
        return next();
    }
    res.redirect('/login');
};

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

router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

router.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) {
            req.session.oauthProfile = info.profile;
            return res.redirect('/choose-role');
        }
        if (user.status !== 'approved') {
            return res.render('login', { error: 'Your account is still pending approval.', errors: [] });
        }
        req.login(user, (err) => {
            if (err) { return next(err); }
            const redirectUrl = {
                Admin: '/admin-dashboard',
                Manager: '/manager-dashboard',
                DeliveryStaff: '/delivery-staff-dashboard'
            }[user.role] || '/login';
            return res.redirect(redirectUrl);
        });
    })(req, res, next);
});

router.get('/choose-role', ensureAuthProfile, authController.renderChooseRolePage);
router.post('/choose-role', ensureAuthProfile, authController.handleChooseRole);

module.exports = router;