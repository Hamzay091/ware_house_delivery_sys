const express = require('express');

const inventoryController = require('../controllers/inventoryController');
const { isManagerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(isManagerOrAdmin);

router.get('/', inventoryController.getAllItems);
router.get('/export.csv', inventoryController.exportItems);
router.get('/add', inventoryController.renderAddItemForm);
router.post('/add', inventoryController.createItem);
router.get('/edit/:id', inventoryController.renderEditItemForm);
router.post('/edit/:id', inventoryController.updateItem);

// Deleting used to be a GET link, so any crawler, link prefetcher or image
// tag pointing at the URL could remove an item without a form submission.
router.post('/delete/:id', inventoryController.deleteItem);

module.exports = router;
