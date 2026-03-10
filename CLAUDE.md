# Project Overview

This is a Vue 3 + TypeScript frontend with an AWS Lambda backend (Node.js ESM). It integrates multiple OAuth providers: Salesforce, Direct, and Microsoft.

---

## Direct OAuth Integration

### Architecture

```
Browser (Vue 3)
  └── src/layout/DirectLayout.vue          — nav, sign-in/logout buttons
  └── src/services/directOAuth.ts          — all OAuth logic, session management, API calls
  └── src/views/direct/
        ├── IndexView.vue                  — landing page
        ├── OAuthCallbackView.vue          — handles redirect back from Direct
        ├── OrganizationView.vue           — lists user's organizations
        ├── UserView.vue                   — lists users in a domain
        └── DirectTalkRoomView.vue         — talk room listing

AWS Lambda (backend/src/handler.mjs)
  └── backend/src/services/direct.mjs     — token exchange, refresh, userinfo, logout, org/user APIs
```

---

### Environment Variables

#### Frontend (Vite — injected as globals via `vite.config.ts`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | API Gateway base URL (e.g. `https://xxx.execute-api.region.amazonaws.com`) |
| `DIRECT_CLIENT_ID` | OAuth client ID |
| `DIRECT_CLIENT_SECRET` | OAuth client secret |
| `DIRECT_REDIRECT_URL` | Callback URL, must be `<app-origin>/direct/oauth/callback` |
| `DIRECT_REST_API` | Direct REST API base URL (e.g. `https://restapi-directdev.feel-on.com`) |
| `DIRECT_SCOPES` | Space-separated scopes, e.g. `openid offline_access profile email` |

#### Backend (Lambda environment variables)

| Variable | Description |
|---|---|
| `DIRECT_CLIENT_ID` | OAuth client ID |
| `DIRECT_CLIENT_SECRET` | OAuth client secret |
| `DIRECT_REDIRECT_URI` | Must match the registered redirect URI exactly |
| `DIRECT_TOKEN_URL` | Token endpoint (default: `https://directdev.feel-on.com/oauth2/token`) |
| `DIRECT_REST_API` | REST API base URL (default: `https://restapi-directdev.feel-on.com`) |
| `DIRECT_LOGOUT_URL` | Revoke endpoint (default: `<DIRECT_REST_API>/oauth2/revoke`) |
| `FRONTEND_ORIGIN` | Allowed CORS origin(s), comma-separated |

---

### OAuth Flow (Step by Step)

1. **User clicks "Sign In"** → `DirectLayout.vue` calls `redirectToDirectLogin()`.
2. **`redirectToDirectLogin()`** (in `directOAuth.ts`) builds the authorize URL:
   - Endpoint: `<DIRECT_REST_API>/oauth2/authorize`
   - Params: `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `nonce`, `prompt=consent`
   - Saves `state` to `sessionStorage` under key `direct_oauth_state`.
   - Redirects the browser via `window.location.assign(url)`.
3. **User authenticates on Direct** → Direct redirects back to `/direct/oauth/callback?code=...&state=...`.
4. **`OAuthCallbackView.vue`** reads `code` and `state` from the URL, calls `handleDirectForceOAuthCallback(code, state)`.
5. **`handleDirectForceOAuthCallback()`**:
   - Validates `state` against `sessionStorage`.
   - Calls `POST /api/auth/direct/token` with `{ code }`.
   - Lambda exchanges code for tokens using `DIRECT_CLIENT_ID`, `DIRECT_CLIENT_SECRET`, `DIRECT_REDIRECT_URI`.
   - Calls `POST /api/auth/direct/userinfo` with the `access_token` to fetch user profile.
   - Saves session (`DirectAuthSession`) to `localStorage` under key `direct_oauth_session`.
   - Saves user info to `localStorage` under key `direct_user_info`.
   - Fires `CustomEvent('direct-auth-changed')` so the layout re-renders.
6. **`DirectLayout.vue`** listens for `direct-auth-changed` and `storage` events to reactively update the nav state.

---

### Token Refresh

- All authenticated API calls go through `directApiFetch(path)` in `directOAuth.ts`.
- On a `401` response, `refreshDirectAccessToken()` is automatically called.
- Refresh hits `POST /api/auth/direct/refresh` with `{ refreshToken }`.
- Lambda calls the token endpoint with `grant_type=refresh_token`.
- The updated session (with new `access_token`) is saved back to `localStorage`.
- If refresh also returns `401`, the session is cleared and the user must sign in again.
- `prompt=consent` is used during the initial authorize to ensure a `refresh_token` is always issued.

---

### Logout

- **`clearDirectSession()`** in `directOAuth.ts`:
  1. Calls `POST /api/auth/direct/logout` with `Authorization: Bearer <access_token>`.
  2. Lambda calls the Direct revoke endpoint with `token`, `client_id`, `client_secret`.
  3. Removes `direct_oauth_session`, `direct_user_info` from `localStorage`.
  4. Removes `direct_oauth_state` from `sessionStorage`.
  5. Fires `direct-auth-changed` event.

---

### Backend API Routes (Lambda)

All routes are handled in `backend/src/handler.mjs`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/direct/token` | Exchange authorization code for tokens |
| `POST` | `/api/auth/direct/refresh` | Refresh access token using refresh token |
| `POST` | `/api/auth/direct/userinfo` | Fetch logged-in user profile from Direct |
| `POST` | `/api/auth/direct/logout` | Revoke access token (logout) |
| `GET` | `/api/direct/organization` | List the user's organizations (domains) |
| `GET` | `/api/direct/:domainId/users` | List members of a domain (supports `limit` & `offset` query params) |

