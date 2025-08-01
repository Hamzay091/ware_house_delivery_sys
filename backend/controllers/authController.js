const User = require('../models/user');
const { validationResult } = require('express-validator');
const passport = require('passport');

exports.renderRegisterPage = (req, res) => res.render('register', { errors: [] });
exports.renderLoginPage = (req, res) => res.render('login', { error: req.query.error, errors: [] });

exports.renderChooseRolePage = (req, res) => {
    if (!req.session.oauthProfile) {
        return res.redirect('/login');
    }
    res.render('choose-role', { name: req.session.oauthProfile.displayName });
};

exports.handleChooseRole = async (req, res) => {
    if (!req.session.oauthProfile) {
        return res.redirect('/login');
    }
    try {
        const { role } = req.body;
        const profile = req.session.oauthProfile;

        const newUser = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            role: role
        });
        
        req.session.oauthProfile = null; 

        req.login(newUser, (err) => {
            if (err) {
                return res.redirect('/login?error=Could+not+log+you+in.');
            }
            const redirectUrl = {
                Admin: '/admin-dashboard',
                Manager: '/manager-dashboard',
                DeliveryStaff: '/delivery-staff-dashboard'
            }[newUser.role] || '/login';
            res.redirect(redirectUrl);
        });
    } catch (error) {
        res.redirect('/login?error=Registration+failed.');
    }
};

exports.handleRegister = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('register', { errors: errors.array() });
    }
    try {
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(400).render('register', {
                errors: [{ msg: 'An account with this email address already exists.' }]
            });
        }
        await User.create(req.body);
        res.redirect('/login');
    } catch (error) {
        res.status(500).render('register', {
            errors: [{ msg: 'An unexpected error occurred. Please try again.' }]
        });
    }
};

exports.handleLogin = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('login', { error: null, errors: errors.array() });
    }
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) {
        
            return res.status(401).render('login', { error: info.message, errors: [] });
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
};

exports.handleLogout = (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        req.session.destroy(() => res.redirect('/'));
    });
};