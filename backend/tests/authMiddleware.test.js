/**
 * Auth middleware tests
 *
 * We test ensureAuthenticated and requireRole by mounting a tiny
 * Express app with a protected route and hitting it via supertest.
 */

// Mock jwt-verifier before any module loads it
jest.mock('@okta/jwt-verifier', () => {
  return jest.fn().mockImplementation(() => ({
    verifyAccessToken: jest.fn(),
  }));
});

// Mock the Okta SDK client used in oktaService / authMiddleware
jest.mock('@okta/okta-sdk-nodejs', () => ({
  Client: jest.fn().mockImplementation(() => ({})),
}));

const request  = require('supertest');
const express  = require('express');
const session  = require('express-session');
const passport = require('passport');

// Pull in the mocked verifier instance so we can control its behaviour per test
const OktaJwtVerifier   = require('@okta/jwt-verifier');
const { ensureAuthenticated, requireRole } = require('../middleware/authMiddleware');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal Express app with one protected GET /protected route. */
const makeApp = (extraMiddleware = []) => {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((u, done) => done(null, u));
  passport.deserializeUser((u, done) => done(null, u));

  app.get('/protected', ensureAuthenticated, ...extraMiddleware, (_req, res) =>
    res.json({ ok: true })
  );
  return app;
};

// ── ensureAuthenticated ───────────────────────────────────────────────────────

describe('ensureAuthenticated', () => {
  test('blocks requests with no credentials → 401', async () => {
    const app = makeApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized/);
  });

  test('blocks requests with a non-Bearer Authorization header → 401', async () => {
    const app = makeApp();
    const res = await request(app).get('/protected').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  test('rejects an invalid Bearer token → 401', async () => {
    // Make the verifier throw for this test
    const instance = OktaJwtVerifier.mock.results[0].value;
    instance.verifyAccessToken.mockRejectedValueOnce(new Error('Token expired'));

    const app = makeApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Token expired/);
  });

  test('accepts a valid Bearer token → 200 and populates req.user', async () => {
    const instance = OktaJwtVerifier.mock.results[0].value;
    instance.verifyAccessToken.mockResolvedValueOnce({
      claims: { sub: 'admin@example.com', groups: ['Admin'] },
    });

    const app = makeApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── requireRole ───────────────────────────────────────────────────────────────

describe('requireRole', () => {
  /** Builds an app where the route requires a specific role. */
  const makeRoleApp = (...roles) => {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use(passport.initialize());
    app.use(passport.session());
    passport.serializeUser((u, done) => done(null, u));
    passport.deserializeUser((u, done) => done(null, u));

    app.get(
      '/admin',
      ensureAuthenticated,
      requireRole(...roles),
      (_req, res) => res.json({ ok: true })
    );
    return app;
  };

  const validTokenFor = (groups) => {
    const instance = OktaJwtVerifier.mock.results[0].value;
    instance.verifyAccessToken.mockResolvedValueOnce({
      claims: { sub: 'user@example.com', groups },
    });
  };

  test('allows access when user has the required role', async () => {
    validTokenFor(['Admin']);
    const res = await request(makeRoleApp('Admin'))
      .get('/admin')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
  });

  test('blocks access when user lacks the required role → 403', async () => {
    validTokenFor(['Employee']);
    const res = await request(makeRoleApp('Admin'))
      .get('/admin')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/);
  });

  test('allows access when user has any one of multiple accepted roles', async () => {
    validTokenFor(['Manager']);
    const res = await request(makeRoleApp('Admin', 'Manager'))
      .get('/admin')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
  });

  test('blocks user with empty groups array → 403', async () => {
    validTokenFor([]);
    const res = await request(makeRoleApp('Admin'))
      .get('/admin')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(403);
  });
});
