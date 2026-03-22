import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOktaAuth } from '@okta/okta-react';

const Login = () => {
  const { authState, oktaAuth } = useOktaAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authState?.isAuthenticated) navigate('/dashboard');
  }, [authState, navigate]);

  const handleLogin = () =>
    oktaAuth.signInWithRedirect({ originalUri: '/dashboard' });

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>🔐</div>
        <h1 style={s.title}>Okta IAM System</h1>
        <p style={s.subtitle}>Sign in with your organisational account</p>
        <button onClick={handleLogin} style={s.btn}>
          Sign In with Okta
        </button>
      </div>
    </div>
  );
};

const s = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    padding: '48px 40px',
    borderRadius: '10px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    textAlign: 'center',
    minWidth: '340px',
  },
  logo: { fontSize: '3rem', marginBottom: '12px' },
  title: { color: '#003366', fontSize: '1.5rem', marginBottom: '8px' },
  subtitle: { color: '#666', marginBottom: '32px', fontSize: '0.95rem' },
  btn: {
    background: '#007BC2',
    color: '#fff',
    border: 'none',
    padding: '13px 36px',
    borderRadius: '5px',
    fontSize: '1rem',
    cursor: 'pointer',
    width: '100%',
  },
};

export default Login;
