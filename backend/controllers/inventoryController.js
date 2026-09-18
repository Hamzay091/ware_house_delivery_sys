const Item = require('../models/item');
const Stock = require('../models/stock');
const Delivery = require('../models/delivery');
const { createLowStockAlert } = require('../utils/notificationService');
const { searchRegex, paginate, sortSpec, pageMeta, sortLink, escapeRegex } = require('../utils/query');
const { sendCsv } = require('../utils/csv');

const STOCK_THRESHOLD = 10;

/** Shared filter builder so the list view and the CSV export always agree. */
function buildFilter(query) {
    const filter = {};
    const regex = searchRegex(query.search);
    if (regex) filter.$or = [{ name: regex }, { sku: regex }, { location: regex }];

    if (query.stockId) filter.stockId = query.stockId;

    if (query.status === 'out') filter.availableStock = { $lte: 0 };
    else if (query.status === 'low') filter.availableStock = { $gt: 0, $lt: STOCK_THRESHOLD };
    else if (query.status === 'ok') filter.availableStock = { $gte: STOCK_THRESHOLD };

    return filter;
}

exports.getAllItems = async (req, res, next) => {
    try {
        const filter = buildFilter(req.query);
        const page = paginate(req.query);
        const sort = sortSpec(
            req.query,
            ['name', 'sku', 'price', 'availableStock', 'totalStock', 'forecast.daysOfStockLeft'],
            'name'
        );

        const [items, total, stocks, lowCount, outCount] = await Promise.all([
            Item.find(filter).sort(sort.spec).skip(page.skip).limit(page.limit),
            Item.countDocuments(filter),
            Stock.find().sort({ name: 1 }),
            Item.countDocuments({ availableStock: { $gt: 0, $lt: STOCK_THRESHOLD } }),
            Item.countDocuments({ availableStock: { $lte: 0 } })
        ]);

        res.render('inventory', {
            title: 'Inventory',
            items,
            stocks,
            threshold: STOCK_THRESHOLD,
            counts: { low: lowCount, out: outCount },
            filters: {
                search: req.query.search || '',
                stockId: req.query.stockId || '',
                status: req.query.status || ''
            },
            pagination: pageMeta(page, total, req.query),
            sort,
            sortHref: (field) => sortLink(req.query, field, sort.field, sort.dir)
        });
    } catch (error) {
        next(error);
    }
};

exports.exportItems = async (req, res, next) => {
    try {
        const items = await Item.find(buildFilter(req.query)).sort({ name: 1 }).limit(10000);
        const rows = items.map(item => ([
            item.name,
            item.sku,
            item.totalStock,
            item.availableStock,
            (item.price || 0).toFixed(2),
            item.location || '',
            item.forecast && typeof item.forecast.dailyBurnRate === 'number'
                ? item.forecast.dailyBurnRate : '',
            item.forecast && Number.isFinite(item.forecast.daysOfStockLeft)
                ? item.forecast.daysOfStockLeft : ''
        ]));

        sendCsv(
            res,
            `inventory-${new Date().toISOString().slice(0, 10)}.csv`,
            ['Name', 'SKU', 'Total stock', 'Available stock', 'Unit price',
             'Location', 'Daily burn rate', 'Days of stock left'],
            rows
        );
    } catch (error) {
        next(error);
    }
};

exports.renderAddItemForm = async (req, res, next) => {
    try {
        const stocks = await Stock.find().sort({ name: 1 });
        res.render('add-item', { title: 'Add or restock an item', errors: [], stocks, values: {} });
    } catch (error) {
        next(error);
    }
};

