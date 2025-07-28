const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file from the current directory ('backend/')
dotenv.config(); 

const app = express();

// --- CORRECTED CONFIGURATION ---

// 1. Tell Express that the 'public' folder is in the same directory as this file.
app.use(express.static(path.join(__dirname, 'public')));

// 2. Tell Express that the 'views' folder is in the same directory as this file.
app.set('views', path.join(__dirname, 'views'));

// 3. Tell Express the view engine is EJS.
app.set('view engine', 'ejs');

// 4. Set up other necessary middleware.
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SECRET_KEY, resave: false, saveUninitialized: true }));

// --- END OF CONFIGURATION ---

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Make user session available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.error = req.query.error;
  next();
});

// Route Mounting (These paths are now correct)
app.use('/', require('./routes/pageRoutes'));
app.use('/', require('./routes/authRoutes'));
app.use('/', require('./routes/dashboardRoutes'));
app.use('/ai', require('./routes/aiRoutes'));
app.use('/api', require('./routes/apiRoutes'));
app.use('/inventory', require('./routes/inventoryRoutes'));
app.use('/deliveries', require('./routes/deliveryRoutes'));
app.use('/users', require('./routes/userRoutes'));
app.use('/billing', require('./routes/billingRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));