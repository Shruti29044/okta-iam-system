import { useEffect, useState, useMemo } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import axios from 'axios';
import MfaBadge from '../components/MfaBadge';

// ── Helpers ───────────────────────────────────────────────────────────────────

const severityColor = { INFO: '#1976d2', WARN: '#f57c00', ERROR: '#c62828', DEBUG: '#555' };

const ACTION_COLORS = {
  USER_CREATED:  { bg: '#e3f2fd', color: '#1565c0' },
  USER_DISABLED: { bg: '#fbe9e7', color: '#bf360c' },
  USER_ENABLED:  { bg: '#e8f5e9', color: '#2e7d32' },
  GROUP_ASSIGNED:{ bg: '#f3e5f5', color: '#6a1b9a' },
  GROUP_REMOVED: { bg: '#fff3e0', color: '#e65100' },
  GROUP_CREATED: { bg: '#f3e5f5', color: '#4a148c' },
  GROUP_DELETED: { bg: '#fce4ec', color: '#880e4f' },
  USER_DELETED:  { bg: '#fce4ec', color: '#880e4f' },
  USER_LOGIN:    { bg: '#e8eaf6', color: '#283593' },
};
const actionStyle = (action) => ACTION_COLORS[action] ?? { bg: '#f5f5f5', color: '#333' };

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
    : '—';

// ── Pagination hook ───────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const usePagination = (items) => {
  const [page, setPage] = useState(1);
  // Reset to page 1 whenever the underlying data changes
  useEffect(() => { setPage(1); }, [items]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { slice, page, totalPages, setPage };
};

// ── Pagination bar component ──────────────────────────────────────────────────

