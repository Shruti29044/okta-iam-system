// Load custom commands
import './commands';

// Silence expected Okta-related uncaught exceptions during token injection
Cypress.on('uncaught:exception', (err) => {
  // OktaAuth throws when it can't reach the issuer or finds no token — safe to ignore in tests
  if (
    err.message.includes('OktaAuth') ||
    err.message.includes('AuthSdkError') ||
    err.message.includes('access_token') ||
    err.message.includes('id_token')
  ) {
    return false;
  }
});