All authenticated routes read the Bearer token from the `Authorization` header.

---

### Frontend Service Functions (`src/services/directOAuth.ts`)

| Function | Exported | Purpose |
|---|---|---|
| `redirectToDirectLogin()` | Yes | Builds authorize URL and redirects |
| `buildDirectAuthorizeUrl()` | Yes | Returns the full authorize URL string |
| `handleDirectForceOAuthCallback(code, state)` | Yes | Processes the OAuth callback |
| `getDirectSession()` | Yes | Reads the current session from `localStorage` |
| `clearDirectSession()` | Yes | Logs out and clears all stored session data |
| `fetchDirectOrganizationList()` | Yes | Fetches organizations for the logged-in user |
| `fetchDirectOrganizationUserList(domainId, options?)` | Yes | Fetches members of a domain |
| `DIRECT_AUTH_CHANGED_EVENT` | Yes | Event name for auth state change broadcasts |

---

### Session Storage Keys

| Key | Storage | Contents |
|---|---|---|
| `direct_oauth_state` | `sessionStorage` | CSRF state value for the current auth flow |
| `direct_oauth_session` | `localStorage` | `DirectAuthSession` object (tokens, state, savedAt) |
| `direct_user_info` | `localStorage` | `{ email, name, sub }` of the logged-in user |

---

### Router (Direct routes)

All Direct routes are nested under `/direct` using `DirectLayout` as the parent component.

| Route name | Path | Component |
|---|---|---|
| `directIndex` | `/direct/index` | `IndexView.vue` |
| `directOAuthCallback` | `/direct/oauth/callback` | `OAuthCallbackView.vue` |
| `directOrganization` | `/direct/organization` | `OrganizationView.vue` |
| `directTalkRoom` | `/direct/talkroom` | `DirectTalkRoomView.vue` |
| `directUserList` | `/direct/organization/:domainId/users` | `UserView.vue` |

---

### Adding a New Direct API Endpoint

**Frontend** — add a new exported function to `src/services/directOAuth.ts`:
```ts
export const fetchSomething = async () => {
  const response = await directApiFetch('/api/direct/something')
  // handle response...
}
```

**Backend** — add a new route block in `backend/src/handler.mjs`:
```js
if (method === 'GET' && path === '/api/direct/something') {
  const token = readBearerToken(event, body)
  if (!token) return jsonResponse(400, { error: 'Missing access token' }, requestOrigin)
  // call a function from services/direct.mjs
}
```

Add the corresponding service function in `backend/src/services/direct.mjs` following the same pattern as `directOrganizationList`.

---

### Key Files

| File | Role |
|---|---|
| [src/services/directOAuth.ts](src/services/directOAuth.ts) | Core frontend OAuth logic |
| [src/layout/DirectLayout.vue](src/layout/DirectLayout.vue) | Navbar, sign-in/logout, auth state listener |
| [src/views/direct/OAuthCallbackView.vue](src/views/direct/OAuthCallbackView.vue) | Handles OAuth redirect callback |
| [src/views/direct/OrganizationView.vue](src/views/direct/OrganizationView.vue) | Organization list UI |
| [src/views/direct/UserView.vue](src/views/direct/UserView.vue) | Domain user list UI |
| [src/router/index.ts](src/router/index.ts) | Route definitions |
| [src/config/env.ts](src/config/env.ts) | Typed env config (reads Vite globals) |
| [backend/src/handler.mjs](backend/src/handler.mjs) | Lambda entry point, all route handling |
| [backend/src/services/direct.mjs](backend/src/services/direct.mjs) | Backend Direct API calls |
| [.env.example](.env.example) | All required environment variables |

