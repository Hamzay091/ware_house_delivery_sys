const User = require('../models/user');
const Item = require('../models/item');
const Delivery = require('../models/delivery');
const Contact = require('../models/contact');
const Invoice = require('../models/invoice');
const Notification = require('../models/notification');
const { searchRegex, paginate, pageMeta } = require('../utils/query');
const { sendCsv } = require('../utils/csv');

const LOW_STOCK_THRESHOLD = 10;
const DELIVERY_STATUSES = ['Pending', 'In Transit', 'Delivered', 'Failed'];

/** Deliveries per day for the last `days` days, zero-filled. */
async function deliveriesByDay(days = 14) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const rows = await Delivery.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 }
            }
        }
    ]);

    const counts = new Map(rows.map(r => [r._id, r.count]));
    const labels = [];
    const values = [];
    for (let i = 0; i < days; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        const key = day.toISOString().slice(0, 10);
        labels.push(day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        values.push(counts.get(key) || 0);
    }
    return { labels, values };
}

exports.renderAdminDashboard = async (req, res, next) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [
            notifications,
            trend,
            stockStats,
            statusStats,
            users,
            items,
            deliveries,
            pending,
            deliveredToday,
            lowStock,
            outOfStock,
            revenue,
            newMessages,
            recentDeliveries
        ] = await Promise.all([
            Notification.find({ userId: req.user._id, status: 'unread' }).sort({ createdAt: -1 }).limit(5),
            deliveriesByDay(14),
            Item.aggregate([
                { $lookup: { from: 'stocks', localField: 'stockId', foreignField: '_id', as: 'stock' } },
                { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: { $ifNull: ['$stock.name', 'Uncategorised'] },
                        totalQuantity: { $sum: '$availableStock' }
                    }
                },
                { $sort: { totalQuantity: -1 } },
                { $limit: 7 }
            ]),
            Delivery.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            User.countDocuments(),
            Item.countDocuments(),
            Delivery.countDocuments(),
            Delivery.countDocuments({ status: 'Pending' }),
            Delivery.countDocuments({ status: 'Delivered', updatedAt: { $gte: startOfToday } }),
            Item.countDocuments({ availableStock: { $gt: 0, $lt: LOW_STOCK_THRESHOLD } }),
            Item.countDocuments({ availableStock: { $lte: 0 } }),
            Invoice.aggregate([
                { $match: { status: 'Paid' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Contact.countDocuments({ status: 'New' }),
            Delivery.find().sort({ updatedAt: -1 }).limit(6)
        ]);

        const statusCounts = {};
        DELIVERY_STATUSES.forEach(s => { statusCounts[s] = 0; });
        statusStats.forEach(row => { statusCounts[row._id] = row.count; });

        const chartData = {
            trendLabels: trend.labels,
            trendValues: trend.values,
            stockLabels: stockStats.map(s => s._id),
            stockValues: stockStats.map(s => s.totalQuantity),
            statusLabels: DELIVERY_STATUSES,
            statusValues: DELIVERY_STATUSES.map(s => statusCounts[s])
        };

        res.render('dashboard-admin', {
            title: 'Admin dashboard',
            stats: {
                users,
                items,
                deliveries,
                pending,
                deliveredToday,
                lowStock,
                outOfStock,
                newMessages,
                revenue: revenue.length ? revenue[0].total : 0
            },
            statusCounts,
            recentDeliveries,
            chartDataJSON: JSON.stringify(chartData).replace(/</g, '\\u003c'),
            notifications
        });
    } catch (error) {
        next(error);
    }
};

/** Shared filter for the manager dashboard and the delivery reports. */
function deliveryFilter(query) {
    const filter = {};
    const regex = searchRegex(query.search);
    if (regex) filter.$or = [{ customerAddress: regex }, { assignedTo: regex }];
    if (DELIVERY_STATUSES.includes(query.status)) filter.status = query.status;
    return filter;
}

exports.renderManagerDashboard = async (req, res, next) => {
    try {
        const filter = deliveryFilter(req.query);
        const page = paginate(req.query);

        const [notifications, deliveries, total, statusStats, unreadMessageCount] = await Promise.all([
            Notification.find({ userId: req.user._id, status: 'unread' }).sort({ createdAt: -1 }).limit(5),
            Delivery.find(filter)
                .sort({ updatedAt: -1 })
                .skip(page.skip)
                .limit(page.limit)
                .populate({ path: 'items.itemId', model: 'Item' }),
            Delivery.countDocuments(filter),
            Delivery.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            Contact.countDocuments({ status: 'New' })
        ]);

        const statusCounts = {};
        DELIVERY_STATUSES.forEach(s => { statusCounts[s] = 0; });
        statusStats.forEach(row => { statusCounts[row._id] = row.count; });

        // Which of these already have an invoice, so the button can say so.
        const delivered = deliveries.filter(d => d.status === 'Delivered').map(d => d._id);
        const invoices = delivered.length
            ? await Invoice.find({ deliveryId: { $in: delivered } }).select('deliveryId')
            : [];
        const invoicedIds = new Set(invoices.map(i => String(i.deliveryId)));

        res.render('dashboard-manager', {
            title: req.isAdminView ? 'Manager dashboard (admin view)' : 'Manager dashboard',
            deliveries,
            statusCounts,
            statuses: DELIVERY_STATUSES,
            invoicedIds,
            unreadMessageCount,
            isAdminView: Boolean(req.isAdminView),
            filters: { search: req.query.search || '', status: req.query.status || '' },
            pagination: pageMeta(page, total, req.query),
            notifications
        });
    } catch (error) {
        next(error);
    }
};

exports.renderStaffDashboard = async (req, res, next) => {
    try {
        // Match on the id, falling back to the denormalised name for
        // deliveries created before assignedToId existed.
        const mine = {
            $or: [{ assignedToId: req.user._id }, { assignedTo: req.user.name }]
        };

        const filter = { ...mine };
        if (DELIVERY_STATUSES.includes(req.query.status)) filter.status = req.query.status;
        else if (req.query.status !== 'all') filter.status = { $in: ['Pending', 'In Transit'] };

        const [deliveries, counts] = await Promise.all([
            Delivery.find(filter)
                .sort({ status: 1, updatedAt: -1 })
                .populate({ path: 'items.itemId', model: 'Item' }),
            Delivery.aggregate([
                { $match: mine },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ])
        ]);

        const statusCounts = {};
        DELIVERY_STATUSES.forEach(s => { statusCounts[s] = 0; });
        counts.forEach(row => { statusCounts[row._id] = row.count; });

        res.render('dashboard-staff', {
            title: 'My deliveries',
            deliveries,
            statusCounts,
            activeFilter: req.query.status || 'open'
        });
    } catch (error) {
        next(error);
    }
};

exports.renderMessagesPage = async (req, res, next) => {
    try {
        const page = paginate(req.query);
        const filter = {};
        const regex = searchRegex(req.query.search);
        if (regex) filter.$or = [{ name: regex }, { email: regex }, { message: regex }];

        const [messages, total, unreadMessageCount] = await Promise.all([
            Contact.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit),
            Contact.countDocuments(filter),
            Contact.countDocuments({ status: 'New' })
        ]);

        res.render('view-messages', {
            title: 'Contact messages',
            messages,
            unreadMessageCount,
            filters: { search: req.query.search || '' },
            pagination: pageMeta(page, total, req.query)
        });
    } catch (error) {
        next(error);
    }
};

