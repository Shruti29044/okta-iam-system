import { useOktaAuth } from '@okta/okta-react';
import { Link } from 'react-router-dom';
import MfaBadge from '../components/MfaBadge';

const EmployeeDashboard = () => {
  const { authState } = useOktaAuth();
  const claims = authState?.idToken?.claims ?? {};
  const groups =
    authState?.accessToken?.claims?.groups ??
    authState?.idToken?.claims?.groups ??
    [];
  const isAdmin = groups.includes('Admin');

  return (
    <div style={s.page}>
      <h2 style={s.heading}>Employee Dashboard</h2>
      <p style={s.welcome}>Welcome back, <strong>{claims.name ?? claims.sub}</strong></p>

      <div style={s.card}>
        <div style={s.cardHeader}>
          <h4 style={s.cardTitle}>Your Profile</h4>
          <MfaBadge />
        </div>
        <Row label="Email" value={claims.email ?? '—'} />
        <Row label="Username" value={claims.preferred_username ?? claims.sub} />
        <Row label="Groups" value={groups.length ? groups.join(', ') : 'None'} />
      </div>

      {isAdmin && (
        <div style={s.notice}>
          You have <strong>Admin</strong> access.{' '}
          <Link to="/admin" style={s.link}>Go to Admin Dashboard →</Link>
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value }) => (
  <div style={s.row}>
    <span style={s.label}>{label}</span>
    <span style={s.value}>{value}</span>
  </div>
);

const s = {
  page: { padding: '40px 32px', maxWidth: '720px', margin: '0 auto' },
  heading: { color: '#003366', marginBottom: '4px' },
  welcome: { color: '#555', marginBottom: '24px' },
  card: {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '20px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  cardTitle: { color: '#003366', margin: 0 },
  row: { display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f0f0f0' },
  label: { width: '120px', color: '#888', fontSize: '0.85rem', paddingTop: '2px' },
  value: { color: '#333' },
  notice: {
    padding: '14px 18px',
    background: '#fff8e1',
    borderRadius: '6px',
    borderLeft: '4px solid #ffc107',
    fontSize: '0.9rem',
  },
  link: { color: '#007BC2' },
};

export default EmployeeDashboard;