---

## Salesforce OAuth Integration

### Architecture

```
Browser (Vue 3)
  └── src/layout/SalesforceLayout.vue       — nav, sign-in/logout buttons
  └── src/services/salesforceAuth.ts        — OAuth logic, session management, API calls, event summary
  └── src/views/salesforce/
        ├── IndexView.vue                   — landing page
        ├── OAuthCallbackView.vue           — handles redirect back from Salesforce
        ├── UserListView.vue                — lists Salesforce users
        ├── EventListView.vue               — lists events for a user
        └── EventSummaryView.vue            — AI-generated event summary (via Bedrock)

AWS Lambda (backend/src/handler.mjs)
  └── backend/src/services/salesforce.mjs  — token exchange, refresh, Salesforce API proxy
```

---

### Environment Variables

#### Frontend (Vite — injected as globals via `vite.config.ts`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | API Gateway base URL |
| `SF_LOGIN_URL` | Salesforce login URL (e.g. `https://login.salesforce.com`) |
| `SF_CLIENT_ID` | Connected App consumer key |
| `SF_REDIRECT_URI` | Callback URL, must be `<app-origin>/salesforce/oauth/callback` |
| `SF_SCOPES` | Space-separated scopes, e.g. `refresh_token api` |
| `SF_ALIAS_NAME` | Alias name used as prefix in the OAuth state string |

#### Backend (Lambda environment variables)

| Variable | Description |
|---|---|
| `SF_LOGIN_URL` | Salesforce login URL — used to build the token endpoint |
| `SF_CLIENT_ID` | Connected App consumer key |
| `SF_CLIENT_SECRET` | Connected App consumer secret |
| `SF_REDIRECT_URI` | Must match the registered redirect URI exactly |
| `FRONTEND_ORIGIN` | Allowed CORS origin(s), comma-separated |

---

### OAuth Flow (Step by Step)

1. **User clicks "Sign In"** → `SalesforceLayout.vue` calls `redirectToSalesforceLogin()`.
2. **`redirectToSalesforceLogin()`** (in `salesforceAuth.ts`) builds the authorize URL:
   - Endpoint: `<SF_LOGIN_URL>/services/oauth2/authorize`
   - Params: `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`
   - State is formatted as `<SF_ALIAS_NAME>:<timestamp>` and saved to `sessionStorage` under `salesforce_oauth_state`.
   - Redirects via `window.location.assign(url)`.
3. **User authenticates on Salesforce** → redirected back to `/salesforce/oauth/callback?code=...&state=...`.
4. **`OAuthCallbackView.vue`** reads `code` and `state`, calls `handleSalesforceOAuthCallback(code, state)`.
5. **`handleSalesforceOAuthCallback()`**:
   - Validates `state` against `sessionStorage`.
   - Calls `POST /api/auth/salesforce/token` with `{ code }`.
   - Lambda exchanges code via `<SF_LOGIN_URL>/services/oauth2/token` using `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_REDIRECT_URI`.
   - Maps the token response to a `SalesforceAuthSession` and saves it to `localStorage` under `salesforce_oauth_session`.
   - Fires `CustomEvent('salesforce-auth-changed')` so the layout re-renders.
6. **`SalesforceLayout.vue`** listens for `salesforce-auth-changed` and `storage` events to reactively update nav state.

---

### Token Refresh

- All Salesforce API calls go through `salesforceApiFetch(path, init?)`.
- Requests are proxied via `POST /api/salesforce/request` — the Lambda forwards them to the Salesforce instance URL, preserving the `Authorization` header.
- On a `401` response, `refreshSalesforceAccessToken()` is automatically called.
- Refresh hits `POST /api/auth/salesforce/refresh` with `{ refreshToken }`.
- Lambda calls `<SF_LOGIN_URL>/services/oauth2/token` with `grant_type=refresh_token`.
- The updated session is saved back to `localStorage`.
- Unlike Direct, there is **no second-retry 401 clearing** — after refresh the retry result is returned directly.

---

### Logout

