const User = require('../models/user');
const Delivery = require('../models/delivery');
const Item = require('../models/item');
const Stock = require('../models/stock');

// Helper function to render a list of users by role
const renderUserList = async (req, res, role, pageTitle) => {
  try {
    const users = await User.find({ role });
    res.render('admin-user-list', { users, title: pageTitle });
  } catch (error) {
    console.error(`Error fetching ${role}s:`, error);
    res.status(500).send(`Error loading page for ${role}s.`);
  }
};

// Show a list of all Managers
exports.viewAllManagers = (req, res) => {
  renderUserList(req, res, 'Manager', 'All Managers');
};

// Show a list of all Delivery Staff
exports.viewAllDeliveryStaff = (req, res) => {
  renderUserList(req, res, 'DeliveryStaff', 'All Delivery Staff');
};

// Show a detailed view of a single user and their work
exports.viewUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const deliveries = await Delivery.find({ assignedTo: user.name })
      .populate({ path: 'items.itemId', model: 'Item' })
      .sort({ createdAt: -1 });

    res.render('admin-user-detail', { user, deliveries });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).send('Error loading user detail page.');
  }
};

// Allows admin to see the manager dashboard exactly as a manager would
exports.viewAsManager = async (req, res) => {
  try {
    const deliveries = await Delivery.find()
      .sort({ updatedAt: -1 })
      .populate({
        path: 'items.itemId',
        model: 'Item',
        populate: { path: 'stockId', model: 'Stock' }
      });
    // We re-use the manager dashboard view but pass a flag
    res.render('dashboard-manager', { deliveries, isAdminView: true });
  } catch (error) {
    console.error("Error fetching manager dashboard for admin:", error);
    res.status(500).send("Error loading manager dashboard view.");
  }
};