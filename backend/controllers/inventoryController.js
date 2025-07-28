const Item = require('../models/item');       // Corrected Path
const Stock = require('../models/stock');     // Corrected Path
const Delivery = require('../models/delivery'); // Corrected Path

// ... rest of the file is the same
exports.getAllItems = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        let query = {};
        if (searchQuery) { const regex = new RegExp(searchQuery, 'i'); query = { $or: [{ name: regex }, { sku: regex }] }; }
        const items = await Item.find(query).sort({ name: 1 });
        res.render('inventory', { items, searchQuery });
    } catch (error) { res.status(500).send("Error fetching inventory."); }
};
exports.renderAddItemForm = async (req, res) => {
    try {
        const stocks = await Stock.find().sort({ name: 1 });
        res.render('add-item', { error: null, stocks });
    } catch (error) { res.status(500).send("Error loading form."); }
};
exports.createItem = async (req, res) => {
    const { stockId, newStockName, sku, quantity, location, price } = req.body;
    const stocks = await Stock.find().sort({ name: 1 });

    try {
        let currentStock;
        if (newStockName) {
            let stock = await Stock.findOne({ name: { $regex: new RegExp(`^${newStockName}$`, 'i') } });
            if (!stock) { stock = await Stock.create({ name: newStockName }); }
            currentStock = stock;
        } else if (stockId) {
            currentStock = await Stock.findById(stockId);
        }

        if (!currentStock) {
            return res.render('add-item', { error: 'You must select an existing stock name or create a new one.', stocks });
        }

        const existingItem = await Item.findOne({ stockId: currentStock._id, sku: sku });
        const quantityToAdd = Number(quantity);
        const itemPrice = Number(price);

        if (isNaN(itemPrice) || isNaN(quantityToAdd)) {
            return res.render('add-item', { error: 'Price and Quantity must be valid numbers.', stocks });
        }

        if (existingItem) {
            // Case A: Restock existing item. Increment both counts.
            existingItem.availableStock += quantityToAdd;
            existingItem.totalStock += quantityToAdd; // Also increment total stock
            existingItem.price = itemPrice;
            existingItem.location = location;
            await existingItem.save();
        } else {
            // Case B: Create a new item. Both counts start the same.
            await Item.create({
                stockId: currentStock._id,
                name: currentStock.name,
                sku,
                availableStock: quantityToAdd,
                totalStock: quantityToAdd, // Total stock is the initial amount
                location,
                price: itemPrice
            });
        }
        
        res.redirect('/inventory');
    } catch (error) {
        if (error.code === 11000) {
            return res.render('add-item', { error: `An item with this Stock Name and SKU combination already exists.`, stocks });
        }
        console.error("Error in createItem:", error);
        res.render('add-item', { error: 'An unexpected database error occurred.' });
    }
};
exports.renderEditItemForm = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        const allStocks = await Stock.find().sort({ name: 1 });
        if (!item) return res.status(404).send("Item not found.");
        res.render('edit-item', { item, allStocks, error: null });
    } catch (error) { res.status(404).send("Item not found."); }
};
exports.updateItem = async (req, res) => {
    try {
        const { stockId, price, availableStock, totalStock } = req.body;
        const stock = await Stock.findById(stockId);
        if (!stock) { return res.status(400).send("Invalid stock category selected."); }

        const updateData = {
            ...req.body,
            name: stock.name,
            price: Number(price),
            availableStock: Number(availableStock),
            totalStock: Number(totalStock)
        };

        await Item.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/inventory');
    } catch (error) {
        const item = await Item.findById(req.params.id);
        const allStocks = await Stock.find().sort({ name: 1 });
        if (error.code === 11000) {
            return res.render('edit-item', { item, allStocks, error: `Another item with that Stock Name and SKU already exists.` });
        }
        res.status(500).send("An error occurred while updating.");
    }
};
exports.deleteItem = async (req, res) => {
    try {
        const itemId = req.params.id;
        const deliveryWithItem = await Delivery.findOne({ 'items.itemId': itemId });
        if (deliveryWithItem) { return res.redirect('/inventory?error=Cannot+delete+item+because+it+is+part+of+an+existing+delivery.'); }
        await Item.findByIdAndDelete(itemId);
        res.redirect('/inventory');
    } catch (error) {
        console.error("Error deleting item:", error);
        res.redirect('/inventory?error=An+error+occurred+during+deletion.');
    }
};