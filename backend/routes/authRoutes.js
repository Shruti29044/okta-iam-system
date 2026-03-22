const express  = require('express');
const passport = require('passport');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// ── Initiate OIDC login ───────────────────────────────────────────────────────
// GET /api/auth/login
router.get('/login', passport.authenticate('oidc'));

// ── OIDC callback ─────────────────────────────────────────────────────────────
// GET /api/auth/callback
router.get(
  '/callback',
  passport.authenticate('oidc', { failureRedirect: 'http://localhost:3000/?error=auth_failed' }),
  (_req, res) => {
    res.redirect('http://localhost:3000/dashboard');
  }
);

// ── Logout ────────────────────────────────────────────────────────────────────
// GET /api/auth/logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    const postLogoutUri = encodeURIComponent('http://localhost:3000');
    const logoutUrl =
      `${process.env.OKTA_ISSUER}/v1/logout` +
      `?post_logout_redirect_uri=${postLogoutUri}` +
      `&id_token_hint=${req.user?.id || ''}` +
      `&client_id=${process.env.OKTA_CLIENT_ID}`;
    res.redirect(logoutUrl);
  });
});

// ── Current user info + login audit ──────────────────────────────────────────
// GET /api/auth/me
router.get('/me', ensureAuthenticated, async (req, res) => {
  const { id, displayName, _json = {} } = req.user;
  const email = _json.email ?? _json.preferred_username ?? id;

  // Fire-and-forget: log this session check as a login event
  AuditLog.create({
    action:      'USER_LOGIN',
    performedBy: email,
    targetUser:  email,
    targetGroup: null,
    status:      'SUCCESS',
    details:     { displayName, groups: _json.groups ?? [] },
  }).catch((err) => console.error('[audit] USER_LOGIN failed:', err.message));

  res.json({
    id,
    displayName,
    email,
    login:  _json.preferred_username,
    groups: _json.groups ?? [],
  });
});

module.exports = router;
