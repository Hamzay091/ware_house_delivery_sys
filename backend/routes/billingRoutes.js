const express = require('express');

const billingController = require('../controllers/billingController');
const { isManagerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(isManagerOrAdmin);

router.get('/invoices', billingController.renderInvoicesPage);
router.get('/invoices/export.csv', billingController.exportInvoices);
router.get('/invoice/:id', billingController.renderInvoiceDetail);

// Generating an invoice creates a record, so it is no longer a GET link.
router.post('/generate/:id', billingController.generateInvoice);
router.post('/update-status/:id', billingController.updateInvoiceStatus);

module.exports = router;
