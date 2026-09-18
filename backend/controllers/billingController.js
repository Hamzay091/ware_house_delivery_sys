const Invoice = require('../models/invoice');
const Delivery = require('../models/delivery');
const { searchRegex, paginate, sortSpec, pageMeta, sortLink } = require('../utils/query');
const { sendCsv } = require('../utils/csv');

function buildFilter(query) {
    const filter = {};
    const regex = searchRegex(query.search);
    if (regex) filter.customerAddress = regex;
    if (['Unpaid', 'Paid', 'Void'].includes(query.status)) filter.status = query.status;
    return filter;
}

exports.renderInvoicesPage = async (req, res, next) => {
    try {
        const filter = buildFilter(req.query);
        const page = paginate(req.query);
        const sort = sortSpec(req.query, ['invoiceDate', 'totalAmount', 'status'], 'invoiceDate');

        const [invoices, total, totals] = await Promise.all([
            Invoice.find(filter).sort(sort.spec).skip(page.skip).limit(page.limit),
            Invoice.countDocuments(filter),
            Invoice.aggregate([
                { $group: { _id: '$status', amount: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
            ])
        ]);

        const summary = { Unpaid: 0, Paid: 0, Void: 0, outstanding: 0, collected: 0 };
        totals.forEach(row => {
            summary[row._id] = row.count;
            if (row._id === 'Unpaid') summary.outstanding = row.amount;
            if (row._id === 'Paid') summary.collected = row.amount;
        });

        res.render('invoices', {
            title: 'Billing',
            invoices,
            summary,
            filters: { search: req.query.search || '', status: req.query.status || '' },
            pagination: pageMeta(page, total, req.query),
            sort,
            sortHref: (field) => sortLink(req.query, field, sort.field, sort.dir)
        });
    } catch (error) {
        next(error);
    }
};

exports.exportInvoices = async (req, res, next) => {
    try {
        const invoices = await Invoice.find(buildFilter(req.query))
            .sort({ invoiceDate: -1 })
            .limit(10000);

        sendCsv(
            res,
            `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
            ['Invoice ID', 'Date', 'Customer address', 'Total amount', 'Status'],
            invoices.map(invoice => ([
                invoice._id.toString(),
                new Date(invoice.invoiceDate).toISOString().slice(0, 10),
                invoice.customerAddress,
                invoice.totalAmount.toFixed(2),
                invoice.status
            ]))
        );
    } catch (error) {
        next(error);
    }
};

exports.generateInvoice = async (req, res, next) => {
    try {
        const deliveryId = req.params.id;

        const existingInvoice = await Invoice.findOne({ deliveryId });
        if (existingInvoice) {
            req.flash('info', 'An invoice already exists for this delivery.');
            return res.redirect(`/billing/invoice/${existingInvoice._id}`);
        }

        const delivery = await Delivery.findById(deliveryId).populate('items.itemId');
        if (!delivery) {
            req.flash('error', 'That delivery no longer exists.');
            return res.redirect('/manager-dashboard');
        }
        if (delivery.status !== 'Delivered') {
            req.flash('error', 'Invoices can only be generated for delivered orders.');
            return res.redirect('/manager-dashboard');
        }

        let totalAmount = 0;
        let missingItems = 0;
        delivery.items.forEach(line => {
            if (line.itemId) totalAmount += line.quantity * line.itemId.price;
            else missingItems += 1;
        });

        const invoice = await Invoice.create({
            deliveryId: delivery._id,
            customerAddress: delivery.customerAddress,
            totalAmount
        });

        if (missingItems > 0) {
            req.flash('warning', `${missingItems} line(s) referenced a deleted item and were billed as 0.00.`);
        }
        req.flash('success', 'Invoice generated.');
        res.redirect(`/billing/invoice/${invoice._id}`);
    } catch (error) {
        if (error.code === 11000) {
            req.flash('info', 'An invoice already exists for this delivery.');
            return res.redirect('/billing/invoices');
        }
        next(error);
    }
};

exports.updateInvoiceStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['Unpaid', 'Paid', 'Void'].includes(status)) {
            req.flash('error', 'That is not a valid invoice status.');
            return res.redirect('/billing/invoices');
        }

        const invoice = await Invoice.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!invoice) {
            req.flash('error', 'That invoice no longer exists.');
        } else {
            req.flash('success', `Invoice marked as ${status.toLowerCase()}.`);
        }
        res.redirect(req.body.redirectTo === 'detail' && invoice
            ? `/billing/invoice/${invoice._id}`
            : '/billing/invoices');
    } catch (error) {
        next(error);
    }
};

exports.renderInvoiceDetail = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate({
            path: 'deliveryId',
            model: 'Delivery',
            populate: { path: 'items.itemId', model: 'Item' }
        });

        if (!invoice) {
            req.flash('error', 'That invoice no longer exists.');
            return res.redirect('/billing/invoices');
        }

        res.render('invoice-detail', {
            title: `Invoice ${invoice._id.toString().slice(-8).toUpperCase()}`,
            invoice
        });
    } catch (error) {
        next(error);
    }
};
