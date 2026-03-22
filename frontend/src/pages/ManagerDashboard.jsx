import { useEffect, useState, useMemo } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import axios from 'axios';
import MfaBadge from '../components/MfaBadge';

const statusColor = { ACTIVE: { bg: '#e8f5e9', color: '#2e7d32' }, DEPROVISIONED: { bg: '#fbe9e7', color: '#bf360c' } };

const ManagerDashboard = () => {
  const { authState } = useOktaAuth();
  const claims      = authState?.idToken?.claims ?? {};
  const managerName = claims.name ?? claims.preferred_username ?? 'Manager';

  // Axios instance with Bearer token — recreated only when token changes
  const token = authState?.accessToken?.accessToken;
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
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Fetch once the access token is available
  useEffect(() => {
    if (!token) return;
    Promise.all([api.get('/users'), api.get('/groups')])
      .then(([u, g]) => { setUsers(u.data); setGroups(g.data); })
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.profile.firstName?.toLowerCase().includes(q) ||
      u.profile.lastName?.toLowerCase().includes(q) ||
      u.profile.email?.toLowerCase().includes(q)
    );
  });

  const activeCount   = users.filter((u) => u.status === 'ACTIVE').length;
  const inactiveCount = users.length - activeCount;
  const myGroups      = authState?.accessToken?.claims?.groups ?? authState?.idToken?.claims?.groups ?? [];

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.heading}>Manager Dashboard</h2>
          <p style={s.sub}>Signed in as <strong>{managerName}</strong></p>
        </div>
        <MfaBadge />
      </div>

      {/* ── Summary cards ── */}
      <div style={s.cards}>
        <StatCard label="Total Users"  value={users.length}  color="#003366" />
        <StatCard label="Active"       value={activeCount}   color="#2e7d32" />
        <StatCard label="Inactive"     value={inactiveCount} color="#c62828" />
        <StatCard label="Groups"       value={groups.length} color="#6a1b9a" />
      </div>

      {/* ── My groups ── */}
      <section style={s.section}>
        <h3 style={s.sectionTitle}>Your Groups</h3>
        <div style={s.chipRow}>
          {myGroups.length
            ? myGroups.map((g) => <span key={g} style={s.chip}>{g}</span>)
            : <span style={{ color: '#aaa' }}>No group claims in token</span>}
        </div>
      </section>

      {/* ── User directory ── */}
      <section style={s.section}>
        <div style={s.searchBar}>
          <h3 style={s.sectionTitle}>User Directory</h3>
          <input
            style={s.search}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && <p style={{ color: '#888' }}>Loading…</p>}
        {error   && <p style={{ color: '#c62828' }}>Error: {error}</p>}

        {!loading && !error && (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Login</th>
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const sc = statusColor[u.status] ?? { bg: '#f5f5f5', color: '#333' };
                  return (
                    <tr key={u.id} style={s.tr}>
                      <td style={s.td}>{u.profile.firstName} {u.profile.lastName}</td>
                      <td style={s.td}>{u.profile.email}</td>
                      <td style={{ ...s.td, color: '#888', fontSize: '0.82rem' }}>{u.profile.login}</td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>{u.status}</span>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan={4} style={s.empty}>No users match your search</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Groups list ── */}
      <section style={s.section}>
        <h3 style={s.sectionTitle}>All Groups</h3>
        <div style={s.groupGrid}>
          {groups.map((g) => (
            <div key={g.id} style={s.groupCard}>
              <p style={s.groupName}>{g.profile.name}</p>
              <p style={s.groupDesc}>{g.profile.description || 'No description'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div style={{ ...s.statCard, borderTop: `4px solid ${color}` }}>
    <p style={{ ...s.statValue, color }}>{value}</p>
    <p style={s.statLabel}>{label}</p>
  </div>
);

const s = {
  page:        { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  pageHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  heading:     { color: '#003366', marginBottom: '4px' },
  sub:         { color: '#666', margin: 0 },

  cards:       { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '36px' },
  statCard:    { background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', textAlign: 'center' },
  statValue:   { fontSize: '2rem', fontWeight: 700, margin: 0 },
  statLabel:   { color: '#888', fontSize: '0.85rem', marginTop: '4px' },

  section:     { marginBottom: '40px' },
  sectionTitle:{ color: '#003366', marginBottom: '14px', fontSize: '1.05rem' },

  chipRow:     { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  chip:        { background: '#e3f2fd', color: '#1565c0', padding: '5px 14px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 500 },

  searchBar:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  search:      { padding: '8px 12px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '0.9rem', width: '280px' },

  tableWrap:   { overflowX: 'auto' },
  table:       { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
  thead:       { background: '#f5f7fa' },
  th:          { padding: '12px 14px', textAlign: 'left', fontSize: '0.82rem', color: '#555', fontWeight: 600 },
  tr:          { borderBottom: '1px solid #f0f0f0' },
  td:          { padding: '10px 14px', fontSize: '0.88rem' },
  empty:       { textAlign: 'center', padding: '28px', color: '#aaa' },
  badge:       { padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 },

  groupGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' },
  groupCard:   { background: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '4px solid #6a1b9a' },
  groupName:   { fontWeight: 600, color: '#333', marginBottom: '4px' },
  groupDesc:   { color: '#888', fontSize: '0.82rem' },
};

export default ManagerDashboard;
