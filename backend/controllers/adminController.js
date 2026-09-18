const User = require('../models/user');
const Delivery = require('../models/delivery');
const dashboardController = require('./dashboardController');
const { searchRegex, paginate, pageMeta } = require('../utils/query');

const renderUserList = async (req, res, next, role, pageTitle) => {
    try {
        // Only approved accounts appear in the oversight lists; anyone still
        // waiting lives on the user-management page until they are let in.
        const filter = { role, status: 'approved' };
        const regex = searchRegex(req.query.search);
        if (regex) filter.$or = [{ name: regex }, { email: regex }];

        const page = paginate(req.query);
        const [users, total] = await Promise.all([
            User.find(filter).sort({ name: 1 }).skip(page.skip).limit(page.limit),
            User.countDocuments(filter)
        ]);

        // Active workload per user, so the list is useful at a glance.
        const workloads = await Delivery.aggregate([
            {
                $match: {
                    assignedToId: { $in: users.map(u => u._id) },
                    status: { $in: ['Pending', 'In Transit'] }
                }
            },
            { $group: { _id: '$assignedToId', count: { $sum: 1 } } }
        ]);
        const workloadById = new Map(workloads.map(w => [String(w._id), w.count]));

        res.render('admin-user-list', {
            title: pageTitle,
            heading: pageTitle,
            users: users.map(u => ({ ...u.toObject(), workload: workloadById.get(String(u._id)) || 0 })),
            filters: { search: req.query.search || '' },
            pagination: pageMeta(page, total, req.query)
        });
    } catch (error) {
        next(error);
    }
};

exports.viewAllManagers = (req, res, next) =>
    renderUserList(req, res, next, 'Manager', 'Managers');

exports.viewAllDeliveryStaff = (req, res, next) =>
    renderUserList(req, res, next, 'DeliveryStaff', 'Delivery staff');

exports.viewUserDetail = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error', 'That user no longer exists.');
            return res.redirect('/users/manage');
        }

        const deliveries = await Delivery.find({
            $or: [{ assignedToId: user._id }, { assignedTo: user.name }]
        })
            .populate({ path: 'items.itemId', model: 'Item' })
            .sort({ createdAt: -1 })
            .limit(100);

        const statusCounts = { Pending: 0, 'In Transit': 0, Delivered: 0, Failed: 0 };
        deliveries.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });

        res.render('admin-user-detail', {
            title: user.name,
            user: req.user,
            profile: user,
            deliveries,
            statusCounts
        });
    } catch (error) {
        next(error);
    }
};

/** Renders the manager dashboard from an admin's session, read-only. */
exports.viewAsManager = (req, res, next) => {
    req.isAdminView = true;
    return dashboardController.renderManagerDashboard(req, res, next);
};
