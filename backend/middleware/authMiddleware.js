
exports.isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next(); 
    }
    res.redirect('/login');
};

exports.isManagerOrAdmin = (req, res, next) => {
    if (req.isAuthenticated() && (req.user.role === 'Admin' || req.user.role === 'Manager')) {
        return next();
    }
    res.status(403).send("Access Denied. You do not have permission to view this page.");
};

exports.isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'Admin') {
        return next();
    }
    res.status(403).send("Access Denied. You do not have permission to view this page.");
};

exports.isDeliveryStaff = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'DeliveryStaff') {
        return next();
    }
    res.status(403).send("Access Denied. You do not have permission to view this page.");
};