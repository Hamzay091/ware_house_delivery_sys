const Contact = require('../models/contact');

exports.markMessageAsRead = async (req, res) => {
    try {
        await Contact.findByIdAndUpdate(req.params.id, { status: 'Read' });
        res.redirect('/view-messages');
    } catch (error) {
        console.error("Error marking message as read:", error);
        res.redirect('/view-messages?error=Could+not+update+message+status.');
    }
};