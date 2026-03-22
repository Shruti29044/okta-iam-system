# Okta IAM System

A full-stack Identity & Access Management (IAM) dashboard built with React, Node.js, Okta, and MongoDB.

Admins can provision users, manage group memberships, view Okta system logs, and track every action in a MongoDB audit trail — all secured with Okta SSO and role-based access control.

---

## Features

- **SSO Login** via Okta OIDC (PKCE flow, no passwords stored)
- **Role-Based Access Control** — Admin, Manager, and Employee dashboards
- **MFA Badge** — shows whether the logged-in user authenticated with MFA
- **User Management** — create, disable, enable, delete users
- **Group Management** — create groups, delete custom groups, assign/remove users from groups
- **Okta System Logs** — live view of the last 50 Okta events (past 24h)
- **MongoDB Audit Trail** — every write action logged with readable names, performer email, and SUCCESS/FAILURE status
- **Pagination** — client-side, 10 items per page on all tables
- **100 automated tests** — Jest (backend) + Cypress E2E (frontend)

---

## Tech Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Frontend | React 18 + Vite + `@okta/okta-react` |
| Backend  | Node.js + Express + Passport.js   |
| Identity | Okta (OIDC + Management API)      |
| Database | MongoDB + Mongoose                |

---

## Project Structure

```
okta-iam-system/
├── backend/
│   ├── config/          # Passport OIDC strategy
│   ├── controllers/     # Route handlers + audit logging
│   ├── middleware/       # ensureAuthenticated + requireRole
│   ├── models/          # AuditLog mongoose schema
│   ├── routes/          # Auth + admin routes
│   ├── services/        # Okta REST API helpers
│   ├── tests/           # Jest test suite (46 tests)
│   └── server.js
└── frontend/
    ├── src/
    │   ├── components/  # Navbar, ProtectedRoute, MfaBadge
    │   └── pages/       # AdminDashboard, ManagerDashboard, EmployeeDashboard
    ├── cypress/         # E2E test suite (54 tests)
    └── cypress.config.js
```

---

## Prerequisites

- Node.js 18+
- MongoDB running locally on port 27017
- An Okta developer account (free at [developer.okta.com](https://developer.okta.com))

---

## Okta Setup

### 1. Create an OIDC App
- Okta Admin → Applications → Create App Integration
- Sign-in method: **OIDC**, App type: **Single-Page Application**
- Sign-in redirect URI: `http://localhost:3000/login/callback`
- Sign-out redirect URI: `http://localhost:3000`
- Note the **Client ID**

### 2. Create Groups
Create these three groups in Okta Admin → Directory → Groups:
- `Admin`
- `Manager`
- `Employee`

### 3. Add Groups Claim
- Okta Admin → Security → API → Authorization Servers → default
- Claims tab → Add Claim
  - Name: `groups`, Include in: `Access Token + ID Token`
  - Value type: Groups, Filter: Matches regex `.*`

### 4. Generate an API Token
- Okta Admin → Security → API → Tokens → Create Token
- Note: tokens expire every **30 days**

---

## Installation

```bash
# Clone the repo
git clone https://github.com/your-username/okta-iam-system.git
cd okta-iam-system
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in your Okta credentials in .env
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Fill in your Okta credentials in .env
```

---

## Environment Variables

### `backend/.env`
```env
OKTA_DOMAIN=https://your-domain.okta.com
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
OKTA_CLIENT_ID=your-oidc-client-id
OKTA_CLIENT_SECRET=your-oidc-client-secret
OKTA_API_TOKEN=your-api-token
SESSION_SECRET=generate-a-random-32-byte-hex-string
MONGODB_URI=mongodb://localhost:27017/okta-iam
PORT=5000
```

### `frontend/.env`
```env
VITE_OKTA_DOMAIN=https://your-domain.okta.com
VITE_OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
VITE_OKTA_CLIENT_ID=your-oidc-client-id
VITE_OKTA_REDIRECT_URI=http://localhost:3000/login/callback
VITE_OKTA_LOGOUT_REDIRECT_URI=http://localhost:3000
```

---

## Running the App

```bash
# Terminal 1 — start MongoDB (Windows)
net start MongoDB

# Terminal 2 — start backend
cd backend && npm run dev

# Terminal 3 — start frontend
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Running Tests

```bash
# Backend — Jest (46 tests)
cd backend && npm test

# Frontend — Cypress headless (54 tests)
cd frontend && npm run cy:run

# Frontend — Cypress interactive UI
cd frontend && npm run cy:open
```

### Test Coverage

| Suite           | Tool    | Tests |
|-----------------|---------|-------|
| Auth middleware | Jest    | 10    |
| User controller | Jest    | 20    |
| Audit log       | Jest    | 16    |
| Auth E2E        | Cypress | 8     |
| Dashboard E2E   | Cypress | 11    |
| Users E2E       | Cypress | 20    |
| Provision E2E   | Cypress | 15    |
| **Total**       |         | **100** |

---

## Admin Dashboard Tabs

| Tab                | Description                                      |
|--------------------|--------------------------------------------------|
| Users              | List all users, disable/enable/delete, manage groups |
| User & Group Setup | Create new user + create new group (side by side) |
| Groups             | List all groups, delete custom groups            |
| System Logs        | Live Okta event log (last 50, past 24h)          |
| Audit Logs         | MongoDB audit trail (last 100 actions)           |

---

## Audit Log Actions

| Action          | Triggered by               |
|-----------------|----------------------------|
| `USER_CREATED`  | Provisioning a new user    |
| `USER_DISABLED` | Disabling a user           |
| `USER_ENABLED`  | Re-enabling a user         |
| `USER_DELETED`  | Permanently deleting a user|
| `GROUP_ASSIGNED`| Adding a user to a group   |
| `GROUP_REMOVED` | Removing a user from a group|
| `GROUP_CREATED` | Creating a new group       |
| `GROUP_DELETED` | Deleting a group           |
| `USER_LOGIN`    | Admin logging in           |

---

## License

MIT
