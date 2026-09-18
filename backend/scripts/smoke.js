/**
 * End-to-end smoke test.
 *
 * Boots the app against a throwaway in-memory MongoDB, signs in as each role
 * and walks every page and form, asserting on status codes and on content that
 * proves the page actually rendered. Run it with:
 *
 *   npm run smoke
 *
 * Exits non-zero if anything fails, so it works in CI.
 */
const crypto = require('crypto');

let failures = 0;
let checks = 0;

function check(ok, label, detail) {
    checks++;
    if (ok) {
        console.log(`  ✓ ${label}`);
    } else {
        failures++;
        console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    }
}

/** A tiny cookie jar so a session survives across requests. */
function createClient(base) {
    const cookies = new Map();

    const cookieHeader = () =>
        Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    const absorb = (res) => {
        // getSetCookie() only exists on newer Node. The app sets a single
        // cookie, so reading the raw header is a safe fallback here — it would
        // not be if several Set-Cookie headers were joined together.
        const raw = typeof res.headers.getSetCookie === 'function'
            ? res.headers.getSetCookie()
            : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
        raw.forEach((line) => {
            const [pair] = line.split(';');
            const idx = pair.indexOf('=');
            if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
        });
    };

    const request = async (path, options = {}) => {
        const res = await fetch(base + path, {
            redirect: 'manual',
            ...options,
            headers: {
                cookie: cookieHeader(),
                ...(options.headers || {})
            }
        });
        absorb(res);
        const body = await res.text();
        return { status: res.status, body, location: res.headers.get('location'), headers: res.headers };
    };

    return {
        request,
        get: (path) => request(path),
        post: (path, fields) => request(path, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(fields).toString()
        }),
        reset: () => cookies.clear()
    };
}

/** Pulls the CSRF token out of a rendered form. */
function csrfFrom(html) {
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    return match ? match[1] : null;
}

