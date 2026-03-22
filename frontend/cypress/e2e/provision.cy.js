/**
 * User & Group Setup tab — form validation, create user, create group.
 */

describe('User & Group Setup tab', () => {
  beforeEach(() => {
    cy.stubAdminApis();
    cy.loginAsAdmin();
    cy.visit('/admin');
    cy.wait('@getUsers');
    cy.wait('@getGroups');
    cy.contains('button', 'User & Group Setup').click();
  });

  // ── Create New User form ──────────────────────────────────────────────────────

  it('shows the Create New User card', () => {
    cy.contains('h3', 'Create New User').should('be.visible');
  });

  it('shows all required input fields', () => {
    cy.contains('h3', 'Create New User').parents('[style]').first().within(() => {
      cy.get('input[placeholder="First name"]').should('be.visible');
      cy.get('input[placeholder="Last name"]').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
    });
  });

  it('shows group assignment dropdown populated from fixture', () => {
    cy.contains('h3', 'Create New User').parents('[style]').first().within(() => {
      cy.get('select').should('contain', 'Admin');
      cy.get('select').should('contain', 'Manager');
      cy.get('select').should('contain', 'Employee');
    });
  });

  it('shows the Create & Send Invite submit button', () => {
    cy.contains('button', 'Create & Send Invite').should('be.visible');
  });

  it('does not submit with empty fields (HTML5 validation)', () => {
    cy.contains('button', 'Create & Send Invite').click();
    // Browser prevents submission — form stays visible
    cy.contains('h3', 'Create New User').should('be.visible');
  });

  it('submits the form and shows success message', () => {
    cy.intercept('POST', '/api/admin/users', {
      statusCode: 201,
      body: { message: 'User created — activation email sent', user: { id: 'u-new' } },
    }).as('createUser');
    // Also stub the users refresh
    cy.intercept('GET', '/api/admin/users', { fixture: 'users.json' }).as('refreshUsers');

    cy.contains('h3', 'Create New User').parents('[style]').first().within(() => {
      cy.get('input[placeholder="First name"]').type('Test');
      cy.get('input[placeholder="Last name"]').type('User');
      cy.get('input[type="email"]').type('test@example.com');
    });
    cy.contains('button', 'Create & Send Invite').click();

    cy.wait('@createUser');
    cy.contains('activation email sent').should('be.visible');
  });

  it('shows error message on create user failure', () => {
    cy.intercept('POST', '/api/admin/users', {
      statusCode: 500,
      body: { error: 'User already exists' },
    }).as('createUserFail');

    cy.contains('h3', 'Create New User').parents('[style]').first().within(() => {
      cy.get('input[placeholder="First name"]').type('Dup');
      cy.get('input[placeholder="Last name"]').type('User');
      cy.get('input[type="email"]').type('existing@example.com');
    });
    cy.contains('button', 'Create & Send Invite').click();

    cy.wait('@createUserFail');
    cy.contains('User already exists').should('be.visible');
  });

  it('clears the form after successful creation', () => {
    cy.intercept('POST', '/api/admin/users', { statusCode: 201, body: { message: 'ok', user: {} } }).as('createUser');
    cy.intercept('GET', '/api/admin/users', { fixture: 'users.json' }).as('refreshUsers');

    cy.contains('h3', 'Create New User').parents('[style]').first().within(() => {
      cy.get('input[placeholder="First name"]').type('Clear');
      cy.get('input[placeholder="Last name"]').type('Me');
      cy.get('input[type="email"]').type('clear@example.com');
    });
    cy.contains('button', 'Create & Send Invite').click();
    cy.wait('@createUser');

    cy.contains('h3', 'Create New User').parents('[style]').first().within(() => {
      cy.get('input[placeholder="First name"]').should('have.value', '');
      cy.get('input[placeholder="Last name"]').should('have.value', '');
      cy.get('input[type="email"]').should('have.value', '');
    });
  });

  // ── Create New Group form ────────────────────────────────────────────────────

  it('shows the Create New Group card', () => {
    cy.contains('h3', 'Create New Group').should('be.visible');
  });

  it('shows group name and description inputs', () => {
    cy.contains('h3', 'Create New Group').parents('[style]').first().within(() => {
      cy.get('input[placeholder="Group name"]').should('be.visible');
      cy.get('input[placeholder="Description (optional)"]').should('be.visible');
    });
  });

  it('shows the Create Group button', () => {
    cy.contains('h3', 'Create New Group').parents('[style]').first().within(() => {
      cy.contains('button', 'Create Group').should('be.visible');
    });
  });

  it('requires group name (HTML5 validation)', () => {
    cy.contains('h3', 'Create New Group').parents('[style]').first().within(() => {
      cy.contains('button', 'Create Group').click();
    });
    cy.contains('h3', 'Create New Group').should('be.visible');
  });

  it('shows success message after creating a group', () => {
    cy.intercept('POST', '/api/admin/groups', {
      statusCode: 201,
      body: { message: 'Group created', group: { id: 'g-new', profile: { name: 'DevOps' } } },
    }).as('createGroup');
    cy.intercept('GET', '/api/admin/groups', { fixture: 'groups.json' }).as('refreshGroups');

    cy.contains('h3', 'Create New Group').parents('[style]').first().within(() => {
      cy.get('input[placeholder="Group name"]').type('DevOps');
      cy.get('input[placeholder="Description (optional)"]').type('DevOps team');
      cy.contains('button', 'Create Group').click();
    });

    cy.wait('@createGroup');
    cy.contains('Group "DevOps" created').should('be.visible');
  });

  it('shows error message when group creation fails', () => {
    cy.intercept('POST', '/api/admin/groups', {
      statusCode: 500,
      body: { error: 'Group already exists' },
    }).as('createGroupFail');

    cy.contains('h3', 'Create New Group').parents('[style]').first().within(() => {
      cy.get('input[placeholder="Group name"]').type('Admin');
      cy.contains('button', 'Create Group').click();
    });

    cy.wait('@createGroupFail');
    cy.contains('Group already exists').should('be.visible');
  });

  it('clears the group form after successful creation', () => {
    cy.intercept('POST', '/api/admin/groups', {
      statusCode: 201,
      body: { message: 'Group created', group: { id: 'g-new', profile: { name: 'DevOps' } } },
    }).as('createGroup');
    cy.intercept('GET', '/api/admin/groups', { fixture: 'groups.json' }).as('refreshGroups');

    cy.contains('h3', 'Create New Group').parents('[style]').first().within(() => {
      cy.get('input[placeholder="Group name"]').type('DevOps');
      cy.contains('button', 'Create Group').click();
    });

    cy.wait('@createGroup');

    cy.contains('h3', 'Create New Group').parents('[style]').first().within(() => {
      cy.get('input[placeholder="Group name"]').should('have.value', '');
    });
  });
});
