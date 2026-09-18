const passport = require('passport');
const { validationResult } = require('express-validator');

const User = require('../models/user');

const DASHBOARD_BY_ROLE = {
    Admin: '/admin-dashboard',
    Manager: '/manager-dashboard',
    DeliveryStaff: '/delivery-staff-dashboard'
};

const PENDING_MESSAGE = 'Your account is still waiting for an administrator to approve it.';

/** Where to send a user after a successful sign-in. */
function landingFor(req, user) {
    const target = req.session && req.session.returnTo;
    if (req.session) delete req.session.returnTo;
    // Only ever redirect within this app — never to an absolute URL supplied
    // by a query string or header.
    if (target && target.startsWith('/') && !target.startsWith('//')) return target;
    return DASHBOARD_BY_ROLE[user.role] || '/';
}

exports.renderRegisterPage = (req, res) =>
    res.render('register', { title: 'Create an account', errors: [], values: {} });

exports.renderLoginPage = (req, res) =>
    res.render('login', { title: 'Log in', errors: [], values: {} });

exports.renderChooseRolePage = (req, res) => {
    if (!req.session.oauthProfile) return res.redirect('/login');
    res.render('choose-role', {
        title: 'Choose your role',
        name: req.session.oauthProfile.displayName
    });
};

exports.handleChooseRole = async (req, res, next) => {
    if (!req.session.oauthProfile) return res.redirect('/login');

    // Admin is not offered here, and is rejected server-side too — otherwise a
    // hand-crafted POST could claim it.
    const { role } = req.body;
    if (!['Manager', 'DeliveryStaff'].includes(role)) {
        req.flash('error', 'Please choose a valid role.');
        return res.redirect('/choose-role');
    }

    try {
        const profile = req.session.oauthProfile;
        // Accounts created through Google start pending, exactly like a
        // password registration, so OAuth cannot be used to skip approval.
        await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value.toLowerCase(),
            role,
            status: 'pending'
        });

        delete req.session.oauthProfile;

        req.flash('success', 'Registration complete. An administrator needs to approve your account before you can sign in.');
        res.redirect('/login');
    } catch (error) {
        if (error.code === 11000) {
            req.flash('error', 'An account with that email already exists. Try logging in instead.');
            return res.redirect('/login');
        }
        return next(error);
    }
};

exports.handleRegister = async (req, res, next) => {
    const errors = validationResult(req);
    const values = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        socialLink: req.body.socialLink,
        gender: req.body.gender,
        role: req.body.role
    };

    if (!errors.isEmpty()) {
        return res.status(400).render('register', {
            title: 'Create an account',
            errors: errors.array(),
            values
        });
    }

    try {
        const email = String(req.body.email).toLowerCase().trim();
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).render('register', {
                title: 'Create an account',
                errors: [{ msg: 'An account with this email address already exists.' }],
                values
            });
        }

        // The very first admin has nobody to approve them, so that one account
        // is auto-approved to bootstrap the system. Every later registration
        // waits — otherwise anyone could pick the Admin role on a public form
        // and hand themselves an approved admin account.
        const approvedAdmins = await User.countDocuments({ role: 'Admin', status: 'approved' });
        const isBootstrapAdmin = req.body.role === 'Admin' && approvedAdmins === 0;

        // Explicit field list: never hand req.body straight to the model, or a
        // crafted form could set fields the registration form never showed —
        // `status` in particular, which would let anyone self-approve.
        const created = await User.create({
            name: req.body.name,
            email,
            password: req.body.password,
            role: req.body.role,
            phone: req.body.phone,
            socialLink: req.body.socialLink,
            gender: req.body.gender,
            status: isBootstrapAdmin ? 'approved' : 'pending'
        });

        req.flash(
            'success',
            created.status === 'approved'
                ? 'Admin account created. You can log in now.'
                : 'Registration complete. An administrator needs to approve your account before you can sign in.'
        );
        res.redirect('/login');
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).render('register', {
                title: 'Create an account',
                errors: Object.values(error.errors).map(e => ({ msg: e.message })),
                values
            });
        }
        return next(error);
    }
};

exports.handleLogin = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('login', {
            title: 'Log in',
            errors: errors.array(),
            values: { email: req.body.email }
        });
    }

    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            return res.status(401).render('login', {
                title: 'Log in',
                errors: [{ msg: (info && info.message) || 'Invalid email or password.' }],
                values: { email: req.body.email }
            });
        }
        if (user.status !== 'approved') {
            return res.status(403).render('login', {
                title: 'Log in',
                errors: [{ msg: PENDING_MESSAGE }],
                values: { email: req.body.email }
            });
        }
        // Rotate the session on privilege change to blunt session fixation.
        req.session.regenerate((regenErr) => {
            if (regenErr) return next(regenErr);
            req.login(user, (loginErr) => {
                if (loginErr) return next(loginErr);
                return res.redirect(landingFor(req, user));
            });
        });
    })(req, res, next);
};

exports.handleGoogleCallback = (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            if (info && info.profile) {
                req.session.oauthProfile = info.profile;
                return res.redirect('/choose-role');
            }
            req.flash('error', (info && info.message) || 'Google sign-in failed.');
            return res.redirect('/login');
        }

        if (user.status !== 'approved') {
            req.flash('error', PENDING_MESSAGE);
            return res.redirect('/login');
        }

        req.session.regenerate((regenErr) => {
            if (regenErr) return next(regenErr);
            req.login(user, (loginErr) => {
                if (loginErr) return next(loginErr);
                return res.redirect(landingFor(req, user));
            });
        });
    })(req, res, next);
};

exports.handleLogout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.session.destroy(() => {
            res.clearCookie('apex.sid');
            res.redirect('/');
        });
    });
};
