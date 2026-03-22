/**
 * Okta Auth JS configuration consumed by @okta/okta-react.
 * Values are injected at build time from the .env file via Vite.
 */
const oktaConfig = {
  issuer: import.meta.env.VITE_OKTA_ISSUER,
  clientId: import.meta.env.VITE_OKTA_CLIENT_ID,
  redirectUri: import.meta.env.VITE_OKTA_REDIRECT_URI ?? `${window.location.origin}/login/callback`,
  postLogoutRedirectUri:
    import.meta.env.VITE_OKTA_LOGOUT_REDIRECT_URI ?? window.location.origin,
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
};

export default oktaConfig;