- **`clearSalesforceSession()`** in `salesforceAuth.ts`:
  - Removes `salesforce_oauth_session` from `localStorage`.
  - Removes `salesforce_oauth_state` from `sessionStorage`.
  - Fires `salesforce-auth-changed` event.
  - Note: Salesforce does **not** have a server-side token revoke call in this implementation — only local session is cleared.

---

### Backend API Routes (Lambda)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/salesforce/token` | Exchange authorization code for tokens |
| `POST` | `/api/auth/salesforce/refresh` | Refresh access token using refresh token |
| `POST` | `/api/salesforce/request` | Proxy any authenticated Salesforce REST API request |

The proxy route (`/api/salesforce/request`) accepts a body of:
```json
{
  "instanceUrl": "https://your-org.salesforce.com",
  "path": "/services/data/v62.0/query?q=...",
  "method": "GET",
  "headers": { "Authorization": "Bearer ..." }
}
```

---

### Frontend Service Functions (`src/services/salesforceAuth.ts`)

| Function | Exported | Purpose |
|---|---|---|
| `redirectToSalesforceLogin()` | Yes | Builds authorize URL and redirects |
| `buildSalesforceAuthorizeUrl()` | Yes | Returns the full authorize URL string |
| `handleSalesforceOAuthCallback(code, state)` | Yes | Processes the OAuth callback |
| `getSalesforceSession()` | Yes | Reads the current session from `localStorage` |
| `saveSalesforceSession(session)` | Yes | Persists session and fires auth-changed event |
| `clearSalesforceSession()` | Yes | Clears session from storage and fires event |
| `refreshSalesforceAccessToken()` | Yes | Exchanges refresh token for a new access token |
| `salesforceApiFetch(path, init?)` | Yes | Authenticated fetch with auto-refresh on 401 |
| `fetchSalesforceUsers()` | Yes | Fetches all Salesforce users via SOQL |
| `fetchMitocoEventsByUserAndDateRange(userId, start, end)` | Yes | Fetches events for a user in a date range |
| `fetchEventSummary(userId, events, options?)` | Yes | Sends events to Bedrock for AI summarization |
| `toSummaryEventPayload(events)` | Yes | Maps full event records to summary payload shape |

---

### Session Storage Keys

| Key | Storage | Contents |
|---|---|---|
| `salesforce_oauth_state` | `sessionStorage` | CSRF state value for the current auth flow |
| `salesforce_oauth_session` | `localStorage` | `SalesforceAuthSession` object (tokens, instanceUrl, etc.) |

---

### Router (Salesforce routes)

All Salesforce routes are nested under `/salesforce` using `SalesforceLayout` as the parent component.

| Route name | Path | Component |
|---|---|---|
| `salesforceIndex` | `/salesforce/index` | `IndexView.vue` |
| `salesforceOAuthCallback` | `/salesforce/oauth/callback` | `OAuthCallbackView.vue` |
| `salesforceUsers` | `/salesforce/users` | `UserListView.vue` |
| `salesforceUserEvent` | `/users/:userId/events` | `EventListView.vue` |
| `salesforceUserEventSummary` | `/users/:userId/events/summary` | `EventSummaryView.vue` |

---

### Event Summary (Bedrock AI)

The `fetchEventSummary()` function sends Salesforce events to the Bedrock lambda endpoint for AI summarization. It uses `@dshahi468/nd-dataset-split` to process events in chunks.

- Chunk size: `20` events per request
- Max concurrency: `3` parallel chunk requests
- Max retries per chunk: `2` (600ms base delay, 1.5x backoff)
- Transient errors retried: 429, 500, 502, 503, 504, throttle, timeout
- Results are merged by deduplicating events across chunks by `subject|startDateTime|endDateTime`

Lambda route: `POST /api/bedrock/events-summary`

---

### Key Files

| File | Role |
|---|---|
| [src/services/salesforceAuth.ts](src/services/salesforceAuth.ts) | Core frontend OAuth + API logic |
| [src/layout/SalesforceLayout.vue](src/layout/SalesforceLayout.vue) | Navbar, sign-in/logout, auth state listener |
| [src/views/salesforce/OAuthCallbackView.vue](src/views/salesforce/OAuthCallbackView.vue) | Handles OAuth redirect callback |
| [src/views/salesforce/UserListView.vue](src/views/salesforce/UserListView.vue) | Salesforce user list UI |
| [src/views/salesforce/EventListView.vue](src/views/salesforce/EventListView.vue) | User event list UI |
| [src/views/salesforce/EventSummaryView.vue](src/views/salesforce/EventSummaryView.vue) | AI event summary UI |
| [backend/src/services/salesforce.mjs](backend/src/services/salesforce.mjs) | Backend token exchange and API proxy |

