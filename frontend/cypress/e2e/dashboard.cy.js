/**
 * Admin Dashboard — general layout and tab switching.
 */

describe('Admin Dashboard', () => {
  beforeEach(() => {
    cy.stubAdminApis();
    cy.loginAsAdmin();
    cy.visit('/admin');
    cy.wait('@getUsers');
    cy.wait('@getGroups');
  });

  it('loads the Admin Dashboard heading', () => {
    cy.contains('h2', 'Admin Dashboard').should('be.visible');
  });

  it('shows the signed-in admin name', () => {
    cy.contains('Cypress Admin').should('be.visible');
  });

  it('renders all five tab buttons', () => {
    cy.contains('button', /Users/).should('be.visible');
    cy.contains('button', 'User & Group Setup').should('be.visible');
    cy.contains('button', 'System Logs').should('be.visible');
    cy.contains('button', /Groups/).should('be.visible');
    cy.contains('button', 'Audit Logs').should('be.visible');
  });

  it('Users tab is active by default', () => {
    cy.contains('button', /Users \(/).should('have.css', 'font-weight', '700');
  });

  it('switches to System Logs tab', () => {
    cy.contains('button', 'System Logs').click();
    cy.contains('Last 50 events').should('be.visible');
  });

  it('switches to Audit Logs tab and triggers fetch', () => {
    cy.contains('button', 'Audit Logs').click();
    cy.wait('@getAuditLogs');
    cy.contains('Last 100 internal audit events').should('be.visible');
  });

  it('switches to User & Group Setup tab', () => {
    cy.contains('button', 'User & Group Setup').click();
    cy.contains('h3', 'Create New User').should('be.visible');
    cy.contains('h3', 'Create New Group').should('be.visible');
  });

  it('switches to Groups tab', () => {
    cy.contains('button', /^Groups/).click();
    cy.contains('th', 'Group Name').should('be.visible');
  });

  it('MFA badge is visible in the header', () => {
    // MfaBadge renders something relating to MFA status
    cy.get('[class*="badge"], span').contains(/MFA|Auth/).should('exist');
  });

  it('navbar shows Admin link when authenticated as Admin', () => {
    cy.get('nav').contains('Admin').should('be.visible');
  });

  it('navbar shows Logout button', () => {
    cy.get('nav').contains('button', 'Logout').should('be.visible');
  });
});
