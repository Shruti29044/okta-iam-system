import { useOktaAuth } from '@okta/okta-react';

/**
 * Reads authState.idToken.claims.amr (Authentication Methods References).
 * If the array includes "mfa" → green "MFA Verified" badge.
 * Otherwise                  → yellow "Standard Auth" badge.
 */
const MfaBadge = () => {
  const { authState } = useOktaAuth();
  console.log('ID token claims:', authState?.idToken?.claims);
  const amr = authState?.idToken?.claims?.amr ?? [];
  const mfaVerified = amr.includes('mfa');

  return (
    <span style={mfaVerified ? s.verified : s.standard}>
      {mfaVerified ? '🔒 MFA Verified' : '⚠ Standard Auth'}
    </span>
  );
};

const base = {
  display: 'inline-block',
  padding: '3px 12px',
  borderRadius: '12px',
  fontSize: '0.78rem',
  fontWeight: 600,
};

const s = {
  verified: { ...base, background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' },
  standard: { ...base, background: '#fff8e1', color: '#f57f17', border: '1px solid #ffe082' },
};

export default MfaBadge;
