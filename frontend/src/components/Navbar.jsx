import { useOktaAuth } from '@okta/okta-react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const { authState, oktaAuth } = useOktaAuth();

  const handleLogout = () =>
    oktaAuth.signOut({ postLogoutRedirectUri: window.location.origin });

  const groups =
    authState?.accessToken?.claims?.groups ??
    authState?.idToken?.claims?.groups ??
    [];

  const isAdmin   = groups.includes('Admin');
  const isManager = groups.includes('Manager');

  return (
    <nav style={s.nav}>
      <span style={s.brand}>Okta IAM</span>
      <div style={s.links}>
        {authState?.isAuthenticated ? (
          <>
            <Link to="/dashboard" style={s.link}>Dashboard</Link>
            {isManager && <Link to="/manager" style={s.link}>Manager</Link>}
            {isAdmin   && <Link to="/admin"   style={s.link}>Admin</Link>}
            <button onClick={handleLogout} style={s.btn}>Logout</button>
          </>
        ) : (
          <Link to="/" style={s.link}>Login</Link>
        )}
      </div>
    </nav>
  );
};

const s = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 28px',
    background: '#003366',
    color: '#fff',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  brand: { fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px' },
  links: { display: 'flex', gap: '18px', alignItems: 'center' },
  link:  { color: '#fff', textDecoration: 'none', fontSize: '0.9rem' },
  btn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.7)',
    color: '#fff',
    padding: '6px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};

export default Navbar;
