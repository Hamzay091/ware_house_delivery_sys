const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { isAuthenticated } = require('../middleware/authMiddleware');

// The home page now handles everything
router.get('/', pageController.renderHomePage);

// The contact form on the home page will now POST to the root URL
router.post('/', pageController.handleContactForm);

// Profile and Stock Catalogue routes remain the same
router.get('/profile', isAuthenticated, pageController.renderProfilePage);
router.get('/stock', isAuthenticated, pageController.renderStockCataloguePage);

module.exports = router;