const oktaService = require('../services/oktaService');
const AuditLog    = require('../models/AuditLog');

// ── Audit helper ──────────────────────────────────────────────────────────────

const audit = (action, performedBy, targetUser, targetGroup, status, details = {}) =>
  AuditLog.create({ action, performedBy, targetUser, targetGroup, status, details }).catch(
    (err) => console.error('[audit] Failed to write audit log:', err.message)
  );

const adminEmail = (req) => req.user?._json?.email ?? req.user?.id ?? 'unknown';

// ── User CRUD ─────────────────────────────────────────────────────────────────

const listUsers = async (_req, res) => {
  try {
    res.json(await oktaService.listUsers());
  } catch (err) {
    console.error('[listUsers]', err.message, err.detail ?? '');
    res.status(500).json({ error: err.message });
  }
};

const createUser = async (req, res) => {
  const { firstName, lastName, email, groupIds = [] } = req.body;
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'firstName, lastName and email are required' });
  }
  try {
    const user = await oktaService.createUser({ firstName, lastName, email, groupIds });
    await audit('USER_CREATED', adminEmail(req), email, null, 'SUCCESS', { groupIds });

    // Log a GROUP_ASSIGNED entry for each group the new user was added to
    if (groupIds.length) {
      const performer = adminEmail(req);
      await Promise.all(
        groupIds.map(async (gid) => {
          let groupName = gid;
          try { groupName = (await oktaService.getGroup(gid)).profile?.name ?? gid; } catch (_) {}
          return audit('GROUP_ASSIGNED', performer, email, groupName, 'SUCCESS');
        })
      );
    }

    res.status(201).json({ message: 'User created — activation email sent', user });
  } catch (err) {
    await audit('USER_CREATED', adminEmail(req), email, null, 'FAILURE', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// ── Group management ──────────────────────────────────────────────────────────

const listGroups = async (_req, res) => {
  try {
    res.json(await oktaService.listGroups());
  } catch (err) {
    console.error('[listGroups]', err.message, err.detail ?? '');
    res.status(500).json({ error: err.message });
  }
};

const assignGroup = async (req, res) => {
  const { userId, groupId } = req.body;
  if (!userId || !groupId) {
    return res.status(400).json({ error: 'userId and groupId are required' });
  }

  let userEmail = userId;
  let groupName = groupId;
  try {
    const [user, group] = await Promise.all([
      oktaService.getUser(userId),
      oktaService.getGroup(groupId),
    ]);
    userEmail = user.profile?.email ?? userId;
    groupName = group.profile?.name ?? groupId;
  } catch (_) {}

  try {
    await oktaService.assignUserToGroup(userId, groupId);
    await audit('GROUP_ASSIGNED', adminEmail(req), userEmail, groupName, 'SUCCESS');
    res.json({ message: 'User assigned to group' });
  } catch (err) {
    await audit('GROUP_ASSIGNED', adminEmail(req), userEmail, groupName, 'FAILURE', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

const removeGroup = async (req, res) => {
  const { userId, groupId } = req.body;

  // Resolve readable names for the audit log before mutating
  let userEmail  = userId;
  let groupName  = groupId;
  try {
    const [user, group] = await Promise.all([
      oktaService.getUser(userId),
      oktaService.getGroup(groupId),
    ]);
    userEmail = user.profile?.email ?? userId;
    groupName = group.profile?.name ?? groupId;
  } catch (_) { /* fall back to IDs if lookups fail */ }

  try {
    await oktaService.removeUserFromGroup(userId, groupId);
    await audit('GROUP_REMOVED', adminEmail(req), userEmail, groupName, 'SUCCESS');
    res.json({ message: 'User removed from group' });
  } catch (err) {
    await audit('GROUP_REMOVED', adminEmail(req), userEmail, groupName, 'FAILURE', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

const disableUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await oktaService.deactivateUser(userId);
    await audit('USER_DISABLED', adminEmail(req), userId, null, 'SUCCESS');
    res.json({ message: 'User deactivated' });
  } catch (err) {
    await audit('USER_DISABLED', adminEmail(req), userId, null, 'FAILURE', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;
  // Resolve email for a readable audit log entry
  let userEmail = userId;
  try { userEmail = (await oktaService.getUser(userId)).profile?.email ?? userId; } catch (_) {}
  try {
    await oktaService.deleteUser(userId);
    await audit('USER_DELETED', adminEmail(req), userEmail, null, 'SUCCESS');
    res.json({ message: 'User permanently deleted' });
  } catch (err) {
    await audit('USER_DELETED', adminEmail(req), userEmail, null, 'FAILURE', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

const enableUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await oktaService.activateUser(userId);
    await audit('USER_ENABLED', adminEmail(req), userId, null, 'SUCCESS');
    res.json({ message: 'User activated — activation email sent' });
  } catch (err) {
    await audit('USER_ENABLED', adminEmail(req), userId, null, 'FAILURE', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// ── System Log (Okta) ─────────────────────────────────────────────────────────

const getLogs = async (req, res) => {
  try {
    const { limit = 50, since, filter } = req.query;
    const logs = await oktaService.getLogs({ limit: Number(limit), since, filter });
    res.json(logs);
  } catch (err) {
    const detail = {
      message:      err.message,
      status:       err.status ?? err.statusCode ?? null,
      errorCode:    err.errorCode ?? err.response?.data?.errorCode ?? null,
      errorSummary: err.errorSummary ?? err.response?.data?.errorSummary ?? null,
      raw:          err.response?.data ?? null,
    };
    console.error('[getLogs] Okta error:', JSON.stringify(detail, null, 2));
    res.status(500).json({ error: err.message, detail });
  }
};

// ── Audit Log (MongoDB) ───────────────────────────────────────────────────────

const getAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs  = await AuditLog.find().sort({ timestamp: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── User groups ───────────────────────────────────────────────────────────────

const getUserGroups = async (req, res) => {
  const { userId } = req.params;
  try {
    res.json(await oktaService.getUserGroups(userId));
  } catch (err) {
    console.error('[getUserGroups]', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── Create group ──────────────────────────────────────────────────────────────

const createGroup = async (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const group = await oktaService.createGroup(name, description);
    await audit('GROUP_CREATED', adminEmail(req), null, name, 'SUCCESS');
    res.status(201).json({ message: 'Group created', group });
  } catch (err) {
    await audit('GROUP_CREATED', adminEmail(req), null, name, 'FAILURE', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// ── Delete group ──────────────────────────────────────────────────────────────

const SYSTEM_GROUPS = ['Everyone', 'Okta Administrators'];

const deleteGroup = async (req, res) => {
  const { groupId } = req.params;
  let groupName = groupId;
  try { groupName = (await oktaService.getGroup(groupId)).profile?.name ?? groupId; } catch (_) {}

  if (SYSTEM_GROUPS.includes(groupName)) {
    return res.status(400).json({ error: `Cannot delete system group "${groupName}"` });
  }

  try {
    await oktaService.deleteGroup(groupId);
    await audit('GROUP_DELETED', adminEmail(req), null, groupName, 'SUCCESS');
    res.json({ message: `Group "${groupName}" deleted` });
  } catch (err) {
    await audit('GROUP_DELETED', adminEmail(req), null, groupName, 'FAILURE', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  listUsers,
  createUser,
  listGroups,
  deleteUser,
  assignGroup,
  removeGroup,
  disableUser,
  enableUser,
  getLogs,
  getAuditLogs,
  getUserGroups,
  createGroup,
  deleteGroup,
};
