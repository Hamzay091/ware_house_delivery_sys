/**
 * Seeds a database with a small but realistic data set.
 *
 * Used by `npm run demo` (against a throwaway in-memory server) and available
 * as `npm run seed` for a local MongoDB. It refuses to touch a database that
 * already has users unless --force is passed.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/user');
const Stock = require('../models/stock');
const Item = require('../models/item');
const Delivery = require('../models/delivery');
const Invoice = require('../models/invoice');
const Contact = require('../models/contact');
const Notification = require('../models/notification');

const CATEGORIES = [
    { name: 'Gaming headsets', description: 'Wired and wireless headsets' },
    { name: 'Mechanical keyboards', description: 'Full-size, TKL and 60%' },
    { name: 'Monitors', description: 'Desktop displays' },
    { name: 'Cables & adapters', description: 'Consumables and spares' },
    { name: 'Office chairs', description: 'Seating' }
];

const ITEMS = [
    ['Gaming headsets', 'RZR-KRAKEN-V3', 89.99, 140, 48, 'Aisle 1, Shelf A'],
    ['Gaming headsets', 'HX-CLOUD-II', 64.5, 90, 7, 'Aisle 1, Shelf B'],
    ['Mechanical keyboards', 'KC-K70-RGB', 149.0, 60, 22, 'Aisle 2, Shelf A'],
    ['Mechanical keyboards', 'DK-ONE3-TKL', 119.0, 45, 0, 'Aisle 2, Shelf B'],
    ['Monitors', 'LG-27GP850', 379.99, 30, 12, 'Aisle 3, Bay 1'],
    ['Monitors', 'DEL-U2723QE', 549.0, 18, 4, 'Aisle 3, Bay 2'],
    ['Cables & adapters', 'CBL-HDMI21-2M', 14.99, 500, 310, 'Aisle 4, Bin 7'],
    ['Cables & adapters', 'CBL-USBC-100W', 19.99, 400, 9, 'Aisle 4, Bin 8'],
    ['Office chairs', 'CHR-ERGO-PRO', 289.0, 24, 15, 'Aisle 5, Floor']
];

const ADDRESSES = [
    '221B Baker Street, London',
    '14 Model Town, Gujranwala',
    '900 Market Street, San Francisco',
    '5 Rue de Rivoli, Paris',
    '77 Collins Street, Melbourne',
    '32 Gulberg III, Lahore',
    '18 Alexanderplatz, Berlin',
    '410 Yonge Street, Toronto'
];

// Seven entries, so that cycling this alongside the three drivers does not
// line up — otherwise a given driver only ever receives one status.
const STATUS_CYCLE = [
    'Delivered', 'Pending', 'Delivered', 'In Transit', 'Failed', 'Delivered', 'Pending'
];

function daysAgo(n) {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date;
}

async function seed({ force = false } = {}) {
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0 && !force) {
        console.log(`ℹ️  Database already has ${existingUsers} user(s). Pass --force to wipe and reseed.`);
        return { skipped: true };
    }

    await Promise.all([
        User.deleteMany({}), Stock.deleteMany({}), Item.deleteMany({}),
        Delivery.deleteMany({}), Invoice.deleteMany({}),
        Contact.deleteMany({}), Notification.deleteMany({})
    ]);

    // create() runs the pre-save hook, so these passwords are hashed.
    // Everyone here is pre-approved so the demo is usable immediately; the two
    // pending accounts at the end exist to exercise the approval queue.
    const users = await User.create([
        { name: 'Amara Osei', email: 'admin@apex.test', password: 'apexdemo123', role: 'Admin', status: 'approved', phone: '+442079460100', gender: 'Female' },
        { name: 'Ravi Menon', email: 'manager@apex.test', password: 'apexdemo123', role: 'Manager', status: 'approved', phone: '+442079460111', gender: 'Male' },
        { name: 'Jess Carter', email: 'driver@apex.test', password: 'apexdemo123', role: 'DeliveryStaff', status: 'approved', phone: '+442079460122', gender: 'Female' },
        { name: 'Tom Okafor', email: 'driver2@apex.test', password: 'apexdemo123', role: 'DeliveryStaff', status: 'approved', phone: '+442079460133', gender: 'Male' },
        { name: 'Lena Fischer', email: 'driver3@apex.test', password: 'apexdemo123', role: 'DeliveryStaff', status: 'approved', gender: 'Female' }
    ]);

    await User.create([
        { name: 'Sofia Ramos', email: 'pending-manager@apex.test', password: 'apexdemo123', role: 'Manager', status: 'pending', gender: 'Female' },
        { name: 'Ade Balogun', email: 'pending-driver@apex.test', password: 'apexdemo123', role: 'DeliveryStaff', status: 'pending', gender: 'Male' }
    ]);

    const drivers = users.filter(u => u.role === 'DeliveryStaff');
    const manager = users.find(u => u.role === 'Manager');

    const stocks = await Stock.create(CATEGORIES);
    const stockByName = new Map(stocks.map(s => [s.name, s]));

    const items = await Item.create(ITEMS.map(([category, sku, price, total, available, location]) => ({
        stockId: stockByName.get(category)._id,
        name: category,
        sku,
        price,
        totalStock: total,
        availableStock: available,
        location,
        forecast: {
            dailyBurnRate: Math.round((total - available) / 30 * 100) / 100,
            daysOfStockLeft: total === available
                ? Infinity
                : Math.round(available / Math.max(0.01, (total - available) / 30) * 10) / 10,
            lastUpdated: new Date()
        }
    })));

    // A spread of deliveries over the last three weeks so the dashboard
    // charts and the forecaster both have something to work with.
    const deliveries = [];
    for (let i = 0; i < 26; i++) {
        const driver = drivers[i % drivers.length];
        const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
        const created = daysAgo(Math.floor(i / 2));
        const lineCount = (i % 3) + 1;

        const lines = [];
        for (let j = 0; j < lineCount; j++) {
            lines.push({
                itemId: items[(i + j * 3) % items.length]._id,
                quantity: ((i + j) % 4) + 1
            });
        }

        deliveries.push({
            assignedTo: driver.name,
            assignedToId: driver._id,
            customerAddress: ADDRESSES[i % ADDRESSES.length],
            items: lines,
            status,
            stockReleased: status === 'Delivered' || status === 'Failed',
            statusHistory: [
                { status: 'Pending', changedBy: manager.name, changedAt: created },
                ...(status === 'Pending' ? [] : [{ status, changedBy: driver.name, changedAt: created }])
            ],
            createdAt: created,
            updatedAt: created
        });
    }
    const createdDeliveries = await Delivery.insertMany(deliveries);

    // Invoice roughly half of the completed runs.
    const delivered = createdDeliveries.filter(d => d.status === 'Delivered');
    const itemsById = new Map(items.map(i => [String(i._id), i]));
    const invoices = delivered.slice(0, Math.ceil(delivered.length / 1.6)).map((delivery, index) => ({
        deliveryId: delivery._id,
        customerAddress: delivery.customerAddress,
        totalAmount: Math.round(delivery.items.reduce((sum, line) => {
            const item = itemsById.get(String(line.itemId));
            return sum + (item ? item.price * line.quantity : 0);
        }, 0) * 100) / 100,
        status: index % 3 === 0 ? 'Unpaid' : 'Paid',
        invoiceDate: delivery.createdAt
    }));
    await Invoice.insertMany(invoices);

    await Contact.insertMany([
        { name: 'Priya Shah', email: 'priya@example.com', message: 'We run three regional depots and would like a demo of the forecasting features.', status: 'New' },
        { name: 'Daniel Wu', email: 'daniel@example.com', message: 'Does Apex integrate with our existing courier API? Happy to jump on a call.', status: 'New' },
        { name: 'Marie Leclerc', email: 'marie@example.com', message: 'Interested in pricing for a 40-driver fleet.', status: 'Read' }
    ]);

    // Low-stock alerts for the managers and admins, matching the seeded stock.
    const recipients = users.filter(u => u.role === 'Admin' || u.role === 'Manager');
    const lowItems = items.filter(i => i.availableStock < 10);
    const notifications = [];
    recipients.forEach(recipient => {
        lowItems.forEach((item, index) => {
            notifications.push({
                userId: recipient._id,
                message: `Stock for '${item.name}' (SKU: ${item.sku}) is low: ${item.availableStock} units remaining.`,
                link: `/inventory/edit/${item._id}`,
                status: index === 0 ? 'read' : 'unread'
            });
        });
    });
    await Notification.insertMany(notifications);

    const summary = {
        users: await User.countDocuments(),
        pendingApproval: await User.countDocuments({ status: 'pending' }),
        categories: stocks.length,
        items: items.length,
        deliveries: createdDeliveries.length,
        invoices: invoices.length,
        notifications: notifications.length
    };

    console.log('✅ Seeded:', summary);
    console.log('   Sign in with admin@apex.test / manager@apex.test / driver@apex.test');
    console.log('   Password for every demo account: apexdemo123');

    return summary;
}

module.exports = seed;

if (require.main === module) {
    const force = process.argv.includes('--force');
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/warehouseDB';

    mongoose.connect(uri)
        .then(() => seed({ force }))
        .then(() => mongoose.disconnect())
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ Seeding failed:', err);
            process.exit(1);
        });
}
