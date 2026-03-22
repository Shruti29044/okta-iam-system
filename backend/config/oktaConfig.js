const { Strategy: OidcStrategy } = require('passport-openidconnect');

/**
 * Configures Passport with the Okta OpenID Connect strategy.
 * Groups claim must be enabled in your Okta Authorization Server:
 *   Security → API → default → Claims → Add Claim → groups (filter: Starts with "")
 */
module.exports = (passport) => {
  passport.use(
    'oidc',
    new OidcStrategy(
      {
        issuer: process.env.OKTA_ISSUER,
        authorizationURL: `${process.env.OKTA_ISSUER}/v1/authorize`,
        tokenURL: `${process.env.OKTA_ISSUER}/v1/token`,
        userInfoURL: `${process.env.OKTA_ISSUER}/v1/userinfo`,
        clientID: process.env.OKTA_CLIENT_ID,
        clientSecret: process.env.OKTA_CLIENT_SECRET,
        callbackURL: 'http://localhost:5000/api/auth/callback',
        scope: ['openid', 'profile', 'email'],
      },
      (_issuer, profile, done) => done(null, profile)
    )
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
};
