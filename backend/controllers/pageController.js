const Item = require('../models/item');
const Contact = require('../models/contact');

exports.renderHomePage = (req, res) => {

  res.render('index', { message: null });
};


exports.handleContactForm = async (req, res) => {
  try {
    await Contact.create(req.body);
    
    res.render('index', { message: 'Thank you for your message! We will get back to you soon.' });
  } catch (error) {
    console.error('Contact form submission error:', error);
  
    res.render('index', { message: 'Sorry, there was an error sending your message.' });
  }
};

exports.renderProfilePage = (req, res) => res.render('profile');

exports.renderStockCataloguePage = async (req, res) => {
  try {
    const items = await Item.find().populate('stockId');
    items.sort((a, b) => {
      const nameA = a.stockId ? a.stockId.name.toLowerCase() : '';
      const nameB = b.stockId ? b.stockId.name.toLowerCase() : '';
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
    res.render('stock-catalogue', { items });
  } catch (error) {
    console.error("Error fetching stock catalogue:", error);
    res.status(500).send("Error loading stock page.");
  }
};