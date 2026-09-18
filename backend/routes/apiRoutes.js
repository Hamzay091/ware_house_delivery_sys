const express = require('express');

const Item = require('../models/item');
const Delivery = require('../models/delivery');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/chart-data', isAdmin, async (req, res, next) => {
    try {
        const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        since.setDate(since.getDate() - (days - 1));

        const [deliveryStats, stockStats] = await Promise.all([
            Delivery.aggregate([
                { $match: { createdAt: { $gte: since } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Item.aggregate([
                { $lookup: { from: 'stocks', localField: 'stockId', foreignField: '_id', as: 'stock' } },
                { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: { $ifNull: ['$stock.name', 'Uncategorised'] },
                        // This summed a non-existent `quantity` field before,
                        // so every slice came back as zero.
                        totalQuantity: { $sum: '$availableStock' }
                    }
                },
                { $sort: { totalQuantity: -1 } }
            ])
        ]);

        res.json({
            deliveryLabels: deliveryStats.map(stat => stat._id),
            deliveryValues: deliveryStats.map(stat => stat.count),
            stockLabels: stockStats.map(stat => stat._id),
            stockValues: stockStats.map(stat => stat.totalQuantity)
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
