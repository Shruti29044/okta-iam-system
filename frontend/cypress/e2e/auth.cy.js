/**
 * Auth tests — no login required.
 * Verifies the public login page and unauthenticated redirects.
 */

describe('Authentication — login page', () => {
  beforeEach(() => {
    // Clear any stored tokens so we're definitely unauthenticated
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('shows the login page at /', () => {
    cy.contains('Okta IAM System').should('be.visible');
  });

  it('shows the Sign In button', () => {
    cy.contains('button', 'Sign In with Okta').should('be.visible');
  });

  it('Sign In button is clickable (does not throw)', () => {
    // We just verify it is interactive — actual Okta redirect is external
    cy.contains('button', 'Sign In with Okta').should('not.be.disabled');
  });

  it('navbar shows Login link when unauthenticated', () => {
    cy.get('nav').contains('Login').should('be.visible');
  });

  it('navbar does not show Admin link when unauthenticated', () => {
    cy.get('nav').contains('Admin').should('not.exist');
  });
});

describe('Authentication — protected route redirects', () => {
  beforeEach(() => cy.clearLocalStorage());

  it('redirects /admin to / when unauthenticated', () => {
    cy.visit('/admin');
    // ProtectedRoute returns <Navigate to="/" /> for unauthenticated users
    cy.location('pathname').should('eq', '/');
  });

  it('redirects /manager to / when unauthenticated', () => {
    cy.visit('/manager');
    cy.location('pathname').should('eq', '/');
  });

  it('redirects /dashboard to / when unauthenticated', () => {
    cy.visit('/dashboard');
    cy.location('pathname').should('eq', '/');
  });
});
