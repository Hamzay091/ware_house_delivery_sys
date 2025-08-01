const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { isAuthenticated, isManagerOrAdmin } = require('../middleware/authMiddleware');


router.get('/invoices', isAuthenticated, isManagerOrAdmin, billingController.renderInvoicesPage);


router.get('/generate/:id', isAuthenticated, isManagerOrAdmin, billingController.generateInvoice);


router.post('/update-status/:id', isAuthenticated, isManagerOrAdmin, billingController.updateInvoiceStatus);


router.get('/invoice/:id', isAuthenticated, isManagerOrAdmin, billingController.renderInvoiceDetail);

module.exports = router;