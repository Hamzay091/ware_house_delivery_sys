const User = require('../models/user');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator'); // Import the result handler

// The render functions now need to handle potential errors passed to them
exports.renderRegisterPage = (req, res) => res.render('register', { errors: [] }); // Pass empty array initially
exports.renderLoginPage = (req, res) => res.render('login', { error: null, errors: [] }); // Pass empty array initially

// --- NEW handleRegister FUNCTION ---
exports.handleRegister = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // If there are errors, re-render the register page with the errors
        return res.status(400).render('register', { errors: errors.array() });
    }

    try {
        // Check if user already exists
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


// --- NEW handleLogin FUNCTION ---
exports.handleLogin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // If there are validation errors (e.g., bad email format)
        return res.status(400).render('login', { error: null, errors: errors.array() });
    }

    try {
        const user = await User.findOne({ email: req.body.email });

        // Secure Login: Check for user *and then* password to prevent revealing which one was wrong
        if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
            return res.status(401).render('login', { 
                error: 'Invalid email or password.', 
                errors: [] 
            });
        }

        req.session.user = user;
        const redirectUrl = { 
            Admin: '/admin-dashboard', 
            Manager: '/manager-dashboard', 
            DeliveryStaff: '/delivery-staff-dashboard' 
        }[user.role];
        return res.redirect(redirectUrl);

    } catch (error) {
        return res.status(500).render('login', { 
            error: 'An unexpected server error occurred.', 
            errors: [] 
        });
    }
};

exports.handleLogout = (req, res) => {
    req.session.destroy(() => res.redirect('/'));
};