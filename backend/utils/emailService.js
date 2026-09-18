const nodemailer = require('nodemailer');
require('dotenv').config();

// Email is optional. Without credentials the app still runs and still raises
// in-app notifications; it just does not try (and fail) to send mail.
const emailEnabled = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const transporter = emailEnabled
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    })
    : null;

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

/**
 * Sends a low stock notification email.
 * @param {object} item - The item that is low on stock.
 * @param {string[]} recipientEmails - Addresses to notify.
 */
const sendLowStockNotification = async (item, recipientEmails) => {
    if (!emailEnabled) return;
    if (!recipientEmails || recipientEmails.length === 0) {
        console.log('No recipients found for the low stock notification.');
        return;
    }

    const name = escapeHtml(item.name);
    const sku = escapeHtml(item.sku);

    const mailOptions = {
        from: `"Apex Logistics" <${process.env.EMAIL_USER}>`,
        // bcc keeps recipients from seeing each other's addresses.
        bcc: recipientEmails.join(', '),
        subject: `Low stock alert: ${item.name}`,
        text:
            `Inventory alert\n\n` +
            `${item.name} (SKU ${item.sku}) is running low.\n` +
            `Remaining stock: ${item.availableStock} units.\n\n` +
            `Please reorder soon.\n`,
        html: `
            <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #1b0f0a;">
                <h2 style="margin: 0 0 8px;">Inventory alert</h2>
                <p style="color: #5c534e;">An item in the warehouse is running low on stock.</p>
                <table cellpadding="6" style="border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="color:#5c534e;">Item</td><td><strong>${name}</strong></td></tr>
                    <tr><td style="color:#5c534e;">SKU</td><td>${sku}</td></tr>
                    <tr><td style="color:#5c534e;">Remaining</td>
                        <td><strong style="color:#a63028;">${Number(item.availableStock)}</strong> units</td></tr>
                </table>
                <p style="color: #5c534e;">Please reorder this item soon.</p>
                <p style="color: #7d736d; font-size: 12px;">Apex Logistics Management System</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Low stock email sent for: ${item.name}`);
    } catch (error) {
        // A failed email must never break the inventory update that triggered it.
        console.error('Error sending the low stock email:', error.message);
    }
};

module.exports = { sendLowStockNotification, emailEnabled };
