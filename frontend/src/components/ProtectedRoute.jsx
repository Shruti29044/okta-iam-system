import { useOktaAuth } from '@okta/okta-react';
import { Navigate } from 'react-router-dom';

/**
 * Wraps a route to require authentication.
 * Optionally restricts access to a specific Okta group via `requiredGroup`.
 *
 * The "groups" claim must be added to your Okta authorization server's
 * ID token or access token for group-based checks to work.
 */
const ProtectedRoute = ({ children, requiredGroup }) => {
  const { authState } = useOktaAuth();

  if (!authState) {
    return (
      <div style={styles.loading}>
        <p>Checking authentication…</p>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredGroup) {
    // Groups claim may live on the access token or the ID token depending on
    // how your Okta authorization server is configured.
    const groups =
      authState.accessToken?.claims?.groups ??
      authState.idToken?.claims?.groups ??
      [];

    if (!groups.includes(requiredGroup)) {
      return (
        <div style={styles.denied}>
          <h2>Access Denied</h2>
          <p>You must be a member of the <strong>{requiredGroup}</strong> group to view this page.</p>
        </div>
      );
    }
  }

  return children;
};

const styles = {
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#555' },
  denied: { textAlign: 'center', padding: '64px', color: '#c0392b' },
};

export default ProtectedRoute;
