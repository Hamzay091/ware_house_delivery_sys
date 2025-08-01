const User = require('../models/user');
const Item = require('../models/item');
const Delivery = require('../models/delivery');
const Contact = require('../models/contact');
const Notification = require('../models/notification');

exports.renderAdminDashboard = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id, status: 'unread' }).sort({ createdAt: -1 });

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const deliveryStats = await Delivery.aggregate([
            { $match: { createdAt: { $gte: startOfToday } } },
            {
                $group: {
                    _id: { $hour: { date: "$createdAt", timezone: "Asia/Karachi" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const deliveryLabels = Array.from({ length: 24 }, (_, i) => {
            if (i === 0) return "12 AM";
            if (i < 12) return `${i} AM`;
            if (i === 12) return "12 PM";
            return `${i - 12} PM`;
        });
        const deliveryValues = Array(24).fill(0);
        deliveryStats.forEach(stat => {
            deliveryValues[stat._id] = stat.count;
        });
        

        const stockStats = await Item.aggregate([
            { $lookup: { from: 'stocks', localField: 'stockId', foreignField: '_id', as: 'stock' } },
            { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },
            { 
                $group: { 
                    _id: { $ifNull: ['$stock.name', 'Uncategorized'] }, 
                    totalQuantity: { $sum: '$totalStock' } 
                } 
            },
            { $sort: { totalQuantity: -1 } }
        ]);
        
        const chartData = {
            deliveryLabels,
            deliveryValues,
            stockLabels: stockStats.map(stat => stat._id),
            stockValues: stockStats.map(stat => stat.totalQuantity)
        };

        const chartDataJSON = JSON.stringify(chartData).replace(/</g, '\\u003c');
        const stats = { 
            users: await User.countDocuments(), 
            items: await Item.countDocuments(), 
            deliveries: await Delivery.countDocuments(), 
            pending: await Delivery.countDocuments({ status: 'Pending' }) 
        };
        
        res.render('dashboard-admin', { stats, chartDataJSON, notifications });

    } catch (error) {
        console.error("Error rendering admin dashboard:", error);
        res.render('dashboard-admin', { stats: {}, chartDataJSON: '{}', notifications: [] });
    }
};

exports.renderManagerDashboard = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id, status: 'unread' }).sort({ createdAt: -1 });

        const deliveries = await Delivery.find()
            .sort({ updatedAt: -1 })
            .populate({
                path: 'items.itemId',
                model: 'Item',
                populate: {
                    path: 'stockId',
                    model: 'Stock'
                }
            });
        res.render('dashboard-manager', { deliveries, notifications });
    } catch (error) {
        console.error("Error fetching manager dashboard deliveries:", error);
        res.status(500).send("Error loading manager dashboard.");
    }
};

exports.renderStaffDashboard = async (req, res) => {
    try {
        const deliveries = await Delivery.find({ assignedTo: req.user.name })
            .sort({ updatedAt: -1 })
            .populate({
                path: 'items.itemId',
                model: 'Item',
                populate: {
                    path: 'stockId',
                    model: 'Stock'
                }
            });
        res.render('dashboard-staff', { deliveries });
    } catch (error) {
        console.error("Error fetching staff dashboard deliveries:", error);
        res.status(500).send("Error loading staff dashboard.");
    }
};

exports.renderMessagesPage = async (req, res) => {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.render('view-messages', { messages });
};

exports.renderDeliveryReportsPage = async (req, res) => {
    try {
        const deliveries = await Delivery.find({})
            .sort({ createdAt: -1 })
            .populate({
                path: 'items.itemId',
                model: 'Item',
            });
        res.render('delivery-reports', { deliveries });
    } catch (error) {
        console.error("Error fetching delivery reports:", error);
        res.status(500).send("Error loading delivery reports page.");
    }
};