---

## Microsoft OAuth Integration

### Architecture

```
Browser (Vue 3)
  └── src/layout/MicrosoftLayout.vue        — nav, sign-in/logout buttons
  └── src/services/microsoftOAuth.ts        — all OAuth logic, session management, API calls
  └── src/views/microsoft/
        ├── IndexView.vue                   — landing / dashboard page
        └── OAuthCallbackView.vue           — handles redirect back from Microsoft

AWS Lambda (backend/src/handler.mjs)
  └── backend/src/services/microsoft.mjs   — token exchange, token refresh
```

---

### Environment Variables

#### Frontend (Vite — injected as globals via `vite.config.ts`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | API Gateway base URL |
| `MS_CLIENT_ID` | Azure AD app client ID |
| `MS_CLIENT_SECRET` | Azure AD app client secret |
| `MS_TENANT_ID` | Azure AD tenant ID |
| `MS_REDIRECT_URI` | Callback URL, must be `<app-origin>/microsoft/oauth/callback` |
| `MS_SCOPES` | Space-separated scopes, e.g. `user.read offline_access` |
| `MS_LOGIN_URL` | Microsoft login base URL (e.g. `https://login.microsoftonline.com`) |

#### Backend (Lambda environment variables)

| Variable | Description |
|---|---|
| `MICROSOFT_CLIENT_ID` | Azure AD app client ID |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app client secret |
| `MICROSOFT_TENANT_ID` | Azure AD tenant ID |
| `MICROSOFT_REDIRECT_URI` | Must match the registered redirect URI exactly |
| `MICROSOFT_TOKEN_URL` | Token base URL (default: `https://login.microsoftonline.com`) |
| `FRONTEND_ORIGIN` | Allowed CORS origin(s), comma-separated |

---

### OAuth Flow (Step by Step)

1. **User clicks "Sign In"** → `MicrosoftLayout.vue` calls `redirectToMicrosoftLogin()`.
2. **`redirectToMicrosoftLogin()`** (in `microsoftOAuth.ts`) builds the authorize URL:
   - Endpoint: `<MS_LOGIN_URL>/<tenantId>/oauth2/v2.0/authorize`
   - Params: `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `nonce`, `prompt=consent`
   - State is formatted as `<SF_ALIAS_NAME>:<timestamp>` and saved to `sessionStorage` under `microsoft_oauth_state`.
   - Redirects via `window.location.assign(url)`.
3. **User authenticates on Microsoft** → redirected back to `/microsoft/oauth/callback?code=...&state=...`.
4. **`OAuthCallbackView.vue`** reads `code` and `state`, calls `handleMicrosoftOAuthCallback(code, state)`.
5. **`handleMicrosoftOAuthCallback()`**:
   - Validates `state` against `sessionStorage`.
   - Calls `POST /api/auth/microsoft/token` with `{ code }`.
   - Lambda exchanges code via `<MICROSOFT_TOKEN_URL>/<tenantId>/oauth2/v2.0/token` using `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`.
   - Maps the token response to a `MicrosoftAuthSession` and saves it to `localStorage` under `microsoft_oauth_session`.
   - Fires `CustomEvent('microsoft-auth-changed')` so the layout re-renders.
6. **`MicrosoftLayout.vue`** listens for `microsoft-auth-changed` and `storage` events to reactively update nav state.

---

### Token Refresh

- All authenticated API calls should go through `microsoftApiFetch(path)` in `microsoftOAuth.ts`.
- On a `401` response, `refreshMicrosoftAccessToken()` is automatically called.
- Refresh hits `POST /api/auth/microsoft/refresh` with `{ refreshToken }`.
- Lambda calls the Microsoft token endpoint with `grant_type=refresh_token`.
- The updated session (with new `access_token`) is saved back to `localStorage`.
- If the refresh also returns `401`, the session is cleared and the user must sign in again.
- `prompt=consent` is used during the initial authorize to ensure a `refresh_token` is always issued. Include `offline_access` in scopes to receive a refresh token.

---

### Logout

- **`clearMicrosoftSession()`** in `microsoftOAuth.ts`:
  - Removes `microsoft_oauth_session` from `localStorage`.
  - Removes `microsoft_user_info` from `localStorage`.
  - Removes `microsoft_oauth_state` from `sessionStorage`.
  - Fires `microsoft-auth-changed` event.
  - Note: Microsoft logout is **local-only** — no server-side token revoke endpoint is called. To fully invalidate the session on Microsoft's side, redirect the user to `<MS_LOGIN_URL>/<tenantId>/oauth2/v2.0/logout`.

---

### Backend API Routes (Lambda)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/microsoft/token` | Exchange authorization code for tokens |
| `POST` | `/api/auth/microsoft/refresh` | Refresh access token using refresh token |

