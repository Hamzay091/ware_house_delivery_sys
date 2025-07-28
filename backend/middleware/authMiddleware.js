exports.isAuthenticated = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

exports.isManagerOrAdmin = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'Admin' || req.session.user.role === 'Manager')) return next();
    res.status(403).send("Access Denied.");
};

exports.isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Admin') return next();
    res.status(403).send("Access Denied.");
};

exports.isDeliveryStaff = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'DeliveryStaff') return next();
    res.status(403).send("Access Denied.");
};