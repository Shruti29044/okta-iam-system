/**
 * Audit log tests
 *
 * Verifies that every write action produces a MongoDB AuditLog entry
 * with the correct action, status, and readable identifiers.
 * AuditLog.create is mocked — no real DB connection needed.
 */

jest.mock('@okta/okta-sdk-nodejs', () => ({
  Client: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@okta/jwt-verifier', () =>
  jest.fn().mockImplementation(() => ({ verifyAccessToken: jest.fn() }))
);

jest.mock('../services/oktaService');
jest.mock('../models/AuditLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const request     = require('supertest');
const express     = require('express');
const oktaService = require('../services/oktaService');
const AuditLog    = require('../models/AuditLog');

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'admin@test.com', _json: { email: 'admin@test.com', groups: ['Admin'] } };
    req.isAuthenticated = () => true;
    next();
  });
  app.use('/api/admin', require('../routes/userRoutes'));
  return app;
};

beforeEach(() => jest.clearAllMocks());

// ── One test per auditable action ─────────────────────────────────────────────

describe('Audit log — every action writes to MongoDB', () => {
  test('USER_CREATED is logged on success', async () => {
    oktaService.createUser.mockResolvedValueOnce({ id: 'u1', profile: { email: 'a@b.com' } });

    await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'A', lastName: 'B', email: 'a@b.com' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_CREATED', status: 'SUCCESS' })
    );
  });

  test('USER_CREATED is logged on failure', async () => {
    oktaService.createUser.mockRejectedValueOnce(new Error('Okta down'));

    await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'A', lastName: 'B', email: 'a@b.com' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_CREATED', status: 'FAILURE' })
    );
  });

  test('USER_DISABLED is logged on success', async () => {
    oktaService.deactivateUser.mockResolvedValueOnce({});

    await request(makeApp()).put('/api/admin/users/u1/disable');

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_DISABLED', status: 'SUCCESS' })
    );
  });

  test('USER_DISABLED is logged on failure', async () => {
    oktaService.deactivateUser.mockRejectedValueOnce(new Error('fail'));

    await request(makeApp()).put('/api/admin/users/u1/disable');

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_DISABLED', status: 'FAILURE' })
    );
  });

  test('USER_ENABLED is logged on success', async () => {
    oktaService.activateUser.mockResolvedValueOnce({});

    await request(makeApp()).put('/api/admin/users/u1/enable');

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_ENABLED', status: 'SUCCESS' })
    );
  });

  test('USER_ENABLED is logged on failure', async () => {
    oktaService.activateUser.mockRejectedValueOnce(new Error('fail'));

    await request(makeApp()).put('/api/admin/users/u1/enable');

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_ENABLED', status: 'FAILURE' })
    );
  });

  test('USER_DELETED is logged with resolved email on success', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'gone@test.com' } });
    oktaService.deleteUser.mockResolvedValueOnce();

    await request(makeApp()).delete('/api/admin/users/u1');

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_DELETED',
        status: 'SUCCESS',
        targetUser: 'gone@test.com',
      })
    );
  });

  test('USER_DELETED is logged on failure', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'gone@test.com' } });
    oktaService.deleteUser.mockRejectedValueOnce(new Error('fail'));

    await request(makeApp()).delete('/api/admin/users/u1');

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_DELETED', status: 'FAILURE' })
    );
  });

  test('GROUP_ASSIGNED is logged with readable names on success', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'u@test.com' } });
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'Manager' } });
    oktaService.assignUserToGroup.mockResolvedValueOnce({});

    await request(makeApp())
      .post('/api/admin/users/assign-group')
      .send({ userId: 'u1', groupId: 'g1' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GROUP_ASSIGNED',
        status: 'SUCCESS',
        targetUser: 'u@test.com',
        targetGroup: 'Manager',
      })
    );
  });

  test('GROUP_ASSIGNED is logged on failure', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'u@test.com' } });
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'Manager' } });
    oktaService.assignUserToGroup.mockRejectedValueOnce(new Error('fail'));

    await request(makeApp())
      .post('/api/admin/users/assign-group')
      .send({ userId: 'u1', groupId: 'g1' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GROUP_ASSIGNED', status: 'FAILURE' })
    );
  });

  test('GROUP_REMOVED is logged with readable names on success', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'u@test.com' } });
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'Admin' } });
    oktaService.removeUserFromGroup.mockResolvedValueOnce({});

    await request(makeApp())
      .post('/api/admin/users/remove-group')
      .send({ userId: 'u1', groupId: 'g1' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GROUP_REMOVED',
        status: 'SUCCESS',
        targetUser: 'u@test.com',
        targetGroup: 'Admin',
      })
    );
  });

  test('GROUP_REMOVED is logged on failure', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'u@test.com' } });
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'Admin' } });
    oktaService.removeUserFromGroup.mockRejectedValueOnce(new Error('fail'));

    await request(makeApp())
      .post('/api/admin/users/remove-group')
      .send({ userId: 'u1', groupId: 'g1' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GROUP_REMOVED', status: 'FAILURE' })
    );
  });

  test('GROUP_CREATED is logged on success', async () => {
    oktaService.createGroup.mockResolvedValueOnce({ id: 'g99', profile: { name: 'DevOps' } });

    await request(makeApp())
      .post('/api/admin/groups')
      .send({ name: 'DevOps', description: 'DevOps team' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GROUP_CREATED', status: 'SUCCESS', targetGroup: 'DevOps' })
    );
  });

  test('GROUP_CREATED is logged on failure', async () => {
    oktaService.createGroup.mockRejectedValueOnce(new Error('Group exists'));

    await request(makeApp())
      .post('/api/admin/groups')
      .send({ name: 'DevOps' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GROUP_CREATED', status: 'FAILURE' })
    );
  });

  test('GROUP_DELETED is logged with group name on success', async () => {
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'DevOps' } });
    oktaService.deleteGroup.mockResolvedValueOnce();

    await request(makeApp()).delete('/api/admin/groups/g99');

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GROUP_DELETED',
        status: 'SUCCESS',
        targetGroup: 'DevOps',
      })
    );
  });

  test('GROUP_DELETED is logged on failure', async () => {
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'DevOps' } });
    oktaService.deleteGroup.mockRejectedValueOnce(new Error('fail'));

    await request(makeApp()).delete('/api/admin/groups/g99');

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GROUP_DELETED', status: 'FAILURE' })
    );
  });

  test('system group deletion is blocked — no audit log written', async () => {
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'Everyone' } });

    const res = await request(makeApp()).delete('/api/admin/groups/g-everyone');

    expect(res.status).toBe(400);
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
});

// ── performedBy is always the admin's email ───────────────────────────────────

describe('Audit log — performedBy field', () => {
  test('records the admin email extracted from req.user', async () => {
    oktaService.createUser.mockResolvedValueOnce({ id: 'u1', profile: { email: 'new@test.com' } });

    await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'A', lastName: 'B', email: 'new@test.com' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: 'admin@test.com' })
    );
  });
});
