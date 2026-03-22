# Project: Okta IAM System

## Stack
| Layer    | Tech                          | Port  |
|----------|-------------------------------|-------|
| Frontend | React + Vite                  | 3000  |
| Backend  | Node.js + Express             | 5000  |
| Identity | Okta (OIDC + Management API)  | —     |
| Database | MongoDB                       | 27017 |

## Start Commands
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

## Test Commands
```bash
# Backend — Jest (46 tests)
cd backend && npm test

# Frontend — Cypress headless (54 tests)
cd frontend && npm run cy:run

# Frontend — Cypress UI
cd frontend && npm run cy:open
```

## Test Status
| Suite              | Tool    | Tests | Status      |
|--------------------|---------|-------|-------------|
| Auth middleware    | Jest    | 10    | ✅ passing  |
| User controller    | Jest    | 20    | ✅ passing  |
| Audit log          | Jest    | 16    | ✅ passing  |
| Auth E2E           | Cypress | 8     | ✅ passing  |
| Dashboard E2E      | Cypress | 11    | ✅ passing  |
| Users E2E          | Cypress | 20    | ✅ passing  |
| Provision E2E      | Cypress | 15    | ✅ passing  |
| **Total**          |         | **100** | **✅ all passing** |

## Completed Features
- SSO with OIDC (PKCE, httpOnly cookies, passport-openidconnect)
- RBAC: Admin / Manager / Employee dashboards
- MFA badge using `idToken.claims.amr` — green "MFA Verified" / yellow "Standard Auth"
- User provisioning: create user → assign group → Okta activation email
- Disable / Enable / Delete users (delete: deactivate first, then delete)
- Manage Groups modal: remove user from group, assign user to group
- Create Group / Delete Group (system groups protected: Everyone, Okta Administrators)
- Okta System Logs tab (direct REST fetch, 10s timeout, pagination)
- MongoDB audit logs — all write actions logged with readable names (email/group name, not IDs)
- JWT Bearer token auth on backend (`@okta/jwt-verifier`) + 401 interceptor (auto-redirect to login)
- Manager dashboard: read-only user directory + group list + stat cards
- Client-side pagination (10 per page) on Users, System Logs, Audit Logs tabs
- "User & Group Setup" tab: Create New User + Create New Group cards side by side
- Groups tab: list all groups with type badge (System/Custom) + delete button
- Jest test suite (backend): auth middleware, user controller, audit log coverage
- Cypress E2E suite (frontend): auth, dashboard, users, provision — 54 tests with token injection login bypass

## Admin Dashboard Tabs
| Tab               | Description                                          |
|-------------------|------------------------------------------------------|
| Users             | List, disable/enable/delete, manage groups           |
| User & Group Setup| Create new user + create new group (side by side)    |
| Groups            | List all groups, delete custom groups                |
| System Logs       | Okta system log events (last 50, past 24h)           |
| Audit Logs        | MongoDB audit trail (last 100 events)                |

## Audit Log Actions
`USER_CREATED` · `USER_DISABLED` · `USER_ENABLED` · `USER_DELETED` · `GROUP_ASSIGNED` · `GROUP_REMOVED` · `GROUP_CREATED` · `GROUP_DELETED` · `USER_LOGIN`

## Important Details

### Okta
- Group name is **"Admin"** (not "Admins") — used in `requireRole()` and `ProtectedRoute`
- `OKTA_API_TOKEN` expires every **30 days** — regenerate at:
  Okta Admin → Security → API → Tokens → Create Token
- All Okta API calls use `oktaFetch()` / `oktaPost()` / `oktaDelete()` helpers in `oktaService.js`
- `OKTA_DOMAIN` already includes `https://` — never prepend it again in URL construction
- `groups` is a **claim** not a scope — add it in: Security → API → Authorization Server → Claims
- JWT audience is `api://default` (override with `OKTA_AUDIENCE` in `.env`)

### Auth flow
- Frontend authenticates via `@okta/okta-react` (PKCE, redirects to `http://localhost:3000/login/callback`)
- Backend accepts **either** a Passport session cookie **or** `Authorization: Bearer <token>` header
- `requireRole()` reads groups from `req.user._json.groups` (normalised for both auth paths)

### MongoDB
- Collection: `auditlogs`
- URI: `mongodb://localhost:27017/okta-iam`
- Mongoose model: `backend/models/AuditLog.js`
- MongoDB must be running before starting the backend (`net start MongoDB` as Administrator)

### nodemon
- `backend/nodemon.json` configured to watch `.env` files — changes to `.env` trigger auto-restart

### Cypress auth bypass
- `cy.loginAsAdmin()` injects fake tokens into `localStorage` under `okta-token-storage`
- `@okta/okta-auth-js` reads this key on boot and treats the session as authenticated
- All backend API calls are stubbed with `cy.intercept()` — no real backend needed for E2E tests
- Always scope button selectors inside `.within()` to avoid flaky matches across multiple cards

## Next Tasks
1. Push to GitHub
2. Write README.md
