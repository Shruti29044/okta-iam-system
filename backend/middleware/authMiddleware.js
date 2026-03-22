const OktaJwtVerifier = require('@okta/jwt-verifier');

const jwtVerifier = new OktaJwtVerifier({
  issuer: process.env.OKTA_ISSUER,
  clientId: process.env.OKTA_CLIENT_ID,
});

// Default Okta audience for the built-in authorization server.
// Override with OKTA_AUDIENCE in .env if you use a custom one.
const AUDIENCE = process.env.OKTA_AUDIENCE || 'api://default';

/**
 * ensureAuthenticated
 *
 * Accepts either:
 *   1. A Passport session cookie  (backend-initiated OIDC flow)
 *   2. Authorization: Bearer <access_token>  (SPA / @okta/okta-react flow)
 *
 * On success, req.user is always in the shape:
 *   { id, _json: { email, groups } }
 * so requireRole() works identically for both paths.
 */
const ensureAuthenticated = async (req, res, next) => {
  // ── Path 1: existing Passport session ──────────────────────────────────────
  if (req.isAuthenticated()) return next();

  // ── Path 2: Bearer token ────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: please log in' });
  }

  const token = authHeader.slice(7); // strip "Bearer "
  try {
    const jwt = await jwtVerifier.verifyAccessToken(token, AUDIENCE);

    // Normalize into the same shape Passport sets on req.user
    req.user = {
      id: jwt.claims.sub,
      _json: {
        email:  jwt.claims.sub,
        groups: jwt.claims.groups ?? [],
      },
    };

    next();
  } catch (err) {
    res.status(401).json({ error: `Unauthorized: ${err.message}` });
  }
};

/**
 * requireRole(...groups) – RBAC gate based on Okta group membership.
 * Works for both session-based and JWT-based auth since ensureAuthenticated
 * normalises req.user into the same shape for both.
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: please log in' });
    }

    const userGroups = req.user._json?.groups ?? [];
    const hasRole = roles.some((r) => userGroups.includes(r));

    if (!hasRole) {
      return res
        .status(403)
        .json({ error: `Forbidden: requires one of [${roles.join(', ')}]` });
    }

    next();
  };
};

module.exports = { ensureAuthenticated, requireRole };
