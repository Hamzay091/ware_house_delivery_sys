const Invoice = require('../models/invoice');   
const Delivery = require('../models/delivery'); 

exports.renderInvoicesPage = async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ invoiceDate: -1 });
        res.render('invoices', { invoices });
    } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).send("Error loading invoices page.");
    }
};
exports.generateInvoice = async (req, res) => {
    try {
        const deliveryId = req.params.id;
        const existingInvoice = await Invoice.findOne({ deliveryId: deliveryId });
        if (existingInvoice) {
            return res.redirect('/manager-dashboard?error=Invoice+already+exists+for+this+delivery.');
        }
        const delivery = await Delivery.findById(deliveryId).populate('items.itemId');
        if (!delivery || delivery.status !== 'Delivered') {
            return res.redirect('/manager-dashboard?error=Invoice+can+only+be+generated+for+delivered+orders.');
        }
        let totalAmount = 0;
        delivery.items.forEach(item => {
            if (item.itemId) {
                totalAmount += item.quantity * item.itemId.price;
            }
        });
        await Invoice.create({
            deliveryId: delivery._id,
            customerAddress: delivery.customerAddress,
            totalAmount: totalAmount
        });
        res.redirect('/billing/invoices');
    } catch (error) {
        console.error("Error generating invoice:", error);
        res.redirect('/manager-dashboard?error=An+error+occurred+while+generating+the+invoice.');
    }
};
exports.updateInvoiceStatus = async (req, res) => {
    try {
        await Invoice.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.redirect('/billing/invoices');
    } catch (error) {
        console.error("Error updating invoice status:", error);
        res.redirect('/billing/invoices?error=Failed+to+update+status.');
    }
};
exports.renderInvoiceDetail = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: 'deliveryId',
        model: 'Delivery',
        populate: {
          path: 'items.itemId',
          model: 'Item'
        }
      });

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    res.render('invoice-detail', { 
      invoice,
      pageTitle: `Invoice #${invoice._id.toString().substring(0, 8)}...` 
    });

  } catch (error) {
    console.error("Error fetching invoice details:", error);
    res.status(500).send("Error loading invoice details page.");
  }
};