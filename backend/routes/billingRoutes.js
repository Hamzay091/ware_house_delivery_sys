const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { isAuthenticated, isManagerOrAdmin } = require('../middleware/authMiddleware');

// Route to view all invoices
router.get('/invoices', isAuthenticated, isManagerOrAdmin, billingController.renderInvoicesPage);

// Route to generate a new invoice from a delivery
router.get('/generate/:id', isAuthenticated, isManagerOrAdmin, billingController.generateInvoice);

// Route to update an invoice's status
router.post('/update-status/:id', isAuthenticated, isManagerOrAdmin, billingController.updateInvoiceStatus);

// --- MAKE SURE THIS ROUTE IS HERE ---
// Route to view a single invoice's details
router.get('/invoice/:id', isAuthenticated, isManagerOrAdmin, billingController.renderInvoiceDetail);

module.exports = router;