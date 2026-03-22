/**
 * Auth controller helpers.
 * Passport handles the OIDC flow; these are thin wrappers used by authRoutes.
 */

/** GET /api/auth/me – return session user profile */
const getMe = (req, res) => {
  const { id, displayName, _json = {} } = req.user;
  res.json({
    id,
    displayName,
    email: _json.email,
    login: _json.preferred_username,
    groups: _json.groups ?? [],
  });
};

module.exports = { getMe };
