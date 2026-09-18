const Notification = require('../models/notification');
const { paginate, pageMeta } = require('../utils/query');

/** Only follow a Referer that points back into this app. */
function safeReferer(req, fallback) {
    const referer = req.get('Referer');
    if (!referer) return fallback;
    try {
        const url = new URL(referer, `${req.protocol}://${req.get('host')}`);
        if (url.host !== req.get('host')) return fallback;
        return url.pathname + url.search;
    } catch (err) {
        return fallback;
    }
}

exports.renderNotificationsPage = async (req, res, next) => {
    try {
        const filter = { userId: req.user._id };
        if (req.query.status === 'unread' || req.query.status === 'read') {
            filter.status = req.query.status;
        }

        const page = paginate(req.query);
        const [notifications, total, unread] = await Promise.all([
            Notification.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit),
            Notification.countDocuments(filter),
            Notification.countDocuments({ userId: req.user._id, status: 'unread' })
        ]);

        res.render('notifications', {
            title: 'Notifications',
            notifications,
            unread,
            filters: { status: req.query.status || '' },
            pagination: pageMeta(page, total, req.query)
        });
    } catch (error) {
        next(error);
    }
};

exports.markAsRead = async (req, res, next) => {
    try {
        // Scoping the update by userId means one user cannot mark another
        // user's notification as read by guessing its id.
        const result = await Notification.updateOne(
            { _id: req.params.id, userId: req.user._id },
            { $set: { status: 'read' } }
        );

        if (result.matchedCount === 0) {
            const err = new Error('That notification does not belong to you.');
            err.status = 403;
            return next(err);
        }

        res.redirect(safeReferer(req, '/notifications'));
    } catch (error) {
        next(error);
    }
};

exports.markAllAsRead = async (req, res, next) => {
    try {
        const result = await Notification.updateMany(
            { userId: req.user._id, status: 'unread' },
            { $set: { status: 'read' } }
        );
        req.flash('success', `${result.modifiedCount} notification(s) marked as read.`);
        res.redirect(safeReferer(req, '/notifications'));
    } catch (error) {
        next(error);
    }
};
