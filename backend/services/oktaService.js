const { Client } = require('@okta/okta-sdk-nodejs');

const client = new Client({
  orgUrl: process.env.OKTA_DOMAIN,
  token:  process.env.OKTA_API_TOKEN,
});

// ── Shared fetch helper ───────────────────────────────────────────────────────
// OKTA_DOMAIN already contains https://, e.g. "https://integrator-9748686.okta.com"

const oktaFetch = async (path) => {
  const url = `${process.env.OKTA_DOMAIN}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `SSWS ${process.env.OKTA_API_TOKEN}` },
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`[oktaFetch] ${res.status} ${path}`, body);
    const err = new Error(body.errorSummary ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = body;
    throw err;
  }
  return body;
};

const oktaDelete = async (path) => {
  const url = `${process.env.OKTA_DOMAIN}${path}`;
  const res = await fetch(url, {
    method:  'DELETE',
    headers: { Authorization: `SSWS ${process.env.OKTA_API_TOKEN}` },
  });
  if (res.status === 204) return; // no body on success
  const body = await res.json();
  if (!res.ok) {
    console.error(`[oktaDelete] ${res.status} ${path}`, body);
    const err = new Error(body.errorSummary ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = body;
    throw err;
  }
  return body;
};

const oktaPost = async (path, payload) => {
  const url = `${process.env.OKTA_DOMAIN}${path}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `SSWS ${process.env.OKTA_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`[oktaPost] ${res.status} ${path}`, body);
    const err = new Error(body.errorSummary ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = body;
    throw err;
  }
  return body;
};

// ── User provisioning ─────────────────────────────────────────────────────────

const createUser = async ({ firstName, lastName, email, groupIds = [] }) => {
  const user = await client.userApi.createUser({
    body: { profile: { firstName, lastName, email, login: email } },
    activate: false,
  });

  if (groupIds.length) {
    await Promise.all(
      groupIds.map((gid) => client.groupApi.assignUserToGroup({ groupId: gid, userId: user.id }))
    );
  }

  await client.userApi.activateUser({ userId: user.id, sendEmail: true });
  return user;
};

// ── Group management ──────────────────────────────────────────────────────────

const assignUserToGroup  = (userId, groupId) =>
  client.groupApi.assignUserToGroup({ groupId, userId });

const removeUserFromGroup = (userId, groupId) =>
  client.groupApi.unassignUserFromGroup({ groupId, userId });

// ── User lifecycle ────────────────────────────────────────────────────────────

const deactivateUser = (userId) => client.userApi.deactivateUser({ userId });

// Okta requires deactivation before deletion.
// If the user is already DEPROVISIONED we skip straight to delete.
const deleteUser = async (userId) => {
  const user = await oktaFetch(`/api/v1/users/${userId}`);
  if (user.status !== 'DEPROVISIONED') {
    await oktaPost(`/api/v1/users/${userId}/lifecycle/deactivate`, {});
  }
  await oktaDelete(`/api/v1/users/${userId}`);
};

const activateUser = async (userId) => {
  const user = await client.userApi.getUser({ userId });
  console.log(`[activateUser] userId=${userId} status=${user.status}`);
  if (['ACTIVE', 'PROVISIONED', 'PASSWORD_EXPIRED', 'RECOVERY', 'LOCKED_OUT'].includes(user.status)) {
    console.log(`[activateUser] Skipping — already ${user.status}`);
    return user;
  }
  return client.userApi.activateUser({ userId, sendEmail: true });
};

// ── Queries (direct REST — avoids SDK async iterator issues) ──────────────────

const listUsers    = (limit = 200) => oktaFetch(`/api/v1/users?limit=${limit}`);
const listGroups   = (limit = 200) => oktaFetch(`/api/v1/groups?limit=${limit}`);
const getUser      = (userId)      => oktaFetch(`/api/v1/users/${userId}`);
const getGroup     = (groupId)     => oktaFetch(`/api/v1/groups/${groupId}`);
const getUserGroups = (userId)     => oktaFetch(`/api/v1/users/${userId}/groups`);
const createGroup  = (name, description = '') =>
  oktaPost('/api/v1/groups', { profile: { name, description } });

const getGroupMembers = (groupId, limit = 1000) =>
  oktaFetch(`/api/v1/groups/${groupId}/users?limit=${limit}`);

// Okta requires all members to be removed before a group can be deleted.
const deleteGroup = async (groupId) => {
  const members = await getGroupMembers(groupId);
  await Promise.all(members.map((u) => removeUserFromGroup(u.id, groupId)));
  await oktaDelete(`/api/v1/groups/${groupId}`);
};

// ── System Log ────────────────────────────────────────────────────────────────

const getLogs = async ({ limit = 50, since, filter } = {}) => {
  let path = `/api/v1/logs?limit=${limit}`;
  if (since)  path += `&since=${encodeURIComponent(since)}`;
  if (filter) path += `&filter=${encodeURIComponent(filter)}`;

  console.log('[getLogs] GET', `${process.env.OKTA_DOMAIN}${path}`);
  console.log('[getLogs] token prefix:', process.env.OKTA_API_TOKEN?.slice(0, 8));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res  = await fetch(`${process.env.OKTA_DOMAIN}${path}`, {
      signal:  controller.signal,
      headers: { Authorization: `SSWS ${process.env.OKTA_API_TOKEN}` },
    });
    const body = await res.json();

    if (!res.ok) {
      console.error('[getLogs] Okta error:', JSON.stringify(body, null, 2));
      const err = new Error(body.errorSummary ?? `HTTP ${res.status}`);
      err.status = res.status;
      err.detail = body;
      throw err;
    }

    console.log('[getLogs] fetched', body.length, 'entries');
    return body;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[getLogs] Timed out after 10s');
      throw new Error('Okta System Log request timed out after 10 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

module.exports = {
  createUser,
  assignUserToGroup,
  removeUserFromGroup,
  deactivateUser,
  deleteUser,
  activateUser,
  listUsers,
  listGroups,
  getUser,
  getGroup,
  getUserGroups,
  createGroup,
  deleteGroup,
  getLogs,
};
