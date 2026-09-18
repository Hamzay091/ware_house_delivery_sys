/**
 * Route guards. Denials are passed to the central error handler so the user
 * gets the styled error page rather than a bare string response.
 */
function deny(next, message) {
    const err = new Error(message || 'You do not have permission to view this page.');
    err.status = 403;
    return next(err);
}

exports.isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    // Remember where they were heading so login can send them back.
    if (req.method === 'GET' && req.session) req.session.returnTo = req.originalUrl;
    if (req.flash) req.flash('info', 'Please log in to continue.');
    return res.redirect('/login');
};

/** Builds a guard that requires the signed-in user to hold one of `roles`. */
const requireRole = (...roles) => (req, res, next) => {
    if (!req.isAuthenticated()) {
        if (req.method === 'GET' && req.session) req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    if (roles.includes(req.user.role)) return next();
    return deny(next);
};

exports.requireRole = requireRole;
exports.isAdmin = requireRole('Admin');
exports.isManagerOrAdmin = requireRole('Admin', 'Manager');
exports.isDeliveryStaff = requireRole('DeliveryStaff');
