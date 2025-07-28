const express = require('express');
const router = express.Router();
const Item = require('../models/item');
const Delivery = require('../models/delivery');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/chart-data', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

        const deliveryStats = await Delivery.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const stockStats = await Item.aggregate([
            { $lookup: { from: 'stocks', localField: 'stockId', foreignField: '_id', as: 'stock' } },
            { $unwind: '$stock' },
            { $group: { _id: '$stock.name', totalQuantity: { $sum: '$quantity' } } },
            { $sort: { totalQuantity: -1 } }
        ]);

        const chartData = {
            deliveryLabels: deliveryStats.map(stat => stat._id),
            deliveryValues: deliveryStats.map(stat => stat.count),
            stockLabels: stockStats.map(stat => stat._id),
            stockValues: stockStats.map(stat => stat.totalQuantity)
        };
        
        res.json(chartData);

    } catch (error) {
        console.error("API Error fetching chart data:", error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
});

module.exports = router;