---

### Frontend Service Functions (`src/services/microsoftOAuth.ts`)

| Function | Exported | Purpose |
|---|---|---|
| `redirectToMicrosoftLogin()` | Yes | Builds authorize URL and redirects |
| `buildMicrosoftAuthorizeUrl()` | Yes | Returns the full authorize URL string |
| `handleMicrosoftOAuthCallback(code, state)` | Yes | Processes the OAuth callback |
| `getMicrosoftSession()` | Yes | Reads the current session from `localStorage` |
| `clearMicrosoftSession()` | Yes | Clears all stored session data and fires event (logout) |
| `refreshMicrosoftAccessToken()` | Yes | Exchanges refresh token for a new access token |
| `microsoftApiFetch(path)` | Yes | Authenticated GET fetch with auto-refresh on 401 |
| `DIRECT_AUTH_CHANGED_EVENT` | Yes | Event name (`'microsoft-auth-changed'`) for auth state broadcasts |

---

### Session Storage Keys

| Key | Storage | Contents |
|---|---|---|
| `microsoft_oauth_state` | `sessionStorage` | CSRF state value for the current auth flow |
| `microsoft_oauth_session` | `localStorage` | `MicrosoftAuthSession` object (tokens, state, savedAt) |
| `microsoft_user_info` | `localStorage` | Reserved for user profile info |

---

### Router (Microsoft routes)

All Microsoft routes are nested under `/microsoft` using `MicrosoftLayout` as the parent component.

| Route name | Path | Component |
|---|---|---|
| `microsoftIndex` | `/microsoft/index` | `IndexView.vue` |
| `microsoftOAuthCallback` | `/microsoft/oauth/callback` | `OAuthCallbackView.vue` |

---

### Adding a New Microsoft API Endpoint

**Frontend** — use `microsoftApiFetch` in `src/services/microsoftOAuth.ts`:
```ts
export const fetchMicrosoftProfile = async () => {
  const response = await microsoftApiFetch('/api/microsoft/profile')
  // handle response...
}
```

**Backend** — add a new route block in `backend/src/handler.mjs`:
```js
if (method === 'GET' && path === '/api/microsoft/profile') {
  const token = readBearerToken(event, body)
  if (!token) return jsonResponse(400, { error: 'Missing access token' }, requestOrigin)
  // proxy to Microsoft Graph API or call a service function
}
```

---

### Key Files

| File | Role |
|---|---|
| [src/services/microsoftOAuth.ts](src/services/microsoftOAuth.ts) | Core frontend OAuth logic |
| [src/layout/MicrosoftLayout.vue](src/layout/MicrosoftLayout.vue) | Navbar, sign-in/logout, auth state listener |
| [src/views/microsoft/OAuthCallbackView.vue](src/views/microsoft/OAuthCallbackView.vue) | Handles OAuth redirect callback |
| [src/views/microsoft/IndexView.vue](src/views/microsoft/IndexView.vue) | Landing / dashboard page |
| [src/router/index.ts](src/router/index.ts) | Route definitions |
| [backend/src/handler.mjs](backend/src/handler.mjs) | Lambda entry point, all route handling |
| [backend/src/services/microsoft.mjs](backend/src/services/microsoft.mjs) | Backend token exchange and refresh |

---

## Bootstrap Guide — Integrating a New OAuth Provider

Use this section to add Salesforce, Direct, or Microsoft OAuth into a **new application** from scratch.

---

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Vue 3 + TypeScript (Composition API, `<script setup>`) |
| Frontend bundler | Vite 7 |
| Routing | Vue Router 5 |
| Styling | Tailwind CSS 4 |
| Backend | AWS Lambda (Node.js ESM, `"type": "module"`) |
| Backend trigger | API Gateway HTTP API (payload format v2) |
| Node version | `^20.19.0` or `>=22.12.0` |

---

### How Frontend Environment Variables Work

**This project does NOT use `import.meta.env` for OAuth secrets** — it uses Vite's `define` to inject variables as compile-time globals. This avoids exposing `.env` variable names in the bundle.