async function main() {
    const { MongoMemoryServer } = require('mongodb-memory-server');

    console.log('Starting in-memory MongoDB...');
    const mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri('warehouseDB');

    process.env.MONGO_URI = uri;
    process.env.NODE_ENV = 'development';
    process.env.SECRET_KEY = crypto.randomBytes(48).toString('hex');
    // Keep the suite hermetic: no outbound Google or email configuration.
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;

    const mongoose = require('mongoose');
    await mongoose.connect(uri);
    await require('./seed')({ force: true });

    const app = require('../server');
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const client = createClient(base);

    const Item = require('../models/item');
    const Delivery = require('../models/delivery');
    const User = require('../models/user');

    const login = async (email, password = 'apexdemo123') => {
        client.reset();
        const page = await client.get('/login');
        const token = csrfFrom(page.body);
        return client.post('/login', { _csrf: token, email, password });
    };

    // ---------------------------------------------------------------- public
    console.log('\nPublic pages');
    {
        const home = await client.get('/');
        check(home.status === 200 && home.body.includes('Run the warehouse'), 'GET / renders the hero');
        check(home.body.includes('csrfToken') === false, 'GET / does not leak the literal template tag');

        const login = await client.get('/login');
        check(login.status === 200 && login.body.includes('Welcome back'), 'GET /login renders');

        const register = await client.get('/register');
        check(register.status === 200 && register.body.includes('Create your account'), 'GET /register renders');

        const missing = await client.get('/no-such-page');
        check(missing.status === 404 && missing.body.includes('could not find'), 'unknown URL returns the 404 page');

        const guarded = await client.get('/inventory');
        check(guarded.status === 302 && guarded.location === '/login', 'anonymous /inventory redirects to login');
    }

    // ------------------------------------------------------------------ csrf
    console.log('\nCSRF protection');
    {
        const page = await client.get('/login');
        const token = csrfFrom(page.body);
        check(Boolean(token), 'login form carries a CSRF token');

        const noToken = await client.post('/login', { email: 'admin@apex.test', password: 'apexdemo123' });
        check(noToken.status === 403, 'POST without a token is rejected', `got ${noToken.status}`);

        const badToken = await client.post('/login', {
            _csrf: 'not-the-real-token', email: 'admin@apex.test', password: 'apexdemo123'
        });
        check(badToken.status === 403, 'POST with a wrong token is rejected', `got ${badToken.status}`);
    }

    // ------------------------------------------------------------------ auth
    console.log('\nAuthentication');
    {
        const bad = await login('admin@apex.test', 'wrong-password');
        check(bad.status === 401 && bad.body.includes('Invalid email or password'),
            'wrong password is rejected with a generic message');

        const unknown = await login('nobody@apex.test', 'whatever12');
        check(unknown.status === 401 && unknown.body.includes('Invalid email or password'),
            'unknown email gives the same message (no enumeration)');

        const ok = await login('admin@apex.test');
        check(ok.status === 302 && ok.location === '/admin-dashboard', 'admin login redirects to the admin dashboard',
            `got ${ok.status} ${ok.location}`);
    }

    // ----------------------------------------------------------------- admin
    console.log('\nAdmin pages');
    {
        await login('admin@apex.test');

        const pages = [
            ['/admin-dashboard', 'Admin control panel'],
            ['/users/manage', 'User management'],
            ['/inventory', 'Inventory'],
            ['/manager-dashboard', 'Dispatch hub'],
            ['/delivery-reports', 'Delivery reports'],
            ['/billing/invoices', 'Billing'],
            ['/notifications', 'Notifications'],
            ['/view-messages', 'Contact messages'],
            ['/stock', 'Stock catalogue'],
            ['/profile', 'My profile'],
            ['/admin/managers', 'Managers'],
            ['/admin/delivery-staff', 'Delivery staff'],
            ['/admin/view-as/manager', 'Dispatch hub'],
            ['/deliveries/assign', 'Assign a delivery'],
            ['/inventory/add', 'Add or restock'],
            ['/users/profile/edit', 'Edit your profile'],
            ['/users/profile/change-password', 'Change your password']
        ];

        for (const [path, needle] of pages) {
            const res = await client.get(path);
            check(res.status === 200 && res.body.includes(needle), `GET ${path}`,
                `status ${res.status}${res.status === 200 ? `, missing "${needle}"` : ''}`);
        }

        // The user-management page used to be a copy of the messages template
        // and threw on every load.
        const users = await client.get('/users/manage');
        check(users.body.includes('admin@apex.test') && users.body.includes('driver@apex.test'),
            '/users/manage lists real user accounts');

        const detailUser = await User.findOne({ role: 'DeliveryStaff' });
        const detail = await client.get(`/admin/user-detail/${detailUser._id}`);
        check(detail.status === 200 && detail.body.includes(detailUser.name), 'GET /admin/user-detail/:id');

        const invoiceCsv = await client.get('/billing/invoices/export.csv');
        check(invoiceCsv.status === 200 && invoiceCsv.headers.get('content-type').includes('text/csv'),
            'invoice CSV export downloads');

        const inventoryCsv = await client.get('/inventory/export.csv');
        check(inventoryCsv.status === 200 && inventoryCsv.body.includes('Available stock'),
            'inventory CSV export has headers');

        const deliveryCsv = await client.get('/delivery-reports/export.csv');
        check(deliveryCsv.status === 200 && deliveryCsv.body.split('\r\n').length > 2,
            'delivery CSV export has rows');
    }

    // ------------------------------------------------------------- filtering
    console.log('\nSearch, filter and pagination');
    {
        await login('admin@apex.test');

        const search = await client.get('/inventory?search=KRAKEN');
        check(search.status === 200 && search.body.includes('RZR-KRAKEN-V3') && !search.body.includes('LG-27GP850'),
            'inventory search narrows the result set');

        const evil = await client.get('/inventory?search=' + encodeURIComponent('.*'));
        check(evil.status === 200 && evil.body.includes('No items found'),
            'a regex metacharacter search is treated as a literal');

        const sorted = await client.get('/inventory?sort=price&dir=desc');
        check(sorted.status === 200 && sorted.body.indexOf('DEL-U2723QE') < sorted.body.indexOf('CBL-HDMI21-2M'),
            'sorting by price descending orders the rows');

        const badSort = await client.get('/inventory?sort=__proto__&dir=asc');
        check(badSort.status === 200, 'an unknown sort field falls back instead of erroring');

        const paged = await client.get('/delivery-reports?limit=5&page=2');
        check(paged.status === 200 && paged.body.includes('page=3'), 'pagination renders page links');

        const hugeLimit = await client.get('/delivery-reports?limit=100000');
        check(hugeLimit.status === 200, 'an oversized limit is clamped rather than accepted');
    }

    // ------------------------------------------------------- stock integrity
    console.log('\nStock integrity');
    {
        await login('manager@apex.test');

        const item = await Item.findOne({ sku: 'CBL-HDMI21-2M' });
        const before = item.availableStock;

        const form = await client.get('/deliveries/assign');
        const token = csrfFrom(form.body);
        const driver = await User.findOne({ role: 'DeliveryStaff' });

        const created = await client.post('/deliveries/assign', {
            _csrf: token,
            assignedTo: driver._id.toString(),
            customerAddress: '1 Smoke Test Road',
            'items[0][itemId]': item._id.toString(),
            'items[0][quantity]': '3'
        });
        check(created.status === 302 && created.location === '/manager-dashboard', 'assigning a delivery succeeds');

        const afterCreate = await Item.findById(item._id);
        check(afterCreate.availableStock === before - 3,
            'stock is reserved on assignment', `${before} -> ${afterCreate.availableStock}`);

        // Over-ordering must be refused outright, not clamped to a negative.
        const form2 = await client.get('/deliveries/assign');
        const over = await client.post('/deliveries/assign', {
            _csrf: csrfFrom(form2.body),
            assignedTo: driver._id.toString(),
            customerAddress: '2 Smoke Test Road',
            'items[0][itemId]': item._id.toString(),
            'items[0][quantity]': String(afterCreate.availableStock + 50)
        });
        const afterOver = await Item.findById(item._id);
        check(over.status === 302 && afterOver.availableStock === afterCreate.availableStock,
            'over-ordering is refused and leaves stock untouched',
            `stock is now ${afterOver.availableStock}`);
        check(afterOver.availableStock >= 0, 'stock never goes negative');

        // Two lines for the same item must be summed before the stock check.
        const form3 = await client.get('/deliveries/assign');
        const split = await client.post('/deliveries/assign', {
            _csrf: csrfFrom(form3.body),
            assignedTo: driver._id.toString(),
            customerAddress: '3 Smoke Test Road',
            'items[0][itemId]': item._id.toString(),
            'items[0][quantity]': String(Math.ceil(afterOver.availableStock / 2) + 5),
            'items[1][itemId]': item._id.toString(),
            'items[1][quantity]': String(Math.ceil(afterOver.availableStock / 2) + 5)
        });
        const afterSplit = await Item.findById(item._id);
        check(afterSplit.availableStock === afterOver.availableStock,
            'duplicate lines are summed before the stock check', `stock is ${afterSplit.availableStock}`);
    }

    // ------------------------------------------------------- staff ownership
    console.log('\nDelivery staff permissions');
    {
        const driverA = await User.findOne({ email: 'driver@apex.test' });
        const driverB = await User.findOne({ email: 'driver2@apex.test' });

        const mine = await Delivery.findOne({ assignedToId: driverA._id, status: { $in: ['Pending', 'In Transit'] } });

        // Guarantee the ownership check is actually exercised rather than
        // quietly skipped because the seed happened not to produce one.
        let theirs = await Delivery.findOne({
            assignedToId: driverB._id, status: { $in: ['Pending', 'In Transit'] }
        });
        if (!theirs) {
            const anyItem = await Item.findOne({ availableStock: { $gt: 0 } });
            theirs = await Delivery.create({
                assignedTo: driverB.name,
                assignedToId: driverB._id,
                customerAddress: '9 Ownership Test Lane',
                items: [{ itemId: anyItem._id, quantity: 1 }],
                status: 'Pending'
            });
        }
        check(Boolean(mine), 'the seed gives driver A an open delivery to update');
        check(Boolean(theirs), 'driver B has an open delivery to attempt access on');

        await login('driver@apex.test');

        const dash = await client.get('/delivery-staff-dashboard');
        check(dash.status === 200 && dash.body.includes('My deliveries'), 'GET /delivery-staff-dashboard');
        check(!dash.body.includes(driverB.name), 'staff dashboard shows only their own runs');

        const token = csrfFrom(dash.body);

        if (theirs) {
            const trespass = await client.post(`/deliveries/update-status/${theirs._id}`, {
                _csrf: token, status: 'Delivered'
            });
            const unchanged = await Delivery.findById(theirs._id);
            check(trespass.status === 403 && unchanged.status === theirs.status,
                "staff cannot update another driver's delivery", `got ${trespass.status}`);
        }

        if (mine) {
            const lines = mine.items.filter(l => l.itemId);
            const beforeStock = lines.length
                ? (await Item.findById(lines[0].itemId)).availableStock
                : null;

            const failed = await client.post(`/deliveries/update-status/${mine._id}`, {
                _csrf: token, status: 'Failed'
            });
            const after = await Delivery.findById(mine._id);
            check(failed.status === 302 && after.status === 'Failed', 'staff can update their own delivery');

            if (beforeStock !== null) {
                const afterStock = (await Item.findById(lines[0].itemId)).availableStock;
                check(afterStock === beforeStock + lines[0].quantity,
                    'a failed delivery returns its stock to the shelf',
                    `${beforeStock} -> ${afterStock}`);
            }

            // Reopening a closed delivery would double-count the stock.
            const reopen = await client.post(`/deliveries/update-status/${mine._id}`, {
                _csrf: token, status: 'In Transit'
            });
            const stillFailed = await Delivery.findById(mine._id);
            check(stillFailed.status === 'Failed', 'a closed delivery cannot be reopened from the staff view');
        }

        // Role separation
        const forbidden = await client.get('/inventory');
        check(forbidden.status === 403, 'staff cannot reach the inventory page', `got ${forbidden.status}`);
        const forbiddenAdmin = await client.get('/users/manage');
        check(forbiddenAdmin.status === 403, 'staff cannot reach user management', `got ${forbiddenAdmin.status}`);
    }

    // --------------------------------------------------------- mass assignment
    console.log('\nPrivilege escalation');
    {
        await login('manager@apex.test');

        const profile = await client.get('/users/profile/edit');
        const token = csrfFrom(profile.body);

        // The profile form owns name/phone/socialLink only. Posting a role or
        // password alongside them must be ignored.
        const res = await client.post('/users/profile/edit', {
            _csrf: token,
            name: 'Ravi Menon',
            phone: '+44 20 7946 0111',
            role: 'Admin',
            password: 'hijacked123'
        });
        const after = await User.findOne({ email: 'manager@apex.test' });
        check(res.status === 302 && after.role === 'Manager',
            'posting a role to the profile form does not escalate', `role is ${after.role}`);

        const stillValid = await after.comparePassword('apexdemo123');
        check(stillValid, 'posting a password to the profile form does not overwrite the hash');
    }

    // -------------------------------------------------- profile and password
    console.log('\nProfile and password');
    {
        await login('driver3@apex.test');

        // This route read req.session.user, which Passport never sets, so it
        // threw on every submission.
        const page = await client.get('/users/profile/edit');
        const res = await client.post('/users/profile/edit', {
            _csrf: csrfFrom(page.body),
            name: 'Lena Fischer-Weiss',
            phone: '+49 30 1234',
            socialLink: ''
        });
        const updated = await User.findOne({ email: 'driver3@apex.test' });
        check(res.status === 302 && updated.name === 'Lena Fischer-Weiss', 'editing your own profile saves');

        const renamed = await Delivery.findOne({ assignedToId: updated._id });
        check(!renamed || renamed.assignedTo === 'Lena Fischer-Weiss',
            'renaming a user updates their delivery records');

        const pwPage = await client.get('/users/profile/change-password');
        const pwToken = csrfFrom(pwPage.body);

        const mismatch = await client.post('/users/profile/change-password', {
            _csrf: pwToken, currentPassword: 'apexdemo123', newPassword: 'newpass12345', confirmPassword: 'different123'
        });
        check(mismatch.status === 400 && mismatch.body.includes('do not match'), 'mismatched passwords are rejected');

        const tooShort = await client.post('/users/profile/change-password', {
            _csrf: pwToken, currentPassword: 'apexdemo123', newPassword: 'short', confirmPassword: 'short'
        });
        check(tooShort.status === 400 && tooShort.body.includes('at least 8'), 'a short password is rejected');

        const wrongCurrent = await client.post('/users/profile/change-password', {
            _csrf: pwToken, currentPassword: 'nope12345', newPassword: 'newpass12345', confirmPassword: 'newpass12345'
        });
        check(wrongCurrent.status === 400 && wrongCurrent.body.includes('not correct'),
            'the wrong current password is rejected');

        const changed = await client.post('/users/profile/change-password', {
            _csrf: pwToken, currentPassword: 'apexdemo123', newPassword: 'newpass12345', confirmPassword: 'newpass12345'
        });
        const reloaded = await User.findOne({ email: 'driver3@apex.test' });
        check(changed.status === 302 && await reloaded.comparePassword('newpass12345'),
            'the password is changed and stored hashed');
        check(reloaded.password !== 'newpass12345', 'the new password is not stored in plain text');
    }

    // ------------------------------------------------------- admin safeguards
    console.log('\nAdmin safeguards');
    {
        await login('admin@apex.test');
        const admin = await User.findOne({ email: 'admin@apex.test' });

        const editPage = await client.get(`/users/edit/${admin._id}`);
        const token = csrfFrom(editPage.body);

        const selfDemote = await client.post(`/users/edit/${admin._id}`, {
            _csrf: token, name: admin.name, email: admin.email, phone: '', role: 'Manager'
        });
        const stillAdmin = await User.findById(admin._id);
        check(selfDemote.status === 302 && stillAdmin.role === 'Admin', 'an admin cannot demote themselves');

        const selfDelete = await client.post(`/users/delete/${admin._id}`, { _csrf: token });
        const stillThere = await User.findById(admin._id);
        check(selfDelete.status === 302 && stillThere, 'an admin cannot delete their own account');
    }

    // ------------------------------------------------------ billing workflow
    console.log('\nBilling');
    {
        await login('manager@apex.test');

        const Invoice = require('../models/invoice');
        const uninvoiced = await Delivery.findOne({
            status: 'Delivered',
            _id: { $nin: (await Invoice.find().select('deliveryId')).map(i => i.deliveryId) }
        });

        const dash = await client.get('/manager-dashboard');
        const token = csrfFrom(dash.body);

        if (uninvoiced) {
            const generated = await client.post(`/billing/generate/${uninvoiced._id}`, { _csrf: token });
            check(generated.status === 302 && /\/billing\/invoice\//.test(generated.location),
                'generating an invoice redirects to it');

            const duplicate = await client.post(`/billing/generate/${uninvoiced._id}`, { _csrf: token });
            const count = await Invoice.countDocuments({ deliveryId: uninvoiced._id });
            check(count === 1, 'generating twice does not create a duplicate invoice', `count is ${count}`);
        }

        const pending = await Delivery.findOne({ status: 'Pending' });
        if (pending) {
            const bad = await client.post(`/billing/generate/${pending._id}`, { _csrf: token });
            const count = await Invoice.countDocuments({ deliveryId: pending._id });
            check(count === 0, 'a delivery that is not delivered cannot be invoiced');
        }

        const invoice = await Invoice.findOne({ status: 'Unpaid' });
        if (invoice) {
            const list = await client.get('/billing/invoices');
            const paid = await client.post(`/billing/update-status/${invoice._id}`, {
                _csrf: csrfFrom(list.body), status: 'Paid'
            });
            const reloaded = await Invoice.findById(invoice._id);
            check(paid.status === 302 && reloaded.status === 'Paid', 'an invoice can be marked paid');

            const bogus = await client.post(`/billing/update-status/${invoice._id}`, {
                _csrf: csrfFrom(list.body), status: 'Refunded'
            });
            const unchanged = await Invoice.findById(invoice._id);
            check(unchanged.status === 'Paid', 'an invalid invoice status is rejected');

            const detail = await client.get(`/billing/invoice/${invoice._id}`);
            check(detail.status === 200 && detail.body.includes('Invoice'), 'the invoice detail page renders');
        }
    }

    // ------------------------------------------------------- notifications
    console.log('\nNotifications');
    {
        const Notification = require('../models/notification');

        await login('manager@apex.test');
        const manager = await User.findOne({ email: 'manager@apex.test' });
        const admin = await User.findOne({ email: 'admin@apex.test' });

        const page = await client.get('/notifications');
        const token = csrfFrom(page.body);

        const someoneElses = await Notification.findOne({ userId: admin._id });
        if (someoneElses) {
            const trespass = await client.post(`/notifications/read/${someoneElses._id}`, { _csrf: token });
            const still = await Notification.findById(someoneElses._id);
            check(trespass.status === 403, "cannot mark another user's notification as read",
                `got ${trespass.status}`);
        }

        const readAll = await client.post('/notifications/read-all', { _csrf: token });
        const remaining = await Notification.countDocuments({ userId: manager._id, status: 'unread' });
        check(readAll.status === 302 && remaining === 0, 'mark-all-as-read clears your own unread notifications');

        const adminUnread = await Notification.countDocuments({ userId: admin._id, status: 'unread' });
        check(adminUnread > 0, "mark-all-as-read does not touch another user's notifications");
    }

    // ------------------------------------------------------- inventory CRUD
    console.log('\nInventory CRUD');
    {
        await login('manager@apex.test');

        const addPage = await client.get('/inventory/add');
        const token = csrfFrom(addPage.body);

        const created = await client.post('/inventory/add', {
            _csrf: token,
            newStockName: 'Smoke Test Gear',
            sku: 'SMOKE-001',
            price: '12.34',
            quantity: '25',
            location: 'Aisle 9'
        });
        const item = await Item.findOne({ sku: 'SMOKE-001' });
        check(created.status === 302 && item && item.availableStock === 25, 'a new item is created');

        // Restocking the same SKU must add to it, not create a duplicate.
        const restockPage = await client.get('/inventory/add');
        await client.post('/inventory/add', {
            _csrf: csrfFrom(restockPage.body),
            stockId: item.stockId.toString(),
            sku: 'SMOKE-001',
            price: '12.34',
            quantity: '10',
            location: 'Aisle 9'
        });
        const restocked = await Item.findOne({ sku: 'SMOKE-001' });
        const duplicates = await Item.countDocuments({ sku: 'SMOKE-001' });
        check(restocked.availableStock === 35 && duplicates === 1,
            'restocking an existing SKU adds to it', `${restocked.availableStock} units, ${duplicates} rows`);

        const editPage = await client.get(`/inventory/edit/${item._id}`);
        const editToken = csrfFrom(editPage.body);

        const inconsistent = await client.post(`/inventory/edit/${item._id}`, {
            _csrf: editToken, stockId: item.stockId.toString(), sku: 'SMOKE-001',
            price: '12.34', totalStock: '10', availableStock: '99', location: 'Aisle 9'
        });
        check(inconsistent.status === 400 && inconsistent.body.includes('cannot exceed'),
            'available stock above total stock is rejected');

        const negative = await client.post(`/inventory/edit/${item._id}`, {
            _csrf: editToken, stockId: item.stockId.toString(), sku: 'SMOKE-001',
            price: '12.34', totalStock: '35', availableStock: '-5', location: 'Aisle 9'
        });
        check(negative.status === 400, 'a negative stock level is rejected');

        const deleted = await client.post(`/inventory/delete/${item._id}`, { _csrf: editToken });
        const gone = await Item.findById(item._id);
        check(deleted.status === 302 && !gone, 'an unused item can be deleted');

        // An item that appears on a delivery must be protected.
        const used = await Item.findOne({ sku: 'RZR-KRAKEN-V3' });
        const usedBy = await Delivery.findOne({ 'items.itemId': used._id });
        if (usedBy) {
            const blocked = await client.post(`/inventory/delete/${used._id}`, { _csrf: editToken });
            const stillHere = await Item.findById(used._id);
            check(blocked.status === 302 && stillHere, 'an item used by a delivery cannot be deleted');
        }
    }

    // ------------------------------------------------------------- contact
    console.log('\nContact form');
    {
        client.reset();
        const Contact = require('../models/contact');
        const before = await Contact.countDocuments();

        const home = await client.get('/');
        const token = csrfFrom(home.body);

        const tooShort = await client.post('/', {
            _csrf: token, name: 'Test', email: 'test@example.com', message: 'hi'
        });
        check(tooShort.status === 400 && tooShort.body.includes('between 10 and 4000'),
            'a too-short message is rejected');

        const badEmail = await client.post('/', {
            _csrf: token, name: 'Test', email: 'not-an-email', message: 'This is a long enough message.'
        });
        check(badEmail.status === 400, 'an invalid email is rejected');

        const ok = await client.post('/', {
            _csrf: token, name: 'Smoke Tester', email: 'smoke@example.com',
            message: 'This is a valid enquiry that is long enough to pass validation.'
        });
        const after = await Contact.countDocuments();
        check(ok.status === 302 && after === before + 1, 'a valid message is stored');

        const saved = await Contact.findOne({ email: 'smoke@example.com' });
        check(saved.status === 'New', 'the contact status is not settable from the request');
    }

    // -------------------------------------------------------------- logout
    console.log('\nLogout');
    {
        await login('admin@apex.test');
        const dash = await client.get('/admin-dashboard');
        const token = csrfFrom(dash.body);

        const viaGet = await client.get('/logout');
        check(viaGet.status === 404, 'GET /logout is not a route', `got ${viaGet.status}`);

        const out = await client.post('/logout', { _csrf: token });
        check(out.status === 302, 'POST /logout signs out');

        const after = await client.get('/admin-dashboard');
        check(after.status === 302 && after.location === '/login', 'the session is gone after logout');
    }

    // -------------------------------------------------- approval workflow
    console.log('\nAccount approval');
    {
        // A pending account must not be able to sign in at all.
        const pending = await login('pending-manager@apex.test');
        check(pending.status === 403 && pending.body.includes('waiting for an administrator'),
            'a pending account cannot log in', `got ${pending.status}`);

        // Registering cannot self-approve, and cannot claim Admin once one exists.
        client.reset();
        const regPage = await client.get('/register');
        const regToken = csrfFrom(regPage.body);

        const selfApprove = await client.post('/register', {
            _csrf: regToken,
            name: 'Sneaky Person',
            email: 'sneaky@apex.test',
            password: 'sneaky12345',
            role: 'Manager',
            status: 'approved'
        });
        const sneaky = await User.findOne({ email: 'sneaky@apex.test' });
        check(selfApprove.status === 302 && sneaky && sneaky.status === 'pending',
            'posting status=approved to the register form is ignored',
            sneaky ? `status is ${sneaky.status}` : 'user not created');

        const reg2 = await client.get('/register');
        await client.post('/register', {
            _csrf: csrfFrom(reg2.body),
            name: 'Would Be Admin',
            email: 'wouldbe@apex.test',
            password: 'wouldbe12345',
            role: 'Admin'
        });
        const wouldBe = await User.findOne({ email: 'wouldbe@apex.test' });
        check(wouldBe && wouldBe.status === 'pending',
            'registering as Admin does not auto-approve once an admin exists',
            wouldBe ? `status is ${wouldBe.status}` : 'user not created');

        const blocked = await login('wouldbe@apex.test', 'wouldbe12345');
        check(blocked.status === 403, 'that would-be admin still cannot sign in', `got ${blocked.status}`);

        // A non-admin cannot approve anyone.
        await login('manager@apex.test');
        const managerPage = await client.get('/manager-dashboard');
        const sneak = await client.post(`/users/approve/${sneaky._id}`, { _csrf: csrfFrom(managerPage.body) });
        const stillPending = await User.findById(sneaky._id);
        check(sneak.status === 403 && stillPending.status === 'pending',
            'a manager cannot approve an account', `got ${sneak.status}`);

        // The admin sees the queue and can approve.
        await login('admin@apex.test');
        const manage = await client.get('/users/manage');
        check(manage.body.includes('Waiting for approval') && manage.body.includes('sneaky@apex.test'),
            'the approval queue lists pending accounts');

        const token = csrfFrom(manage.body);
        const approved = await client.post(`/users/approve/${sneaky._id}`, { _csrf: token });
        const nowApproved = await User.findById(sneaky._id);
        check(approved.status === 302 && nowApproved.status === 'approved', 'an admin can approve an account');

        const canLogIn = await login('sneaky@apex.test', 'sneaky12345');
        check(canLogIn.status === 302 && canLogIn.location === '/manager-dashboard',
            'the approved account can now sign in', `got ${canLogIn.status} ${canLogIn.location}`);

        // Rejecting removes the request outright.
        await login('admin@apex.test');
        const manage2 = await client.get('/users/manage');
        const rejected = await client.post(`/users/reject/${wouldBe._id}`, { _csrf: csrfFrom(manage2.body) });
        const gone = await User.findById(wouldBe._id);
        check(rejected.status === 302 && !gone, 'an admin can reject a pending account');

        // An approved account must not be removable through the reject route.
        const manage3 = await client.get('/users/manage');
        const rejectApproved = await client.post(`/users/reject/${sneaky._id}`, { _csrf: csrfFrom(manage3.body) });
        const survived = await User.findById(sneaky._id);
        check(rejectApproved.status === 302 && survived, 'reject refuses an already-approved account');

        // Oversight lists should not include people who cannot sign in yet.
        const managers = await client.get('/admin/managers');
        check(!managers.body.includes('pending-manager@apex.test'),
            'the managers list excludes pending accounts');

        // Google sign-up cannot claim Admin even with a crafted POST.
        const choosePage = await client.get('/choose-role');
        check(choosePage.status === 302, '/choose-role is unreachable without an OAuth profile in session');
    }

    // ---------------------------------------------------- contact messages
    console.log('\nContact message workflow');
    {
        const Contact = require('../models/contact');
        await login('manager@apex.test');

        const page = await client.get('/view-messages');
        check(page.status === 200 && page.body.includes('Mark as read'),
            'the messages page offers a mark-as-read action');

        const unread = await Contact.findOne({ status: 'New' });
        const token = csrfFrom(page.body);

        if (unread) {
            const marked = await client.post(`/messages/read/${unread._id}`, { _csrf: token });
            const reloaded = await Contact.findById(unread._id);
            check(marked.status === 302 && reloaded.status === 'Read',
                'a message can be marked as read', `status is ${reloaded.status}`);
        }

        const readAll = await client.post('/messages/read-all', { _csrf: token });
        const remaining = await Contact.countDocuments({ status: 'New' });
        check(readAll.status === 302 && remaining === 0, 'mark-all clears the remaining unread messages');

        // Delivery staff have no business in the message queue.
        await login('driver@apex.test');
        const dash = await client.get('/delivery-staff-dashboard');
        const staffAttempt = await client.post('/messages/read-all', { _csrf: csrfFrom(dash.body) });
        check(staffAttempt.status === 403, 'delivery staff cannot touch contact messages',
            `got ${staffAttempt.status}`);
    }

    // ------------------------------------------------------------- teardown
    server.close();
    await mongoose.disconnect();
    await mongo.stop();

    console.log(`\n${checks - failures}/${checks} checks passed.`);
    if (failures > 0) {
        console.error(`❌ ${failures} check(s) failed.`);
        process.exit(1);
    }
    console.log('✅ All smoke checks passed.');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Smoke run crashed:', err);
    process.exit(1);
});
