const User = require('../models/user');
const Item = require('../models/item');
const Delivery = require('../models/delivery');
const { createLowStockAlert } = require('../utils/notificationService');

const STOCK_THRESHOLD = 10;
const STAFF_ALLOWED_STATUSES = ['In Transit', 'Delivered', 'Failed'];

/**
 * Reserves stock for an order.
 *
 * Each decrement is a conditional update — it only applies while enough stock
 * is actually on hand — so two managers assigning the last units at the same
 * moment cannot both succeed. If any line fails, the lines already taken are
 * put back before returning.
 *
 * @returns {Promise<{ok: true, items: object[]} | {ok: false, message: string}>}
 */
async function reserveStock(quantitiesByItem) {
    const taken = [];

    const rollback = async () => {
        for (const entry of taken) {
            await Item.updateOne({ _id: entry.itemId }, { $inc: { availableStock: entry.quantity } });
        }
    };

    for (const [itemId, quantity] of Object.entries(quantitiesByItem)) {
        let updated;
        try {
            updated = await Item.findOneAndUpdate(
                { _id: itemId, availableStock: { $gte: quantity } },
                { $inc: { availableStock: -quantity } },
                { new: true }
            );
        } catch (err) {
            await rollback();
            return { ok: false, message: 'One of the selected items could not be found.' };
        }

        if (!updated) {
            await rollback();
            const item = await Item.findById(itemId);
            if (!item) return { ok: false, message: 'One of the selected items no longer exists.' };
            return {
                ok: false,
                message: `Not enough stock for "${item.name}". Requested ${quantity}, available ${item.availableStock}.`
            };
        }

        taken.push({ itemId, quantity, item: updated });
    }

    return { ok: true, items: taken };
}

/** Returns reserved stock to the shelf, e.g. when a delivery fails. */
async function releaseStock(delivery) {
    for (const line of delivery.items) {
        if (!line.itemId) continue;
        const id = line.itemId._id || line.itemId;
        await Item.updateOne({ _id: id }, { $inc: { availableStock: line.quantity } });
    }
}

exports.renderAssignForm = async (req, res, next) => {
    try {
        const [staffList, itemsInStock] = await Promise.all([
            User.find({ role: 'DeliveryStaff' }).sort({ name: 1 }),
            Item.find({ availableStock: { $gt: 0 } }).populate('stockId').sort({ name: 1 })
        ]);

        // One aggregate instead of a query per staff member.
        const workloads = await Delivery.aggregate([
            { $match: { status: { $in: ['Pending', 'In Transit'] } } },
            { $group: { _id: '$assignedToId', count: { $sum: 1 } } }
        ]);
        const workloadById = new Map(
            workloads.filter(w => w._id).map(w => [String(w._id), w.count])
        );

        const staffWithWorkload = staffList.map(staff => ({
            ...staff.toObject(),
            workload: workloadById.get(String(staff._id)) || 0
        }));

        // Recommend whoever currently has the least on their plate.
        let recommendedStaffId = null;
        let lowest = Infinity;
        staffWithWorkload.forEach(staff => {
            if (staff.workload < lowest) {
                lowest = staff.workload;
                recommendedStaffId = String(staff._id);
            }
        });

        res.render('assign-delivery', {
            title: 'Assign a delivery',
            staff: staffWithWorkload,
            items: itemsInStock,
            itemsJSON: JSON.stringify(
                itemsInStock.map(i => ({
                    _id: i._id,
                    name: i.name,
                    sku: i.sku,
                    availableStock: i.availableStock
                }))
            ).replace(/</g, '\\u003c'),
            recommendedStaffId,
            errors: []
        });
    } catch (error) {
        next(error);
    }
};

