/**
 * Users tab — table, pagination, modals, confirmation dialogs.
 */

describe('Users tab', () => {
  beforeEach(() => {
    cy.stubAdminApis();
    cy.loginAsAdmin();
    cy.visit('/admin');
    cy.wait('@getUsers');
    cy.wait('@getGroups');
  });

  // ── Table structure ──────────────────────────────────────────────────────────

  it('renders the correct column headers', () => {
    cy.get('table th').eq(0).should('contain', 'Name');
    cy.get('table th').eq(1).should('contain', 'Email');
    cy.get('table th').eq(2).should('contain', 'Status');
    cy.get('table th').eq(3).should('contain', 'Actions');
  });

  it('renders a row for each user from the fixture', () => {
    cy.get('table tbody tr').should('have.length', 3);
  });

  it('shows user names correctly', () => {
    cy.contains('td', 'Alice Smith').should('be.visible');
    cy.contains('td', 'Bob Jones').should('be.visible');
    cy.contains('td', 'Carol White').should('be.visible');
  });

  it('shows user emails', () => {
    cy.contains('td', 'alice@example.com').should('be.visible');
  });

  it('shows ACTIVE badge for active users', () => {
    cy.contains('span', 'ACTIVE').should('be.visible');
  });

  it('shows DEPROVISIONED badge for deprovisioned users', () => {
    cy.contains('span', 'DEPROVISIONED').should('be.visible');
  });

  it('shows Disable button for ACTIVE users', () => {
    cy.contains('tr', 'Alice Smith').contains('button', 'Disable').should('be.visible');
  });

  it('shows Enable button for DEPROVISIONED users', () => {
    cy.contains('tr', 'Carol White').contains('button', 'Enable').should('be.visible');
  });

  it('shows Manage Groups button for every user', () => {
    cy.get('table tbody tr').each(($row) => {
      // Use synchronous jQuery inside .each() — cy.* commands cannot be queued here in Cypress v15
      const found = $row.find('button').toArray().some((el) => el.textContent.trim() === 'Manage Groups');
      expect(found, 'row has Manage Groups button').to.be.true;
    });
  });

  it('shows Delete button for every user', () => {
    cy.get('table tbody tr').each(($row) => {
      const found = $row.find('button').toArray().some((el) => el.textContent.trim() === 'Delete');
      expect(found, 'row has Delete button').to.be.true;
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────────────

  it('shows pagination bar below the table', () => {
    cy.contains('3 users').should('be.visible');
    cy.contains('Page 1 of 1').should('be.visible');
  });

  it('Previous button is disabled on page 1', () => {
    cy.contains('button', '← Previous').should('be.disabled');
  });

  it('Next button is disabled when all users fit on one page', () => {
    cy.contains('button', 'Next →').should('be.disabled');
  });

  // ── Manage Groups modal ───────────────────────────────────────────────────────

  it('opens Manage Groups modal when button is clicked', () => {
    cy.intercept('GET', '/api/admin/users/00u1abc/groups', [
      { id: '00g1aaa', profile: { name: 'Admin' } },
    ]).as('getUserGroups');

    cy.contains('tr', 'Alice Smith').contains('button', 'Manage Groups').click();
    cy.wait('@getUserGroups');

    cy.contains('Groups for Alice Smith').should('be.visible');
  });

  it('Manage Groups modal shows current groups', () => {
    cy.intercept('GET', '/api/admin/users/00u1abc/groups', [
      { id: '00g1aaa', profile: { name: 'Admin' } },
      { id: '00g4ddd', profile: { name: 'Everyone' } },
    ]).as('getUserGroups');

    cy.contains('tr', 'Alice Smith').contains('button', 'Manage Groups').click();
    cy.wait('@getUserGroups');

    // Admin should appear (removable); Everyone should be filtered out
    cy.contains('Admin').should('be.visible');
    cy.contains('Everyone').should('not.exist');
  });

  it('Manage Groups modal has a Close button', () => {
    cy.intercept('GET', '/api/admin/users/00u1abc/groups', []).as('getUserGroups');
    cy.contains('tr', 'Alice Smith').contains('button', 'Manage Groups').click();
    cy.wait('@getUserGroups');
    cy.contains('button', 'Close').should('be.visible');
  });

  it('closes Manage Groups modal on Close click', () => {
    cy.intercept('GET', '/api/admin/users/00u1abc/groups', []).as('getUserGroups');
    cy.contains('tr', 'Alice Smith').contains('button', 'Manage Groups').click();
    cy.wait('@getUserGroups');
    cy.contains('button', 'Close').click();
    cy.contains('Groups for Alice Smith').should('not.exist');
  });

  // ── Delete confirmation dialog ────────────────────────────────────────────────

  it('Delete button triggers a confirmation dialog', () => {
    cy.on('window:confirm', (msg) => {
      expect(msg).to.include('alice@example.com');
      expect(msg).to.include('cannot be undone');
      return false; // cancel — don't actually delete
    });
    cy.contains('tr', 'Alice Smith').contains('button', 'Delete').click();
  });

  it('cancelling the delete dialog keeps the user in the list', () => {
    cy.on('window:confirm', () => false); // cancel
    cy.contains('tr', 'Alice Smith').contains('button', 'Delete').click();
    cy.contains('td', 'Alice Smith').should('still.exist');
  });

  it('confirming delete removes user from list', () => {
    cy.intercept('DELETE', '/api/admin/users/00u1abc', { message: 'deleted' }).as('deleteUser');
    cy.on('window:confirm', () => true); // confirm
    cy.contains('tr', 'Alice Smith').contains('button', 'Delete').click();
    cy.wait('@deleteUser');
    cy.contains('td', 'Alice Smith').should('not.exist');
  });
});
