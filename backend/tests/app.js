/**
 * Testable Express app — no listen(), no real MongoDB connection.
 * Tests import this and pass it to supertest.
 */
require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const passport = require('passport');

const adminRoutes = require('../routes/userRoutes');

const app = express();

app.use(express.json());

app.use(
  session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Minimal Passport serialization so session tests work
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use('/api/admin', adminRoutes);

module.exports = app;
