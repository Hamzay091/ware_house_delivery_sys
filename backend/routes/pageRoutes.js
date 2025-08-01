const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { isAuthenticated } = require('../middleware/authMiddleware');


router.get('/', pageController.renderHomePage);


router.post('/', pageController.handleContactForm);


router.get('/profile', isAuthenticated, pageController.renderProfilePage);
router.get('/stock', isAuthenticated, pageController.renderStockCataloguePage);

module.exports = router;