exports.createItem = async (req, res, next) => {
    const { stockId, newStockName, sku, quantity, location, price } = req.body;

    const reject = async (msg) => {
        const stocks = await Stock.find().sort({ name: 1 });
        return res.status(400).render('add-item', {
            title: 'Add or restock an item',
            errors: [{ msg }],
            stocks,
            values: { stockId, newStockName, sku, quantity, location, price }
        });
    };

    try {
        const quantityToAdd = Number(quantity);
        const itemPrice = Number(price);

        if (!Number.isFinite(quantityToAdd) || quantityToAdd < 0) {
            return reject('Quantity must be zero or a positive number.');
        }
        if (!Number.isFinite(itemPrice) || itemPrice < 0) {
            return reject('Price must be zero or a positive number.');
        }
        if (!sku || !String(sku).trim()) {
            return reject('A SKU is required.');
        }

        let currentStock = null;
        if (newStockName && String(newStockName).trim()) {
            const trimmed = String(newStockName).trim();
            currentStock = await Stock.findOne({
                name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') }
            });
            if (!currentStock) currentStock = await Stock.create({ name: trimmed });
        } else if (stockId) {
            currentStock = await Stock.findById(stockId);
        }

        if (!currentStock) {
            return reject('Select an existing stock name or type a new one.');
        }

        const cleanSku = String(sku).trim();

        // A single atomic upsert: two managers restocking the same SKU at the
        // same moment both have their quantities counted.
        const updated = await Item.findOneAndUpdate(
            { stockId: currentStock._id, sku: cleanSku },
            {
                $inc: { availableStock: quantityToAdd, totalStock: quantityToAdd },
                $set: {
                    name: currentStock.name,
                    price: itemPrice,
                    location: String(location || '').trim()
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
        );

        req.flash('success', `${currentStock.name} (${cleanSku}) now has ${updated.availableStock} units available.`);
        res.redirect('/inventory');
    } catch (error) {
        if (error.code === 11000) {
            return reject('An item with that stock name and SKU already exists.');
        }
        next(error);
    }
};

exports.renderEditItemForm = async (req, res, next) => {
    try {
        const [item, allStocks] = await Promise.all([
            Item.findById(req.params.id),
            Stock.find().sort({ name: 1 })
        ]);
        if (!item) {
            req.flash('error', 'That item no longer exists.');
            return res.redirect('/inventory');
        }
        res.render('edit-item', { title: `Edit ${item.name}`, item, allStocks, errors: [] });
    } catch (error) {
        next(error);
    }
};

exports.updateItem = async (req, res, next) => {
    const reject = async (msg) => {
        const [item, allStocks] = await Promise.all([
            Item.findById(req.params.id),
            Stock.find().sort({ name: 1 })
        ]);
        return res.status(400).render('edit-item', {
            title: 'Edit item',
            item,
            allStocks,
            errors: [{ msg }]
        });
    };

    try {
        const item = await Item.findById(req.params.id);
        if (!item) {
            req.flash('error', 'That item no longer exists.');
            return res.redirect('/inventory');
        }

        const { stockId, sku, price, availableStock, totalStock, location } = req.body;

        const stock = await Stock.findById(stockId);
        if (!stock) return reject('Choose a valid stock category.');

        const nextPrice = Number(price);
        const nextAvailable = Number(availableStock);
        const nextTotal = Number(totalStock);

        if (![nextPrice, nextAvailable, nextTotal].every(n => Number.isFinite(n) && n >= 0)) {
            return reject('Price and stock levels must be zero or positive numbers.');
        }
        if (nextAvailable > nextTotal) {
            return reject('Available stock cannot exceed total stock.');
        }

        const previousStock = item.availableStock;

        // Explicit assignment — the previous version spread req.body into the
        // update, so any extra field posted would be written to the document.
        item.stockId = stock._id;
        item.name = stock.name;
        item.sku = String(sku).trim();
        item.price = nextPrice;
        item.availableStock = nextAvailable;
        item.totalStock = nextTotal;
        item.location = String(location || '').trim();
        await item.save();

        if (previousStock >= STOCK_THRESHOLD && item.availableStock < STOCK_THRESHOLD) {
            await createLowStockAlert(item);
        }

        req.flash('success', `${item.name} was updated.`);
        res.redirect('/inventory');
    } catch (error) {
        if (error.code === 11000) {
            return reject('Another item already uses that stock name and SKU.');
        }
        next(error);
    }
};

exports.deleteItem = async (req, res, next) => {
    try {
        const itemId = req.params.id;

        const inUse = await Delivery.findOne({ 'items.itemId': itemId });
        if (inUse) {
            req.flash('error', 'This item appears on an existing delivery and cannot be deleted.');
            return res.redirect('/inventory');
        }

        const deleted = await Item.findByIdAndDelete(itemId);
        if (!deleted) {
            req.flash('error', 'That item no longer exists.');
        } else {
            req.flash('success', `${deleted.name} (${deleted.sku}) was deleted.`);
        }
        res.redirect('/inventory');
    } catch (error) {
        next(error);
    }
};
