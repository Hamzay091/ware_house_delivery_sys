const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config(); 

const app = express();


app.use(express.static(path.join(__dirname, 'public')));


app.set('views', path.join(__dirname, 'views'));


app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SECRET_KEY, resave: false, saveUninitialized: true }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Error:', err));


app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.error = req.query.error;
  next();
});


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