const User = require('../models/user');
const Notification = require('../models/notification');
const { sendLowStockNotification } = require('./emailService');

/**
 * Creates and sends low stock notifications to all Admins and Managers.
 * @param {object} item - The item object that is low on stock.
 */
const createLowStockAlert = async (item) => {
    try {
        const recipients = await User.find({ role: { $in: ['Admin', 'Manager'] } });
        if (recipients.length === 0) return;

        const notificationsToCreate = recipients.map(user => ({
            userId: user._id,
            message: `Stock for '${item.name}' (SKU: ${item.sku}) is low: ${item.availableStock} units remaining.`,
            link: `/inventory/edit/${item._id}`
        }));

        await Notification.insertMany(notificationsToCreate);

        const recipientEmails = recipients.map(user => user.email);
        await sendLowStockNotification(item, recipientEmails);

        console.log(`Successfully created ${recipients.length} in-app notifications for low stock.`);

    } catch (error) {
        console.error("Error creating low stock alert:", error);
    }
};

module.exports = { createLowStockAlert };