const Pagination = ({ page, totalPages, setPage, total, label = 'items' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', fontSize: '0.84rem', color: '#555' }}>
    <span>{total} {label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button
        onClick={() => setPage((p) => p - 1)}
        disabled={page === 1}
        style={pgBtn(page === 1)}
      >
        ← Previous
      </button>
      <span style={{ fontWeight: 600, color: '#003366' }}>Page {page} of {totalPages}</span>
      <button
        onClick={() => setPage((p) => p + 1)}
        disabled={page === totalPages}
        style={pgBtn(page === totalPages)}
      >
        Next →
      </button>
    </div>
  </div>
);

const pgBtn = (disabled) => ({
  padding: '5px 14px',
  background: disabled ? '#f5f5f5' : '#fff',
  color: disabled ? '#bbb' : '#003366',
  border: '1px solid ' + (disabled ? '#e0e0e0' : '#003366'),
  borderRadius: '4px',
  cursor: disabled ? 'default' : 'pointer',
  fontSize: '0.82rem',
  fontWeight: 500,
});

// ── Component ─────────────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const { authState, oktaAuth } = useOktaAuth();
  const adminName =
    authState?.idToken?.claims?.name ??
    authState?.idToken?.claims?.preferred_username ??
    'Admin';

  // Build an axios instance that always carries the current access token.
  // Recreated only when the token changes.
  const token = authState?.accessToken?.accessToken;
  console.log('Access token:', token);
  const api = useMemo(
    () =>
      axios.create({
        baseURL: '/api/admin',
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    [token]
  );

  const [users, setUsers]     = useState([]);
  const [groups, setGroups]   = useState([]);
  const [logs, setLogs]             = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [auditLogs, setAuditLogs]   = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [message, setMessage]       = useState(null);
  const [activeTab, setActiveTab]   = useState('users'); // 'users'|'provision'|'logs'|'audit'

  const usersPag     = usePagination(users);
  const logsPag      = usePagination(logs);
  const auditLogsPag = usePagination(auditLogs);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', groupId: '' });

  // Manage-groups modal
  const [groupModal, setGroupModal] = useState(null); // { user, userGroups }
  const [groupModalLoading, setGroupModalLoading] = useState(false);
  const [assignGroupId, setAssignGroupId] = useState('');

  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [groupMsg, setGroupMsg]   = useState(null); // { text, type }

  // 401 interceptor — redirect to login if token is rejected
  useEffect(() => {
    const id = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.warn('[interceptor] 401 received — signing out');
          oktaAuth.signOut({ postLogoutRedirectUri: window.location.origin });
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [api, oktaAuth]);

  // Fetch only once the access token is available
  useEffect(() => {
    if (!token) return;
    fetchUsers();
    fetchGroups();
  }, [token]);

  const fetchUsers = async () => {
    try { setUsers((await api.get('/users')).data); }
    catch (e) { notify(apiErr(e), 'error'); }
  };

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/groups');
      setGroups(data);
      return data;
    } catch (e) { notify(apiErr(e), 'error'); }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      setLogs((await api.get(`/logs?limit=50&since=${since}`)).data);
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = detail
        ? `${e.response.data.error} — ${detail.errorSummary ?? detail.message ?? JSON.stringify(detail)}`
        : apiErr(e);
      notify(msg, 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      setAuditLogs((await api.get('/audit-logs?limit=100')).data);
    } catch (e) {
      notify(apiErr(e), 'error');
    } finally {
      setAuditLoading(false);
    }
  };

  // Load data when a tab first opens
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'logs'  && logs.length === 0)      fetchLogs();
    if (tab === 'audit' && auditLogs.length === 0)  fetchAuditLogs();
  };

  const notify = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const apiErr = (e) => e.response?.data?.error ?? e.message;

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', {
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        groupIds:  form.groupId ? [form.groupId] : [],
      });
      notify(`User created — activation email sent to ${form.email}`);
      setForm({ firstName: '', lastName: '', email: '', groupId: '' });
      fetchUsers();
    } catch (e) { notify(apiErr(e), 'error'); }
  };

  const SYSTEM_GROUPS = ['Everyone', 'Okta Administrators'];

  const handleDeleteGroup = async (group) => {
    if (SYSTEM_GROUPS.includes(group.profile.name)) {
      notify(`Cannot delete system group "${group.profile.name}"`, 'error');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete group "${group.profile.name}"? All members will be removed from this group.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/groups/${group.id}`);
      notify(`Group "${group.profile.name}" deleted.`);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (e) { notify(apiErr(e), 'error'); }
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${user.profile.email}? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/users/${user.id}`);
      notify(`${user.profile.email} has been permanently deleted.`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) { notify(apiErr(e), 'error'); }
  };

  const handleManageGroups = async (user) => {
    setGroupModalLoading(true);
    setAssignGroupId('');
    setGroupModal({ user, userGroups: [] });
    try {
      const res = await api.get(`/users/${user.id}/groups`);
      setGroupModal({ user, userGroups: res.data });
    } catch (e) {
      notify(apiErr(e), 'error');
      setGroupModal(null);
    } finally {
      setGroupModalLoading(false);
    }
  };

  const handleAssignToGroup = async () => {
    if (!assignGroupId) return;
    try {
      await api.post('/users/assign-group', { userId: groupModal.user.id, groupId: assignGroupId });
      const res = await api.get(`/users/${groupModal.user.id}/groups`);
      setGroupModal((prev) => ({ ...prev, userGroups: res.data }));
      setAssignGroupId('');
      notify('User assigned to group');
    } catch (e) { notify(apiErr(e), 'error'); }
  };

  const handleRemoveFromGroup = async (userId, groupId, groupName) => {
    if (!window.confirm(`Remove user from "${groupName}"?`)) return;
    try {
      await api.post('/users/remove-group', { userId, groupId });
      notify(`Removed from ${groupName}`);
      // Refresh the modal's group list
      const res = await api.get(`/users/${userId}/groups`);
      setGroupModal((prev) => ({ ...prev, userGroups: res.data }));
      fetchUsers();
    } catch (e) {
      notify(apiErr(e), 'error');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/groups', groupForm);
      setGroupMsg({ text: `Group "${groupForm.name}" created`, type: 'success' });
      setGroupForm({ name: '', description: '' });
      // Refresh dropdown and auto-select the new group
      await fetchGroups();
      if (data.group?.id) setForm((prev) => ({ ...prev, groupId: data.group.id }));
    } catch (e) {
      setGroupMsg({ text: apiErr(e), type: 'error' });
    }
  };

  const handleDisable = async (userId) => {
    if (!window.confirm('Deactivate this user?')) return;
    try { await api.put(`/users/${userId}/disable`); notify('User deactivated.'); fetchUsers(); }
    catch (e) { notify(apiErr(e), 'error'); }
  };

  const handleEnable = async (userId) => {
    try { await api.put(`/users/${userId}/enable`); notify('User activated — email sent.'); fetchUsers(); }
    catch (e) { notify(apiErr(e), 'error'); }
  };

  const inp = (name, type = 'text') => ({
    type,
    placeholder: name === 'firstName' ? 'First name' : name === 'lastName' ? 'Last name' : name,
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
    style: s.input,
    required: true,
  });

  const tabs = [
    { id: 'users',     label: `Users (${users.length})` },
    { id: 'provision', label: 'User & Group Setup' },
    { id: 'logs',      label: 'System Logs' },
    { id: 'groups',    label: `Groups (${groups.length})` },
    { id: 'audit',     label: 'Audit Logs' },
  ];

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.heading}>Admin Dashboard</h2>
          <p style={s.sub}>Signed in as <strong>{adminName}</strong></p>
        </div>
        <MfaBadge />
      </div>

      {message && (
        <div style={{ ...s.msg, background: message.type === 'error' ? '#fdecea' : '#e8f5e9' }}>
          {message.text}
        </div>
      )}

      {/* Tab bar */}
      <div style={s.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            style={{ ...s.tab, ...(activeTab === t.id ? s.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Users tab ── */}
      {activeTab === 'users' && (
        <div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersPag.slice.map((u) => (
                  <tr key={u.id} style={s.tr}>
                    <td style={s.td}>{u.profile.firstName} {u.profile.lastName}</td>
                    <td style={s.td}>{u.profile.email}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(u.status === 'ACTIVE' ? s.badgeGreen : s.badgeRed) }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {u.status === 'ACTIVE'
                          ? <button onClick={() => handleDisable(u.id)} style={s.dangerBtn}>Disable</button>
                          : <button onClick={() => handleEnable(u.id)}  style={s.successBtn}>Enable</button>
                        }
                        <button onClick={() => handleManageGroups(u)} style={s.secondaryBtn}>Manage Groups</button>
                        <button onClick={() => handleDelete(u)} style={s.deleteBtn}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.length && <tr><td colSpan={4} style={s.empty}>No users found</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination {...usersPag} total={users.length} label="users" />
        </div>
      )}

      {/* ── Manage Groups modal ── */}
      {groupModal && (
        <div style={s.overlay} onClick={() => setGroupModal(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Groups for {groupModal.user.profile.firstName} {groupModal.user.profile.lastName}</h3>
            {groupModalLoading
              ? <p style={s.loading}>Loading groups…</p>
              : (() => {
                  const removable = groupModal.userGroups.filter((g) => g.profile.name !== 'Everyone');
                  return removable.length === 0
                    ? <p style={{ color: '#888', fontSize: '0.9rem' }}>Not a member of any removable groups.</p>
                    : (
                  <ul style={s.groupList}>
                    {removable.map((g) => (
                      <li key={g.id} style={s.groupItem}>
                        <span>{g.profile.name}</span>
                        <button
                          onClick={() => handleRemoveFromGroup(groupModal.user.id, g.id, g.profile.name)}
                          style={s.dangerBtn}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                );
                })()
            }
            {/* ── Assign to group ── */}
            {!groupModalLoading && (() => {
              const alreadyIn = new Set(groupModal.userGroups.map((g) => g.id));
              const available = groups.filter((g) => !alreadyIn.has(g.id) && g.profile.name !== 'Everyone');
              if (!available.length) return null;
              return (
                <div style={s.assignRow}>
                  <select
                    value={assignGroupId}
                    onChange={(e) => setAssignGroupId(e.target.value)}
                    style={{ ...s.input, flex: 1, fontSize: '0.85rem' }}
                  >
                    <option value="">Assign to a group…</option>
                    {available.map((g) => (
                      <option key={g.id} value={g.id}>{g.profile.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignToGroup}
                    disabled={!assignGroupId}
                    style={{ ...s.successBtn, whiteSpace: 'nowrap' }}
                  >
                    Assign
                  </button>
                </div>
              );
            })()}
            <button onClick={() => setGroupModal(null)} style={{ ...s.secondaryBtn, marginTop: '12px' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Provision tab ── */}
      {activeTab === 'provision' && (
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
          {/* Create New User card */}
          <div style={{ ...s.formCard, flex: 1, minWidth: '300px' }}>
            <h3 style={s.cardTitle}>Create New User</h3>
            <p style={s.hint}>No password needed — Okta will email the user an activation link.</p>
            <form onSubmit={handleCreate} style={s.form}>
              <div style={s.row}>
                <input {...inp('firstName')} />
                <input {...inp('lastName')} />
              </div>
              <input {...inp('email')} type="email" placeholder="Email address" />
              <select
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                style={s.input}
              >
                <option value="">Assign to group (optional)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.profile.name}</option>
                ))}
              </select>
              <button type="submit" style={s.submitBtn}>Create &amp; Send Invite</button>
            </form>
          </div>

          {/* Create New Group card */}
          <div style={{ ...s.formCard, flex: 1, minWidth: '300px' }}>
            <h3 style={s.cardTitle}>Create New Group</h3>
            <p style={s.hint}>Add a new group to Okta for role or team-based access control.</p>
            <form onSubmit={handleCreateGroup} style={s.form}>
              <input
                placeholder="Group name"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                style={s.input}
                required
              />
              <input
                placeholder="Description (optional)"
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                style={s.input}
              />
              <button type="submit" style={s.submitBtn}>Create Group</button>
              {groupMsg && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: groupMsg.type === 'error' ? '#c62828' : '#2e7d32' }}>
                  {groupMsg.text}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── Groups tab ── */}
      {activeTab === 'groups' && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>Group Name</th>
                <th style={s.th}>Description</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isSystem = SYSTEM_GROUPS.includes(g.profile.name);
                return (
                  <tr key={g.id} style={s.tr}>
                    <td style={s.td}><strong>{g.profile.name}</strong></td>
                    <td style={{ ...s.td, color: '#666' }}>{g.profile.description || '—'}</td>
                    <td style={s.td}>
                      {isSystem
                        ? <span style={{ ...s.badge, background: '#e3f2fd', color: '#1565c0' }}>System</span>
                        : <span style={{ ...s.badge, background: '#e8f5e9', color: '#2e7d32' }}>Custom</span>
                      }
                    </td>
                    <td style={s.td}>
                      {isSystem
                        ? <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Protected</span>
                        : (
                          <button
                            onClick={() => handleDeleteGroup(g)}
                            style={s.deleteBtn}
                          >
                            Delete
                          </button>
                        )
                      }
                    </td>
                  </tr>
                );
              })}
              {!groups.length && <tr><td colSpan={4} style={s.empty}>No groups found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Audit Logs tab ── */}
      {activeTab === 'audit' && (
        <div>
          <div style={s.logsHeader}>
            <span style={s.logsTitle}>Last 100 internal audit events (MongoDB)</span>
            <button onClick={fetchAuditLogs} style={s.refreshBtn} disabled={auditLoading}>
              {auditLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {auditLoading && <p style={s.loading}>Fetching audit logs…</p>}

          {!auditLoading && (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Time</th>
                    <th style={s.th}>Action</th>
                    <th style={s.th}>Performed By</th>
                    <th style={s.th}>Target User</th>
                    <th style={s.th}>Target Group</th>
                    <th style={s.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogsPag.slice.map((log) => (
                    <tr key={log._id} style={s.tr}>
                      <td style={{ ...s.td, whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#666' }}>
                        {fmt(log.timestamp)}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.actionBadge, ...actionStyle(log.action) }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={s.td}>{log.performedBy ?? '—'}</td>
                      <td style={s.td}>{log.targetUser  ?? '—'}</td>
                      <td style={s.td}>{log.targetGroup ?? '—'}</td>
                      <td style={s.td}>
                        <span style={{ color: log.status === 'SUCCESS' ? '#2e7d32' : '#c62828', fontWeight: 600, fontSize: '0.82rem' }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!auditLogs.length && (
                    <tr><td colSpan={6} style={s.empty}>No audit events yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!auditLoading && <Pagination {...auditLogsPag} total={auditLogs.length} label="entries" />}
        </div>
      )}

      {/* ── System Logs tab ── */}
      {activeTab === 'logs' && (
        <div>
          <div style={s.logsHeader}>
            <span style={s.logsTitle}>Last 50 events · past 24 hours</span>
            <button onClick={fetchLogs} style={s.refreshBtn} disabled={logsLoading}>
              {logsLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {logsLoading && <p style={s.loading}>Fetching logs…</p>}

          {!logsLoading && (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Time</th>
                    <th style={s.th}>Event</th>
                    <th style={s.th}>Actor</th>
                    <th style={s.th}>Target</th>
                    <th style={s.th}>Severity</th>
                    <th style={s.th}>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {logsPag.slice.map((log, i) => (
                    <tr key={log.uuid ?? i} style={s.tr}>
                      <td style={{ ...s.td, whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#666' }}>
                        {fmt(log.published)}
                      </td>
                      <td style={{ ...s.td, fontSize: '0.82rem' }}>{log.eventType}</td>
                      <td style={s.td}>{log.actor?.displayName ?? '—'}</td>
                      <td style={s.td}>{log.target?.[0]?.displayName ?? '—'}</td>
                      <td style={s.td}>
                        <span style={{ color: severityColor[log.severity] ?? '#333', fontWeight: 600, fontSize: '0.78rem' }}>
                          {log.severity}
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={{ color: log.outcome?.result === 'SUCCESS' ? '#2e7d32' : '#c62828', fontSize: '0.82rem' }}>
                          {log.outcome?.result ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!logs.length && <tr><td colSpan={6} style={s.empty}>No log events found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {!logsLoading && <Pagination {...logsPag} total={logs.length} label="events" />}
        </div>
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:       { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  heading:    { color: '#003366', marginBottom: '4px' },
  sub:        { color: '#666', margin: 0 },
  msg:        { padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' },

  tabBar:     { display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #e0e0e0' },
  tab:        { padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#555', borderBottom: '2px solid transparent', marginBottom: '-2px' },
  tabActive:  { color: '#003366', fontWeight: 700, borderBottom: '2px solid #003366' },

  tableWrap:  { overflowX: 'auto' },
  table:      { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
  thead:      { background: '#f5f7fa' },
  th:         { padding: '12px 14px', textAlign: 'left', fontSize: '0.82rem', color: '#555', fontWeight: 600 },
  tr:         { borderBottom: '1px solid #f0f0f0' },
  td:         { padding: '10px 14px', fontSize: '0.88rem' },
  empty:      { textAlign: 'center', padding: '28px', color: '#aaa' },
  badge:      { padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 },
  badgeGreen: { background: '#e8f5e9', color: '#2e7d32' },
  badgeRed:   { background: '#fbe9e7', color: '#bf360c' },
  dangerBtn:    { padding: '5px 12px', background: '#e53935', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' },
  successBtn:   { padding: '5px 12px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' },
  secondaryBtn: { padding: '5px 12px', background: '#607d8b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' },
  deleteBtn:    { padding: '5px 12px', background: '#fff', color: '#b71c1c', border: '1px solid #b71c1c', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#fff', borderRadius: '8px', padding: '28px', minWidth: '360px', maxWidth: '480px', width: '90%', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' },
  modalTitle:   { color: '#003366', marginBottom: '16px' },
  // overlay/modal kept for Manage Groups modal
  groupList:    { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  groupItem:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f5f7fa', borderRadius: '5px' },
  assignRow:    { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e0e0e0' },

  formCard:   { background: '#fff', borderRadius: '8px', padding: '28px', maxWidth: '480px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
  cardTitle:  { color: '#003366', marginBottom: '6px' },
  hint:       { color: '#777', fontSize: '0.85rem', marginBottom: '20px' },
  form:       { display: 'flex', flexDirection: 'column', gap: '12px' },
  row:        { display: 'flex', gap: '12px' },
  input:      { padding: '10px 12px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '0.9rem', flex: 1 },
  submitBtn:  { padding: '11px', background: '#007BC2', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 },

  logsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  logsTitle:  { color: '#555', fontSize: '0.88rem' },
  refreshBtn: { padding: '6px 14px', background: '#003366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' },
  loading:     { color: '#888', padding: '24px' },
  actionBadge: { padding: '2px 10px', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 600 },
};

export default AdminDashboard;
