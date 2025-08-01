const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController'); 
const { isAuthenticated, isManagerOrAdmin } = require('../middleware/authMiddleware'); 

router.get('/', isAuthenticated, isManagerOrAdmin, inventoryController.getAllItems);
router.get('/add', isAuthenticated, isManagerOrAdmin, inventoryController.renderAddItemForm);
router.post('/add', isAuthenticated, isManagerOrAdmin, inventoryController.createItem);
router.get('/edit/:id', isAuthenticated, isManagerOrAdmin, inventoryController.renderEditItemForm);
router.post('/edit/:id', isAuthenticated, isManagerOrAdmin, inventoryController.updateItem);
router.get('/delete/:id', isAuthenticated, isManagerOrAdmin, inventoryController.deleteItem);

module.exports = router;