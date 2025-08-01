const Notification = require('../models/notification');

exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        
        if (!notification || notification.userId.toString() !== req.user._id.toString()) {
            return res.status(403).send('Access denied.');
        }

        notification.status = 'read';
        await notification.save();

        res.redirect(req.header('Referer') || '/');

    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.redirect('/');
    }
};
exports.renderNotificationsPage = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        
        res.render('notifications', { notifications });
    } catch (error) {
        console.error("Error fetching notifications page:", error);
        res.status(500).send("Error loading notifications.");
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        
        if (!notification || notification.userId.toString() !== req.user._id.toString()) {
            return res.status(403).send('Access denied.');
        }

        notification.status = 'read';
        await notification.save();

        res.redirect(req.header('Referer') || '/');

    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.redirect('/');
    }
}