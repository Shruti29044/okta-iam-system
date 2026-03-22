/**
 * User controller tests
 *
 * oktaService and AuditLog are mocked so no real HTTP calls or DB writes occur.
 * The auth middleware is bypassed by injecting req.user directly.
 */

jest.mock('@okta/okta-sdk-nodejs', () => ({
  Client: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@okta/jwt-verifier', () =>
  jest.fn().mockImplementation(() => ({ verifyAccessToken: jest.fn() }))
);

// Mock the entire service layer
jest.mock('../services/oktaService');
// Mock AuditLog so nothing hits MongoDB
jest.mock('../models/AuditLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const request      = require('supertest');
const express      = require('express');
const oktaService  = require('../services/oktaService');
const AuditLog     = require('../models/AuditLog');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal app with auth bypassed.
 * Injects req.user as an Admin before every controller call.
 */
const makeApp = () => {
  const app = express();
  app.use(express.json());

  // Bypass real auth — inject a fake Admin user
  app.use((req, _res, next) => {
    req.user = { id: 'admin@example.com', _json: { email: 'admin@example.com', groups: ['Admin'] } };
    req.isAuthenticated = () => true;
    next();
  });

  app.use('/api/admin', require('../routes/userRoutes'));
  return app;
};

// ── createUser ────────────────────────────────────────────────────────────────

describe('POST /api/admin/users', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 400 when firstName is missing', async () => {
    const res = await request(makeApp())
      .post('/api/admin/users')
      .send({ lastName: 'Doe', email: 'j@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/firstName/);
  });

  test('returns 400 when lastName is missing', async () => {
    const res = await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'Jane', email: 'j@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lastName/);
  });

  test('returns 400 when email is missing', async () => {
    const res = await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'Jane', lastName: 'Doe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/);
  });

  test('creates user and returns 201 on success', async () => {
    const fakeUser = { id: 'u1', profile: { email: 'j@test.com' } };
    oktaService.createUser.mockResolvedValueOnce(fakeUser);

    const res = await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject(fakeUser);
    expect(oktaService.createUser).toHaveBeenCalledWith({
      firstName: 'Jane', lastName: 'Doe', email: 'j@test.com', groupIds: [],
    });
  });

  test('logs USER_CREATED SUCCESS to AuditLog', async () => {
    oktaService.createUser.mockResolvedValueOnce({ id: 'u1', profile: { email: 'j@test.com' } });

    await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j@test.com' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_CREATED', status: 'SUCCESS', targetUser: 'j@test.com' })
    );
  });

  test('logs USER_CREATED FAILURE when Okta throws', async () => {
    oktaService.createUser.mockRejectedValueOnce(new Error('Okta error'));

    await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j@test.com' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_CREATED', status: 'FAILURE' })
    );
  });

  test('assigns groups when groupIds provided and logs GROUP_ASSIGNED', async () => {
    const fakeUser = { id: 'u1', profile: { email: 'j@test.com' } };
    oktaService.createUser.mockResolvedValueOnce(fakeUser);
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'Admin' } });

    await request(makeApp())
      .post('/api/admin/users')
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'j@test.com', groupIds: ['g1'] });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GROUP_ASSIGNED', status: 'SUCCESS', targetGroup: 'Admin' })
    );
  });
});

// ── disableUser / enableUser ──────────────────────────────────────────────────

describe('PUT /api/admin/users/:userId/disable', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls deactivateUser and returns 200', async () => {
    oktaService.deactivateUser.mockResolvedValueOnce({});

    const res = await request(makeApp()).put('/api/admin/users/u123/disable');
    expect(res.status).toBe(200);
    expect(oktaService.deactivateUser).toHaveBeenCalledWith('u123');
  });

  test('logs USER_DISABLED SUCCESS', async () => {
    oktaService.deactivateUser.mockResolvedValueOnce({});

    await request(makeApp()).put('/api/admin/users/u123/disable');
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_DISABLED', status: 'SUCCESS', targetUser: 'u123' })
    );
  });

  test('logs USER_DISABLED FAILURE when Okta throws', async () => {
    oktaService.deactivateUser.mockRejectedValueOnce(new Error('fail'));

    await request(makeApp()).put('/api/admin/users/u123/disable');
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_DISABLED', status: 'FAILURE' })
    );
  });
});

