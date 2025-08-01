const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('./models/user');

dotenv.config();

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Error:', err));

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
        const user = await User.findOne({ email: email });
        if (!user) {
            return done(null, false, { message: 'Invalid email or password.' });
        }
        if (!user.password) {
            return done(null, false, { message: 'Please log in with Google.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return done(null, false, { message: 'Invalid email or password.' });
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (user) { return done(null, user); }
      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        user.googleId = profile.id;
        await user.save();
        return done(null, user);
      }
      return done(null, false, { profile: profile });
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

app.use((req, res, next) => {
  res.locals.user = req.user || null;
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
app.use('/notifications', require('./routes/notificationRoutes')); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));