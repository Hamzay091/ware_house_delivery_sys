const mongoose = require('mongoose');

const STATUSES = ['Pending', 'In Transit', 'Delivered', 'Failed'];

const deliverySchema = new mongoose.Schema({
    // assignedTo is the staff member's name. It is kept because existing
    // documents and the Python forecaster reference it, but assignedToId is
    // the authoritative link — names are not unique and change when a user
    // edits their profile.
    assignedTo: { type: String, required: true },
    assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    customerAddress: { type: String, required: true, trim: true },
    items: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        quantity: { type: Number, required: true, min: 1 }
    }],
    status: { type: String, enum: STATUSES, default: 'Pending', index: true },

    // Set once when the delivery leaves Pending for a terminal state, so the
    // stock-restore path can tell whether it has already run.
    stockReleased: { type: Boolean, default: false },

    statusHistory: [{
        status: { type: String, enum: STATUSES },
        changedBy: { type: String },
        changedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

deliverySchema.index({ createdAt: -1 });
deliverySchema.index({ status: 1, createdAt: -1 });

deliverySchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Delivery', deliverySchema);