describe('PUT /api/admin/users/:userId/enable', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls activateUser and returns 200', async () => {
    oktaService.activateUser.mockResolvedValueOnce({});

    const res = await request(makeApp()).put('/api/admin/users/u123/enable');
    expect(res.status).toBe(200);
    expect(oktaService.activateUser).toHaveBeenCalledWith('u123');
  });

  test('logs USER_ENABLED SUCCESS', async () => {
    oktaService.activateUser.mockResolvedValueOnce({});

    await request(makeApp()).put('/api/admin/users/u123/enable');
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_ENABLED', status: 'SUCCESS' })
    );
  });
});

// ── deleteUser ────────────────────────────────────────────────────────────────

describe('DELETE /api/admin/users/:userId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('resolves email, calls deleteUser, returns 200', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'jane@test.com' } });
    oktaService.deleteUser.mockResolvedValueOnce();

    const res = await request(makeApp()).delete('/api/admin/users/u123');
    expect(res.status).toBe(200);
    expect(oktaService.deleteUser).toHaveBeenCalledWith('u123');
  });

  test('logs USER_DELETED SUCCESS with resolved email', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'jane@test.com' } });
    oktaService.deleteUser.mockResolvedValueOnce();

    await request(makeApp()).delete('/api/admin/users/u123');
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_DELETED',
        status: 'SUCCESS',
        targetUser: 'jane@test.com',
      })
    );
  });

  test('logs USER_DELETED FAILURE when deleteUser throws', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'jane@test.com' } });
    oktaService.deleteUser.mockRejectedValueOnce(new Error('Cannot delete'));

    await request(makeApp()).delete('/api/admin/users/u123');
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_DELETED', status: 'FAILURE' })
    );
  });

  test('falls back to userId when getUser fails', async () => {
    oktaService.getUser.mockRejectedValueOnce(new Error('not found'));
    oktaService.deleteUser.mockResolvedValueOnce();

    await request(makeApp()).delete('/api/admin/users/u123');
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ targetUser: 'u123' })
    );
  });
});

// ── Group management ──────────────────────────────────────────────────────────

describe('POST /api/admin/users/assign-group', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 400 when userId or groupId missing', async () => {
    const res = await request(makeApp())
      .post('/api/admin/users/assign-group')
      .send({ userId: 'u1' });
    expect(res.status).toBe(400);
  });

  test('calls assignUserToGroup and logs GROUP_ASSIGNED with readable names', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'u@test.com' } });
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'Admin' } });
    oktaService.assignUserToGroup.mockResolvedValueOnce({});

    await request(makeApp())
      .post('/api/admin/users/assign-group')
      .send({ userId: 'u1', groupId: 'g1' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GROUP_ASSIGNED',
        status: 'SUCCESS',
        targetUser: 'u@test.com',
        targetGroup: 'Admin',
      })
    );
  });
});

describe('POST /api/admin/users/remove-group', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls removeUserFromGroup and logs GROUP_REMOVED with readable names', async () => {
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

  test('logs GROUP_REMOVED FAILURE when service throws', async () => {
    oktaService.getUser.mockResolvedValueOnce({ profile: { email: 'u@test.com' } });
    oktaService.getGroup.mockResolvedValueOnce({ profile: { name: 'Admin' } });
    oktaService.removeUserFromGroup.mockRejectedValueOnce(new Error('Okta error'));

    await request(makeApp())
      .post('/api/admin/users/remove-group')
      .send({ userId: 'u1', groupId: 'g1' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GROUP_REMOVED', status: 'FAILURE' })
    );
  });
});
