const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

/**
 * Sends a low stock notification email to a list of recipients.
 * @param {object} item - The item object that is low on stock.
 * @param {string[]} recipientEmails - An array of email addresses to send the notification to.
 */
const sendLowStockNotification = async (item, recipientEmails) => {
    if (!recipientEmails || recipientEmails.length === 0) {
        console.log("No recipients found for low stock notification.");
        return;
    }

    const mailOptions = {
        from: `"Apex Logistics System" <${process.env.EMAIL_USER}>`,
        to: recipientEmails.join(', '),
        subject: ` Low Stock Alert: ${item.name}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Inventory Alert</h2>
                <p>This is an automated notification to inform you that an item in the warehouse is running low on stock.</p>
                <hr>
                <h3>Item Details:</h3>
                <ul>
                    <li><strong>Item Name:</strong> ${item.name}</li>
                    <li><strong>SKU:</strong> ${item.sku}</li>
                    <li><strong>Remaining Stock:</strong> <strong style="color: #c0392b;">${item.availableStock}</strong> units</li>
                </ul>
                <p>Please take the necessary action to restock this item soon.</p>
                <p><em>Thank you, <br>Apex Logistics Management System</em></p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Low stock email sent successfully for item: ${item.name}`);
    } catch (error) {
        console.error(`Error sending low stock email:`, error);
    }
};

module.exports = { sendLowStockNotification };