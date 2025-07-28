const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    deliveryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
        required: true,
        unique: true // Each delivery can only have one invoice
    },
    customerAddress: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Unpaid', 'Paid', 'Void'],
        default: 'Unpaid'
    },
    invoiceDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);