exports.renderDeliveryReportsPage = async (req, res, next) => {
    try {
        const filter = deliveryFilter(req.query);
        const page = paginate(req.query);

        const [deliveries, total, statusStats] = await Promise.all([
            Delivery.find(filter)
                .sort({ createdAt: -1 })
                .skip(page.skip)
                .limit(page.limit)
                .populate({ path: 'items.itemId', model: 'Item' }),
            Delivery.countDocuments(filter),
            Delivery.aggregate([
                { $match: filter },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ])
        ]);

        const statusCounts = {};
        DELIVERY_STATUSES.forEach(s => { statusCounts[s] = 0; });
        statusStats.forEach(row => { statusCounts[row._id] = row.count; });

        res.render('delivery-reports', {
            title: 'Delivery reports',
            deliveries,
            statusCounts,
            statuses: DELIVERY_STATUSES,
            filters: { search: req.query.search || '', status: req.query.status || '' },
            pagination: pageMeta(page, total, req.query)
        });
    } catch (error) {
        next(error);
    }
};

exports.exportDeliveryReports = async (req, res, next) => {
    try {
        const deliveries = await Delivery.find(deliveryFilter(req.query))
            .sort({ createdAt: -1 })
            .limit(10000)
            .populate({ path: 'items.itemId', model: 'Item' });

        sendCsv(
            res,
            `deliveries-${new Date().toISOString().slice(0, 10)}.csv`,
            ['Created', 'Last updated', 'Destination', 'Assigned to', 'Status', 'Items', 'Units'],
            deliveries.map(d => ([
                new Date(d.createdAt).toISOString(),
                new Date(d.updatedAt).toISOString(),
                d.customerAddress,
                d.assignedTo,
                d.status,
                d.items
                    .map(line => `${line.quantity}x ${line.itemId ? line.itemId.name : '(deleted item)'}`)
                    .join('; '),
                d.items.reduce((sum, line) => sum + line.quantity, 0)
            ]))
        );
    } catch (error) {
        next(error);
    }
};
