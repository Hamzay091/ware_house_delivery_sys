const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: false 
    },
    status: {
        type: String,
        enum: ['unread', 'read'],
        default: 'unread'
    }
}, { timestamps: true });  

module.exports = mongoose.model('Notification', notificationSchema);