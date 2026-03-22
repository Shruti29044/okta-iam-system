require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const passport = require('passport');
const cors     = require('cors');
const mongoose = require('mongoose');

const configureOkta = require('./config/oktaConfig');
const authRoutes    = require('./routes/authRoutes');
const adminRoutes   = require('./routes/userRoutes');

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,   // set true behind HTTPS in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Configure Passport OIDC strategy
configureOkta(passport);

// Routes
app.use('/api/auth',  authRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected ✅'))
  .catch((err) => console.error('MongoDB connection error ❌:', err.message));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
