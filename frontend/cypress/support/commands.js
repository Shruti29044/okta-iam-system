/**
 * cy.loginAsAdmin()
 *
 * Bypasses the Okta UI login entirely by writing fake-but-structurally-valid
 * token objects directly into localStorage under the key `okta-token-storage`.
 *
 * @okta/okta-auth-js reads this key on startup and treats the session as
 * authenticated without making any network calls to Okta.
 *
 * After injecting the tokens we visit the target page.  All backend API calls
 * (/api/admin/*) must be stubbed with cy.intercept() in each test.
 */

const OKTA_ISSUER   = 'https://integrator-9748686.okta.com/oauth2/default';
const OKTA_CLIENT_ID = '0oa110x22ykmv9k1O698';
const AUTHORIZE_URL  = `${OKTA_ISSUER}/v1/authorize`;
const USERINFO_URL   = `${OKTA_ISSUER}/v1/userinfo`;
const FAR_FUTURE     = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8 hours

// Fake access token — used by AdminDashboard as a Bearer token in API calls
const FAKE_ACCESS_TOKEN = 'fake-cypress-access-token';

// Fake ID token — must look like a base64url-encoded JWT (header.payload.sig)
// Real JWTs aren't needed since we never call verifyAccessToken in the browser
const FAKE_ID_TOKEN = 'fake.cypress.idtoken';

const buildTokenStorage = (role = 'Admin') => ({
  accessToken: {
    accessToken: FAKE_ACCESS_TOKEN,
    claims: {
      sub: 'admin@cypress.test',
      iat: Math.floor(Date.now() / 1000),
      exp: FAR_FUTURE,
      groups: [role, 'Everyone'],
    },
    expiresAt: FAR_FUTURE,
    tokenType: 'Bearer',
    scopes: ['openid', 'profile', 'email'],
    authorizeUrl: AUTHORIZE_URL,
    userinfoUrl: USERINFO_URL,
  },
  idToken: {
    idToken: FAKE_ID_TOKEN,
    claims: {
      sub: 'admin@cypress.test',
      name: 'Cypress Admin',
      email: 'admin@cypress.test',
      preferred_username: 'admin@cypress.test',
      amr: ['pwd', 'mfa'],
      groups: [role, 'Everyone'],
      iat: Math.floor(Date.now() / 1000),
      exp: FAR_FUTURE,
    },
    expiresAt: FAR_FUTURE,
    scopes: ['openid', 'profile', 'email'],
    authorizeUrl: AUTHORIZE_URL,
    issuer: OKTA_ISSUER,
    clientId: OKTA_CLIENT_ID,
  },
});

Cypress.Commands.add('loginAsAdmin', () => {
  // Inject tokens before the app loads so the Security provider sees them immediately
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem(
        'okta-token-storage',
        JSON.stringify(buildTokenStorage('Admin'))
      );
    },
  });
});

Cypress.Commands.add('loginAsManager', () => {
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem(
        'okta-token-storage',
        JSON.stringify(buildTokenStorage('Manager'))
      );
    },
  });
});

// Reusable fixture stubs for the three most-used admin API endpoints
Cypress.Commands.add('stubAdminApis', () => {
  cy.intercept('GET', '/api/admin/users', { fixture: 'users.json' }).as('getUsers');
  cy.intercept('GET', '/api/admin/groups', { fixture: 'groups.json' }).as('getGroups');
  cy.intercept('GET', '/api/admin/audit-logs*', { fixture: 'auditLogs.json' }).as('getAuditLogs');
  cy.intercept('GET', '/api/admin/logs*', { fixture: 'systemLogs.json' }).as('getSystemLogs');
});
