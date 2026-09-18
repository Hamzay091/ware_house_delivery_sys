const path = require('path');
const crypto = require('crypto');

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;

dotenv.config();

const User = require('./models/user');
const Notification = require('./models/notification');
const flash = require('./middleware/flash');
const { csrfProtection } = require('./middleware/csrf');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

/* ---------------------------------------------------------------------------
 * Configuration guards — fail loudly at boot rather than silently running
 * with an undefined session secret (which makes every cookie forgeable).
 * ------------------------------------------------------------------------- */
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  console.error('❌ SECRET_KEY is not set. Copy .env.example to .env and set a long random value.');
  process.exit(1);
}
if (isProduction && SECRET_KEY.length < 32) {
  console.error('❌ SECRET_KEY is too short for production. Use at least 32 random characters.');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/warehouseDB';

/* ---------------------------------------------------------------------------
 * Base middleware
 * ------------------------------------------------------------------------- */
if (isProduction) {
  // Required for secure cookies and correct client IPs behind a proxy.
  app.set('trust proxy', 1);
}

app.use(compression());
app.use(morgan(isProduction ? 'combined' : 'dev'));

// A per-response nonce lets the few inline scripts in the views run under a
// strict Content-Security-Policy without opening up 'unsafe-inline'.
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      scriptSrc: [
        "'self'",
        (req, res) => `'nonce-${res.locals.cspNonce}'`,
        'https://cdn.jsdelivr.net',
        'https://unpkg.com'
      ],
      // Inline style attributes are used throughout the templates.
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        'https://unpkg.com'
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
      // OpenStreetMap raster tiles for the route map.
      imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'https://unpkg.com'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  // Google sign-in redirects back to us; a strict referrer policy is fine.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProduction ? '7d' : 0
}));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

app.use(session({
  name: 'apex.sid',
  secret: SECRET_KEY,
  resave: false,
  // Do not persist a session for visitors who never log in or flash anything.
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 7
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash);

/* ---------------------------------------------------------------------------
 * Database
 * ------------------------------------------------------------------------- */
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

/* ---------------------------------------------------------------------------
 * Authentication strategies
 * ------------------------------------------------------------------------- */
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    // The same message for "no such user" and "wrong password" so the form
    // cannot be used to enumerate which email addresses have accounts.
    if (!user) return done(null, false, { message: 'Invalid email or password.' });
    if (!user.password) {
      return done(null, false, { message: 'This account uses Google sign-in. Continue with Google instead.' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return done(null, false, { message: 'Invalid email or password.' });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (user) return done(null, user);

      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      if (!email) return done(null, false, { message: 'Your Google account has no verified email address.' });

      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.googleId = profile.id;
        await user.save();
        return done(null, user);
      }
      // Brand new account: hand the profile back so the caller can ask for a role.
      return done(null, false, { profile });
    } catch (err) {
      return done(err);
    }
  }));
} else {
  console.warn('⚠️  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google sign-in is disabled.');
}
app.locals.googleAuthEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    // A deleted user must not keep a working session.
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

/* ---------------------------------------------------------------------------
 * View locals
 * ------------------------------------------------------------------------- */
app.use(async (req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.unreadCount = 0;

  if (req.user && (req.user.role === 'Admin' || req.user.role === 'Manager')) {
    try {
      res.locals.unreadCount = await Notification.countDocuments({
        userId: req.user._id,
        status: 'unread'
      });
    } catch (err) {
      // A badge count is never worth failing a page render over.
      console.error('Could not load unread notification count:', err.message);
    }
  }
  next();
});

// Registered after the view locals so that a rejected request can still
// render the error page with a working navbar.
app.use(csrfProtection);

/* ---------------------------------------------------------------------------
 * Rate limiting — credential stuffing protection on the auth endpoints.
 * ------------------------------------------------------------------------- */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: 'Too many attempts from this address. Please wait 15 minutes and try again.'
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many messages sent. Please try again later.'
});

// The contact form posts to '/', so the limiters are matched on method+path
// rather than mounted, to avoid throttling ordinary page loads.
const AUTH_PATHS = new Set(['/login', '/register']);
const CONTACT_PATHS = new Set(['/', '/contact']);

app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  if (AUTH_PATHS.has(req.path)) return authLimiter(req, res, next);
  if (CONTACT_PATHS.has(req.path)) return contactLimiter(req, res, next);
  return next();
});

/* ---------------------------------------------------------------------------
 * Routes
 * ------------------------------------------------------------------------- */
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
// contactRoutes existed but was never mounted, so the "mark as read" button
// on the messages page posted to a URL that returned 404.
app.use('/messages', require('./routes/contactRoutes'));

/* ---------------------------------------------------------------------------
 * 404 and error handling
 * ------------------------------------------------------------------------- */
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    status: 404,
    heading: 'We could not find that page',
    detail: 'The link may be out of date, or the page may have moved.'
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('Unhandled error:', err);

  if (req.accepts('html')) {
    return res.status(status).render('error', {
      title: status === 403 ? 'Access denied' : 'Something went wrong',
      status,
      heading: status === 403 ? 'Access denied' : 'Something went wrong',
      detail: status < 500
        ? err.message
        : 'An unexpected error occurred on our side. Please try again.'
    });
  }
  return res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

module.exports = app;
