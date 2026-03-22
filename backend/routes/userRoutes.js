const express = require('express');
const { ensureAuthenticated, requireRole } = require('../middleware/authMiddleware');
const {
  listUsers,
  createUser,
  listGroups,
  deleteUser,
  deleteGroup,
  assignGroup,
  removeGroup,
  disableUser,
  enableUser,
  getLogs,
  getAuditLogs,
  getUserGroups,
  createGroup,
} = require('../controllers/userController');

const router = express.Router();

// All routes require a valid session or Bearer token
router.use(ensureAuthenticated);

// ── Read-only – Admin OR Manager ──────────────────────────────────────────────
router.get('/users',  requireRole('Admin', 'Manager'), listUsers);
router.get('/groups', requireRole('Admin', 'Manager'), listGroups);

// ── Write – Admin only ────────────────────────────────────────────────────────
router.post('/users',               requireRole('Admin'), createUser);
router.put('/users/:userId/disable',    requireRole('Admin'), disableUser);
router.put('/users/:userId/enable',     requireRole('Admin'), enableUser);
router.delete('/users/:userId',         requireRole('Admin'), deleteUser);
router.get('/users/:userId/groups',  requireRole('Admin'), getUserGroups);
router.post('/users/assign-group',  requireRole('Admin'), assignGroup);
router.post('/users/remove-group',  requireRole('Admin'), removeGroup);
router.post('/groups',              requireRole('Admin'), createGroup);
router.delete('/groups/:groupId',   requireRole('Admin'), deleteGroup);

// ── Okta System Log – Admin only ──────────────────────────────────────────────
router.get('/logs', requireRole('Admin'), getLogs);

// ── MongoDB Audit Log – Admin only ────────────────────────────────────────────
router.get('/audit-logs', requireRole('Admin'), getAuditLogs);

module.exports = router;
