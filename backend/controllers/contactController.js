const Contact = require('../models/contact');

/**
 * Marks a contact-form submission as read.
 *
 * The route is POST and carries the session CSRF token, so a message cannot
 * be flipped to Read by a link, a prefetch or a cross-site form post.
 */
exports.markMessageAsRead = async (req, res, next) => {
    try {
        const updated = await Contact.findOneAndUpdate(
            { _id: req.params.id, status: 'New' },
            { $set: { status: 'Read' } },
            { new: true }
        );

        if (!updated) {
            req.flash('info', 'That message was already read, or no longer exists.');
        } else {
            req.flash('success', `Message from ${updated.name} marked as read.`);
        }

        res.redirect('/view-messages');
    } catch (error) {
        next(error);
    }
};

exports.markAllAsRead = async (req, res, next) => {
    try {
        const result = await Contact.updateMany({ status: 'New' }, { $set: { status: 'Read' } });
        req.flash('success', `${result.modifiedCount} message(s) marked as read.`);
        res.redirect('/view-messages');
    } catch (error) {
        next(error);
    }
};