exports.createDelivery = async (req, res, next) => {
    const { assignedTo, customerAddress, items } = req.body;

    const fail = (message) => {
        req.flash('error', message);
        return res.redirect('/deliveries/assign');
    };

    try {
        if (!customerAddress || !String(customerAddress).trim()) {
            return fail('A customer address is required.');
        }

        const staff = await User.findOne({ _id: assignedTo, role: 'DeliveryStaff' })
            .catch(() => null);
        if (!staff) return fail('Choose a delivery staff member to assign this order to.');

        const rawItems = Array.isArray(items) ? items : (items ? Object.values(items) : []);
        const validItems = rawItems.filter(
            line => line && line.itemId && Number(line.quantity) > 0
        );
        if (validItems.length === 0) return fail('Add at least one item with a quantity.');

        // Collapse duplicate lines so the stock check covers the true total.
        const quantitiesByItem = {};
        for (const line of validItems) {
            const quantity = Math.floor(Number(line.quantity));
            if (!Number.isFinite(quantity) || quantity < 1) {
                return fail('Quantities must be whole numbers of one or more.');
            }
            quantitiesByItem[line.itemId] = (quantitiesByItem[line.itemId] || 0) + quantity;
        }

        const reservation = await reserveStock(quantitiesByItem);
        if (!reservation.ok) return fail(reservation.message);

        try {
            await Delivery.create({
                assignedTo: staff.name,
                assignedToId: staff._id,
                customerAddress: String(customerAddress).trim(),
                items: Object.entries(quantitiesByItem)
                    .map(([itemId, quantity]) => ({ itemId, quantity })),
                statusHistory: [{
                    status: 'Pending',
                    changedBy: req.user.name,
                    changedAt: new Date()
                }]
            });
        } catch (createError) {
            // Never leave stock reserved against an order that was not saved.
            for (const entry of reservation.items) {
                await Item.updateOne(
                    { _id: entry.itemId },
                    { $inc: { availableStock: entry.quantity } }
                );
            }
            throw createError;
        }

        // Alert once the reservation has actually gone through.
        for (const entry of reservation.items) {
            const before = entry.item.availableStock + entry.quantity;
            if (before >= STOCK_THRESHOLD && entry.item.availableStock < STOCK_THRESHOLD) {
                await createLowStockAlert(entry.item);
            }
        }

        req.flash('success', `Delivery assigned to ${staff.name}.`);
        res.redirect('/manager-dashboard');
    } catch (error) {
        next(error);
    }
};

exports.updateDeliveryStatus = async (req, res, next) => {
    try {
        const delivery = await Delivery.findById(req.params.id);
        if (!delivery) {
            req.flash('error', 'That delivery no longer exists.');
            return res.redirect('/delivery-staff-dashboard');
        }

        // Delivery staff may only touch their own assignments. Without this,
        // any signed-in staff member could mark any delivery in the system as
        // delivered just by knowing its id.
        const isOwner = delivery.assignedToId
            ? delivery.assignedToId.equals(req.user._id)
            : delivery.assignedTo === req.user.name;

        if (req.user.role === 'DeliveryStaff' && !isOwner) {
            const err = new Error('This delivery is not assigned to you.');
            err.status = 403;
            return next(err);
        }

        const nextStatus = req.body.status;
        if (!STAFF_ALLOWED_STATUSES.includes(nextStatus)) {
            req.flash('error', 'That is not a valid delivery status.');
            return res.redirect('/delivery-staff-dashboard');
        }

        if (delivery.status === nextStatus) {
            req.flash('info', `This delivery is already marked "${nextStatus}".`);
            return res.redirect('/delivery-staff-dashboard');
        }

        // Delivered and Failed are terminal — reopening one would need the
        // stock reservation to be recalculated, so it is not allowed here.
        if (delivery.status === 'Delivered' || delivery.status === 'Failed') {
            req.flash('error', `This delivery is already closed as "${delivery.status}".`);
            return res.redirect('/delivery-staff-dashboard');
        }

        // A failed delivery never left the warehouse, so its units go back on
        // the shelf. A completed one has genuinely shipped.
        if (nextStatus === 'Failed' && !delivery.stockReleased) {
            await releaseStock(delivery);
            delivery.stockReleased = true;
        }
        if (nextStatus === 'Delivered') {
            delivery.stockReleased = true;
        }

        delivery.status = nextStatus;
        delivery.statusHistory.push({
            status: nextStatus,
            changedBy: req.user.name,
            changedAt: new Date()
        });
        await delivery.save();

        req.flash('success', `Delivery marked as "${nextStatus}".`);
        res.redirect('/delivery-staff-dashboard');
    } catch (error) {
        next(error);
    }
};
