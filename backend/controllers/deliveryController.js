const User = require('../models/user');
const Item = require('../models/item');
const Delivery = require('../models/delivery');

// This function is correct and does not need to be changed.
exports.renderAssignForm = async (req, res) => {
    try {
        const staffList = await User.find({ role: 'DeliveryStaff' });
        const itemsInStock = await Item.find({ availableStock: { $gt: 0 } }).populate('stockId');
        const itemsJSON = JSON.stringify(itemsInStock).replace(/</g, '\\u003c');
        
        let recommendedStaff = null;
        let lowestWorkload = Infinity;
        const staffWithWorkload = await Promise.all(staffList.map(async (staff) => {
            const workload = await Delivery.countDocuments({ assignedTo: staff.name, status: { $in: ['Pending', 'In Transit'] } });
            if (workload < lowestWorkload) {
                lowestWorkload = workload;
                recommendedStaff = staff;
            }
            return { ...staff.toObject(), workload };
        }));

        res.render('assign-delivery', {
            staff: staffWithWorkload,
            items: itemsInStock,
            itemsJSON,
            recommendedStaffId: recommendedStaff ? recommendedStaff._id.toString() : null,
            error: req.query.error
        });
    } catch (error) {
        console.error("Error in renderAssignForm:", error);
        res.status(500).send("Error loading the page.");
    }
};

// --- THIS IS THE FINAL, CORRECTED FUNCTION ---
exports.createDelivery = async (req, res) => {
    const { assignedTo, customerAddress, items } = req.body;
    if (!items) return res.redirect('/deliveries/assign?error=No+items+were+selected.');

    const validItems = items.filter(item => item.itemId && item.quantity && Number(item.quantity) > 0);
    if (validItems.length === 0) return res.redirect('/deliveries/assign?error=No+valid+items+were+provided.');

    try {
        // --- START OF NEW, ROBUST VALIDATION BLOCK ---

        // 1. Aggregate the total requested quantity for each unique item ID.
        const itemQuantities = {};
        for (const item of validItems) {
            const itemId = item.itemId;
            const quantity = Number(item.quantity);
            itemQuantities[itemId] = (itemQuantities[itemId] || 0) + quantity;
        }

        // 2. Check the aggregated totals against the database.
        for (const itemId in itemQuantities) {
            const totalRequested = itemQuantities[itemId];
            const itemInDb = await Item.findById(itemId);
            
            if (!itemInDb) {
                return res.redirect(`/deliveries/assign?error=An+item+in+your+order+could+not+be+found.`);
            }
            if (itemInDb.availableStock < totalRequested) {
                const errorMessage = `Not+enough+stock+for+'${itemInDb.name}'.+Requested:+${totalRequested},+Available:+${itemInDb.availableStock}.`;
                return res.redirect(`/deliveries/assign?error=${errorMessage}`);
            }
        }
        // --- END OF NEW, ROBUST VALIDATION BLOCK ---

        // If all validations pass, proceed with creating the delivery
        await Delivery.create({
            assignedTo,
            customerAddress,
            items: validItems.map(item => ({ itemId: item.itemId, quantity: Number(item.quantity) }))
        });

        // And then update the stock for each item
        for (const itemId in itemQuantities) {
            const totalToDecrement = itemQuantities[itemId];
            await Item.findByIdAndUpdate(itemId, { $inc: { availableStock: -totalToDecrement } });
        }

        res.redirect('/manager-dashboard');
    } catch (error) {
        console.error("Error creating delivery:", error);
        res.redirect(`/deliveries/assign?error=An+unexpected+server+error+occurred.`);
    }
};


exports.updateDeliveryStatus = async (req, res) => {
    await Delivery.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.redirect('/delivery-staff-dashboard');
};