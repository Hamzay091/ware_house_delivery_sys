const mongoose = require('mongoose');
const deliverySchema = new mongoose.Schema({
    assignedTo: String,
    customerAddress: { type: String, required: true },
    items: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        quantity: { type: Number, required: true }
    }],
    status: { type: String, enum: ['Pending', 'In Transit', 'Delivered', 'Failed'], default: 'Pending' },
}, { timestamps: true });
module.exports = mongoose.model('Delivery', deliverySchema);