**Step 1 — Add raw values to `.env`:**
```
MY_CLIENT_ID=your-client-id
MY_CLIENT_SECRET=your-client-secret
```

**Step 2 — Declare globals in `vite.config.ts`:**
```ts
// vite.config.ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      __MY_CLIENT_ID__: JSON.stringify(env.MY_CLIENT_ID ?? ''),
      __MY_CLIENT_SECRET__: JSON.stringify(env.MY_CLIENT_SECRET ?? ''),
    },
  }
})
```

**Step 3 — Declare TypeScript types in `env.d.ts`:**
```ts
declare const __MY_CLIENT_ID__: string
declare const __MY_CLIENT_SECRET__: string
```

**Step 4 — Read in `src/config/env.ts`:**
```ts
export const ENV = {
  myProvider: {
    clientId: __MY_CLIENT_ID__.trim(),
    clientSecret: __MY_CLIENT_SECRET__.trim(),
  },
}
```

> `VITE_API_BASE_URL` and `VITE_APP_NAME` are the only values read via `import.meta.env` — they are not secrets.

---

### Backend Lambda Structure

```
backend/src/
├── handler.mjs          — single entry point, routes all requests
├── lib/
│   ├── env.mjs          — trimEnv(), normalizeBaseUrl(), envNumber()
│   └── http.mjs         — parseUpstreamResponse(), getMethod(), getPath(), parseBody()
└── services/
    ├── direct.mjs       — Direct API calls
    ├── microsoft.mjs    — Microsoft API calls
    └── salesforce.mjs   — Salesforce API calls
```

**`lib/env.mjs` helpers:**
```js
trimEnv(value, fallback)      // trims whitespace and surrounding quotes from env vars
normalizeBaseUrl(url)         // strips trailing slashes from a URL
envNumber(value, fallback)    // parses a number from an env var with a fallback
```

**`lib/http.mjs` helpers:**
```js
parseUpstreamResponse(response)  // reads response body as text, parses JSON if possible
getMethod(event)                 // reads HTTP method from Lambda event (supports v1 + v2 payload)
getPath(event)                   // reads path from Lambda event (supports v1 + v2 payload)
parseBody(event)                 // parses JSON body from Lambda event, handles base64 encoding
```

**Standard handler route pattern:**
```js
if (method === 'POST' && path === '/api/auth/myprovider/token') {
  const code = typeof body.code === 'string' ? body.code : ''
  if (!code) return jsonResponse(400, { error: 'Missing authorization code.' }, requestOrigin)
  const payload = await myProviderTokenRequest({ grant_type: 'authorization_code', code, ... })
  return jsonResponse(200, payload, requestOrigin)
}
```

**CORS:** Controlled by the `FRONTEND_ORIGIN` Lambda env var (comma-separated list, or `*`). The `corsHeaders()` function in handler.mjs handles this automatically for all responses.

**Bearer token extraction:** Use the `readBearerToken(event, body)` helper — it reads from either `Authorization: Bearer <token>` header or `body.token`.

---

### Frontend OAuth Service Pattern

Every OAuth service file follows this consistent pattern:

```
1. Storage key constants         (sessionStorage key, localStorage key, event name)
2. Type definitions              (TokenResponse, AuthSession, domain types)
3. buildOAuthState()             (generates state, saves to sessionStorage)
4. buildAuthorizeUrl()           (constructs the full authorize URL)
5. redirectToLogin()             (calls window.location.assign)
6. fetchToken(payload)           (POST /api/auth/<provider>/token)
7. fetchRefreshToken(payload)    (POST /api/auth/<provider>/refresh)
8. mapTokenToSession(token)      (maps raw token response to session shape)
9. saveSession(session)          (localStorage + fire CustomEvent)
10. getSession()                 (read + parse from localStorage)
11. clearSession()               (remove all keys + fire CustomEvent)
12. refreshAccessToken()         (calls fetchRefreshToken, saves new session)
13. performAuthorizedRequest()   (single fetch with Authorization header)
14. apiFetch(path)               (calls performAuthorizedRequest + auto-refresh on 401)
15. handleOAuthCallback(code, state)  (validates state, exchanges code, saves session)
16. domain API functions         (fetchOrganizations, fetchUsers, etc. — use apiFetch)
```

---

### Frontend Layout Pattern

Every `*Layout.vue` follows this pattern:

```vue
<script setup lang="ts">
import { getSession, clearSession, redirectToLogin, AUTH_CHANGED_EVENT } from '@/services/myOAuth'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isMobileMenuOpen = ref(false)
const isAuthenticated = ref(false)

const refreshSession = () => {
  isAuthenticated.value = Boolean(getSession()?.accessToken)
}
const handleSignIn = () => { redirectToLogin(); isMobileMenuOpen.value = false }
const handleSignOut = () => { clearSession(); router.push({ name: 'myProviderIndex' }) }

onMounted(() => {
  refreshSession()
  window.addEventListener(AUTH_CHANGED_EVENT, refreshSession)
  window.addEventListener('storage', refreshSession)
})
onBeforeUnmount(() => {
  window.removeEventListener(AUTH_CHANGED_EVENT, refreshSession)
  window.removeEventListener('storage', refreshSession)
})
</script>
```

---

### Router Pattern

All provider routes are nested under a layout component:

```ts
// src/router/index.ts
{
  path: '/myprovider',
  name: 'myProviderLayout',
  component: MyProviderLayout,
  redirect: { name: 'myProviderIndex' },
  children: [
    { path: 'index', name: 'myProviderIndex', component: IndexView },
    { path: 'oauth/callback', name: 'myProviderOAuthCallback', component: OAuthCallbackView },
    // add more children as needed
  ],
}
```

The OAuth callback route **must** be a child of the layout so it shares the same base path. The redirect URL registered with the provider must match exactly, e.g. `https://your-app.com/myprovider/oauth/callback`.

---

### OAuthCallbackView Pattern

```vue
<script setup lang="ts">
import { handleOAuthCallback } from '@/services/myOAuth'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

onMounted(async () => {
  const route = useRoute()
  const router = useRouter()
  const code = String(route.query.code || '')
  const state = String(route.query.state || '')
  try {
    await handleOAuthCallback(code, state)
    router.push({ name: 'myProviderIndex' })
  } catch (error) {
    console.error('OAuth callback failed.', error)
    router.push({ name: 'myProviderIndex' })
  }
})
</script>
<template>
  <div class="py-10 text-center text-sm text-slate-600">Completing sign in...</div>
</template>
```

---

### Provider-Specific Notes

#### Salesforce
- Token endpoint: `<SF_LOGIN_URL>/services/oauth2/token`
- All Salesforce REST API calls must be **proxied** through Lambda (`POST /api/salesforce/request`) because the `instance_url` differs per org and CORS is not allowed directly
- The session stores `instanceUrl` and `identityUrl` in addition to tokens
- No server-side logout/revoke — only local session is cleared

#### Direct
- Token endpoint: `<DIRECT_REST_API>/oauth2/token` (default: `https://directdev.feel-on.com/oauth2/token`)
- Must use `prompt=consent` in the authorize URL to receive a `refresh_token`
- Logout calls a real revoke endpoint (`/oauth2/revoke`) server-side via Lambda
- After a failed refresh, session is **cleared automatically** and the user must re-authenticate

#### Microsoft
- Token endpoint: `<MS_LOGIN_URL>/<tenantId>/oauth2/v2.0/token`
- Must include `offline_access` in scopes to receive a `refresh_token`
- Must use `prompt=consent` in the authorize URL to guarantee consent and refresh token issuance
- Logout is **local-only** — to fully sign out on Microsoft's side, redirect to `<MS_LOGIN_URL>/<tenantId>/oauth2/v2.0/logout`
- The `client_secret` is **not required** for the token exchange if using PKCE, but this implementation uses `client_secret` via the Lambda backend

---

### Checklist for Adding a New OAuth Provider

- [ ] Add env vars to `.env` (raw values)
- [ ] Add `define` entries to `vite.config.ts`
- [ ] Add `declare const` entries to `env.d.ts`
- [ ] Add provider config block to `src/config/env.ts`
- [ ] Create `src/services/<provider>OAuth.ts` following the service pattern above
- [ ] Create `src/layout/<Provider>Layout.vue` following the layout pattern above
- [ ] Create `src/views/<provider>/IndexView.vue`
- [ ] Create `src/views/<provider>/OAuthCallbackView.vue` following the callback pattern above
- [ ] Add nested routes to `src/router/index.ts`
- [ ] Create `backend/src/services/<provider>.mjs` with token/refresh/revoke functions
- [ ] Add route handlers to `backend/src/handler.mjs`
- [ ] Add Lambda env vars (`CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, etc.)
- [ ] Register the redirect URI with the OAuth provider's developer console
