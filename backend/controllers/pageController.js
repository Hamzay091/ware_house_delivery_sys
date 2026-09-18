const { validationResult } = require('express-validator');

const Item = require('../models/item');
const Contact = require('../models/contact');
const Delivery = require('../models/delivery');
const User = require('../models/user');
const { searchRegex } = require('../utils/query');

exports.renderHomePage = async (req, res, next) => {
    try {
        // A few real numbers beat invented marketing figures on the hero.
        const [items, deliveries, staff] = await Promise.all([
            Item.countDocuments(),
            Delivery.countDocuments(),
            User.countDocuments({ role: 'DeliveryStaff' })
        ]);

        res.render('index', {
            title: null,
            errors: [],
            values: {},
            highlights: { items, deliveries, staff }
        });
    } catch (error) {
        next(error);
    }
};

exports.handleContactForm = async (req, res, next) => {
    const errors = validationResult(req);
    const values = { name: req.body.name, email: req.body.email, message: req.body.message };

    if (!errors.isEmpty()) {
        const [items, deliveries, staff] = await Promise.all([
            Item.countDocuments(), Delivery.countDocuments(), User.countDocuments({ role: 'DeliveryStaff' })
        ]);
        return res.status(400).render('index', {
            title: null,
            errors: errors.array(),
            values,
            highlights: { items, deliveries, staff }
        });
    }

    try {
        // Only the three fields the form actually offers — `status` stays at
        // its default rather than being settable from the request.
        await Contact.create({
            name: String(req.body.name).trim(),
            email: String(req.body.email).toLowerCase().trim(),
            message: String(req.body.message).trim()
        });

        req.flash('success', 'Thanks for getting in touch — we will reply soon.');
        res.redirect('/#contact');
    } catch (error) {
        next(error);
    }
};

exports.renderProfilePage = (req, res) => res.render('profile', { title: 'My profile' });

exports.renderStockCataloguePage = async (req, res, next) => {
    try {
        const filter = {};
        const regex = searchRegex(req.query.search);
        if (regex) filter.$or = [{ name: regex }, { sku: regex }, { location: regex }];
        if (req.query.availability === 'in') filter.availableStock = { $gt: 0 };
        if (req.query.availability === 'out') filter.availableStock = { $lte: 0 };

        const items = await Item.find(filter)
            .populate('stockId')
            .sort({ name: 1, sku: 1 })
            .limit(500);

        res.render('stock-catalogue', {
            title: 'Stock catalogue',
            items,
            filters: {
                search: req.query.search || '',
                availability: req.query.availability || ''
            }
        });
    } catch (error) {
        next(error);
    }
};
