const express = require('express');
const { body } = require('express-validator');

const pageController = require('../controllers/pageController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

const contactValidators = [
    body('name').trim().notEmpty().withMessage('Please tell us your name.')
        .isLength({ max: 120 }).withMessage('That name is too long.').escape(),
    body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
    body('message')
        .trim()
        .isLength({ min: 10, max: 4000 })
        .withMessage('Your message should be between 10 and 4000 characters.')
        .escape()
];

router.get('/', pageController.renderHomePage);
router.post('/', contactValidators, pageController.handleContactForm);
router.post('/contact', contactValidators, pageController.handleContactForm);

router.get('/profile', isAuthenticated, pageController.renderProfilePage);
router.get('/stock', isAuthenticated, pageController.renderStockCataloguePage);

module.exports = router;
