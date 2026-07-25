# Smart-Stock Alert — API Reference (Frontend Integration)

Base URL: `VITE_API_URL` — `http://localhost:3000` in dev, **`https://smart-stock-alert-be.vercel.app`** in production (this backend's live Vercel deployment). All routes below are relative to it, e.g. `POST {VITE_API_URL}/api/auth/login`.

Set `CORS_ORIGIN` on the backend to include whichever frontend origin(s) you're calling from (comma-separated if more than one, e.g. the deployed frontend URL plus `http://localhost:5173` for local dev against the deployed backend) — no trailing slash on any origin, or the browser's exact-match CORS check silently fails.

---

## 1. Authentication model — read this first

Auth is cookie-based, not a bearer token you store and attach yourself. Two cookies are set on login and sent automatically by the browser on every same-origin-configured request:

| Cookie | Purpose | Flags |
|---|---|---|
| `sst.token` | The JWT session | `httpOnly`, `Secure` (prod) / not-secure (dev), `SameSite=None` (prod) / `Lax` (dev) |
| `sst.csrf` (`__Host-sst.csrf` in prod) | CSRF double-submit cookie | `httpOnly`, same SameSite/Secure pairing as above |

**Every `fetch` call must include `credentials: 'include'`** or the cookies won't be sent/stored at all:

```js
fetch(`${API_URL}/api/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

### CSRF token — required on every mutating request

`sst.token` alone is not enough to authorize a `POST`/`PUT`/`DELETE`. Login returns a `csrfToken` string in the **response body** (not just a cookie) — store it in memory (a React Query cache entry, module-level variable, wherever — not `localStorage`, no need for persistence since it's re-issued on every login) and send it back as a header on every mutating request:

```js
fetch(`${API_URL}/api/stock-entries`, {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "x-csrf-token": csrfToken,
  },
  body: JSON.stringify({ vaccineId, quantity }),
});
```

`GET` requests never need the CSRF header. If you get a `403` with `{"error": "invalid csrf token"}` on a mutating call, the header is either missing or stale (e.g. from before a fresh login).

### Session lifetime

Tokens expire after **8 hours**. There is no refresh-token flow — when a request comes back `401`, redirect to login. A `401` can also mean the account was deactivated or force-logged-out server-side (`token_version` bump) — treat it the same way as expiry: re-authenticate, don't retry.

---

## 2. Roles and scope — what each role can see/do

Four roles, strictly cascading: `super_admin` → `district_supervisor` → `facility_supervisor` → `facility_worker`. A logged-in user's `role`, `districtId`, and `facilityId` come back in the login response (§4) — use them to drive UI visibility, but **never treat that as the security boundary**; the backend re-checks on every request regardless of what the frontend shows.

| Role | districtId | facilityId | Can see (dashboard) | Can see (audit-log) | Can create |
|---|---|---|---|---|---|
| `super_admin` | `null` | `null` | everything, unscoped | everything, unscoped | **new:** any of `district_supervisor` / `facility_supervisor` / `facility_worker` directly (previously `district_supervisor` only) |
| `district_supervisor` | set | `null` | own district only | own district only | `facility_supervisor` |
| `facility_supervisor` | set | set | own facility only | **own actions + their own `facility_worker`s' actions** | `facility_worker` |
| `facility_worker` | set (see note) | set | own facility only | no access — `403` | nothing |

Vaccines are also scoped, not a shared global list: each facility has its own independent set (see `GET/POST/PUT/DELETE /api/vaccines` below). A `facility_supervisor` manages their own facility's list; `facility_worker` only reads it (to populate the stock-entry form's vaccine dropdown).

**A `facility_supervisor` account is unique per facility, enforced at the database level.** `POST /api/users` (district_supervisor creating a facility_supervisor) and `PUT /api/users/:id/activate` (reactivating one) both return `409 { "error": "Facility already has an active supervisor" }` if the target facility already has a different active supervisor. To replace one, deactivate the old account first.

**A `district_supervisor` account is unique per district, same rule, same enforcement — new.** `POST /api/users` (super_admin creating a district_supervisor) and `PUT /api/users/:id/activate` (reactivating one) both return `409 { "error": "District already has an active supervisor" }` if the target district already has a different active supervisor. To replace one, deactivate the old account first.

**Note on `facility_worker`'s `districtId`:** new accounts get it populated at creation time from the creating `facility_supervisor`'s own district — it is **not** `null` for accounts created after this shipped (a reversal of the original design). Accounts created before that change were backfilled on the shared dev DB; don't assume it's always non-null in code that might run against older/self-hosted data.

---

## 3. Error format

Every non-2xx response is JSON. Shapes vary slightly by cause:

```jsonc
// Generic
{ "error": "Forbidden" }

// Validation failure (400) — from zod, via api/_lib/validate.js
{
  "error": "Validation failed",
  "fields": { /* zod's treeifyError() output — nested, per-field issue tree */ }
}

// Unhandled server error (only in non-production NODE_ENV)
{ "error": "Internal server error", "stack": "..." }
```

Common status codes across all endpoints: `400` (validation or bad reference id), `401` (no/expired/revoked session), `403` (wrong role, wrong scope, or missing/invalid CSRF token), `404` (resource not found), `409` (unique constraint or business-rule conflict, e.g. duplicate email, duplicate district/vaccine name, a facility already has an active supervisor, deleting a facility/district that still has active children), `429` (rate limited).

---

## 4. Endpoints

### `POST /api/auth/login`

Public. Rate-limited: 10 attempts / 15 min / IP. Email is case-insensitive (normalized to lowercase server-side).

**Body:**
```json
{ "email": "user@example.com", "password": "..." }
```

**200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Display Name",
    "role": "super_admin | district_supervisor | facility_supervisor | facility_worker",
    "districtId": "uuid | null",
    "facilityId": "uuid | null"
  },
  "csrfToken": "string — store this, send as x-csrf-token on every mutating request"
}
```
Also sets the `sst.token` and `sst.csrf` cookies.

**401:** `{ "error": "Invalid email or password" }` — same message for a nonexistent email or a wrong password; a deactivated account also gets this (does not distinguish "you don't exist" from "you're deactivated").

---

### `POST /api/auth/logout`

Requires auth + CSRF, same as any other mutating route — send the `x-csrf-token` header. Clears the auth cookie. **204 No Content**, no body. Frontend should also drop its in-memory `csrfToken` and redirect to login.

---

### `POST /api/auth/google` — **new**

Public. Rate-limited: 10 attempts / 15 min / IP — its own budget, separate from every other auth route (`/login`, `/forgot-password`, `/reset-password/:token`). An alternative to `/login`, not a replacement — password login is unchanged and still works. The frontend uses Google Identity Services to obtain a signed Google ID token (client-side, via the "Sign in with Google" button), then POSTs that raw token here. The backend verifies its signature/issuer/audience/expiry server-side against Google's own public keys before trusting anything in it — only the verified `email`/`email_verified` claims are ever read; `name`/`picture` claims are never trusted for anything (this app's own admin-entered `firstName`/`lastName` are the source of truth for display).

**Body:**
```json
{ "idToken": "the raw ID token string from Google's client library" }
```

**200 — identical shape to `/login`'s success response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Display Name",
    "role": "super_admin | district_supervisor | facility_supervisor | facility_worker",
    "districtId": "uuid | null",
    "facilityId": "uuid | null"
  },
  "csrfToken": "string — store this, send as x-csrf-token on every mutating request"
}
```
Also sets the `sst.token` and `sst.csrf` cookies, same as `/login`.

**401 — token invalid, expired, malformed, wrong audience, or Google-side `email_verified` is not `true`:**
```json
{ "error": "Invalid Google credential" }
```

**403 — the token is genuinely valid, but the verified email doesn't match any registered account, or matches one that's deactivated (deliberately the same response for both, matching `/login`'s existing stance of not distinguishing the two):**
```json
{ "error": "Access denied", "code": "NOT_REGISTERED" }
```
Show an "Access Denied" screen on this response — don't retry, don't fall back to password login automatically (the user may not have one meaningfully set up for self-serve use).

**503 — `GOOGLE_CLIENT_ID` isn't configured server-side yet:**
```json
{ "error": "Google sign-in is not configured" }
```
Best-effort, like the mailer env vars — if you see this, fall back to password login; it's not an outage.

---

### `POST /api/auth/forgot-password` — **new**

Public. Rate-limited: 10 attempts / 15 min / IP — its own budget, separate from `/login`'s. Self-serve, so unlike login this must never reveal whether an email is registered: the response is **always identical**, regardless of whether the email is unknown, deactivated, or a real active account.

**Body:**
```json
{ "email": "user@example.com" }
```

**200 — always this exact response, on every outcome:**
```json
{ "message": "If that email is registered, a reset link has been sent." }
```

If (and only if) the email matches an active account, an email is sent containing a link of the form `{FRONTEND_URL}/reset-password?token=<raw-token>`. The token is single-use and expires in 30 minutes. No response ever confirms whether this actually happened — don't build UI that branches on it.

---

### `POST /api/auth/reset-password/:token` — **new**

Public. Same shared rate limit as `forgot-password`. `:token` is the raw value from the emailed link's `token` query param, passed as a URL path segment here (not in the body).

**Body:**
```json
{ "password": "newPassword123" }
```
`password` follows the same rule as every other password field in this API: minimum 8 characters.

**200:**
```json
{ "message": "Password reset. Please log in." }
```
No cookie or `csrfToken` is returned — this does not log the user in. Send them to the login screen.

**400 — invalid, expired, or already-consumed token:**
```json
{ "error": "Invalid or expired token" }
```
Unlike `forgot-password`, this error message *can* be specific — by this point the token is the secret already revealed via email, not an enumeration vector.

**400 — password fails validation:** standard zod error shape (§3).

---

### `GET /api/users`

Requires auth only (no CSRF for GET). `facility_worker` gets `403` — they can't create accounts at all, and have no user-management view.

| Caller | Sees |
|---|---|
| `super_admin` | every user, unscoped |
| `district_supervisor` | users with `districtId` equal to their own **and** `role: facility_supervisor` — i.e. the facility_supervisors they created (not facility_workers two levels down) |
| `facility_supervisor` | users with `facilityId` equal to their own **and** `role: facility_worker` — i.e. the facility_workers they created |

**200:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Display Name",
      "role": "facility_worker",
      "districtId": "uuid | null",
      "districtName": "string | null",
      "facilityId": "uuid",
      "facilityName": "string",
      "phone": "string | null",
      "cnic": "string | null",
      "firstName": "string | null",
      "lastName": "string | null",
      "zmid": "string | null",
      "isActive": true
    }
  ]
}
```
`districtName`/`facilityName` are resolved via a join, not stored on `users` — use them instead of a separate district/facility lookup wherever a user list/table is rendered. `phone`/`cnic` — optional profile fields set at creation. `firstName`/`lastName`/`zmid` — new; `null` for any account created before this round, populated for every new one.

---

### `POST /api/users`

Requires auth + CSRF. Allowed roles: `super_admin`, `district_supervisor`, `facility_supervisor` (each may only create the role(s) below them — see §2's table).

**`super_admin` — new: can now create any of the three roles below it directly**, not just `district_supervisor`. This exists to let super_admin directly provision accounts from client-supplied profiles (name/email/CNIC/phone) without going through the cascade — the frontend only needs to expose the `district_supervisor`-creation path for now.

**Body:**
```jsonc
{
  "email": "new.user@example.com",
  "password": "min 8 characters",
  "firstName": "Jane",     // required, 1-60 chars — replaces the old single `name` field
  "lastName": "Doe",       // required, 1-60 chars
  "zmid": "Z-1001",        // required, 1-60 chars, unique — free-text organization identifier, no format validation beyond non-empty
  "role": "district_supervisor | facility_supervisor | facility_worker", // must be one of the roles the caller may create
  "districtId": "uuid",   // required when caller is super_admin creating a district_supervisor
  "facilityId": "uuid",   // required when caller is super_admin creating a facility_supervisor or facility_worker, or district_supervisor creating a facility_supervisor
  "phone": "03001234567",       // optional, any role
  "cnic": "12345-1234567-1"     // optional, any role
}
```
**Breaking change: `name` is no longer accepted in the request body** — replaced by `firstName`/`lastName`. The server computes and stores `name` as `` `${firstName} ${lastName}` `` (trimmed), so it still appears exactly as before on every response — only the *creation* request shape changed.

`facility_supervisor` creating a `facility_worker`: omit both `districtId` and `facilityId` — they're forced server-side to the caller's own facility and its owning district (unaffected by the super_admin note below — this cascade path is unchanged).

`super_admin` creating a `facility_supervisor` or `facility_worker`: `facilityId` is required and validated as an existing, active facility; `districtId` is derived server-side from that facility's own district, not taken from the body. Since super_admin has no district/facility of its own, this is the one case where `facilityId` is trusted directly from the request — always after that validation, never blindly.

**201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "new.user@example.com",
    "name": "Jane Doe",
    "firstName": "Jane",
    "lastName": "Doe",
    "zmid": "Z-1001",
    "role": "facility_worker",
    "districtId": "uuid",
    "facilityId": "uuid",
    "phone": "string | null",
    "cnic": "string | null",
    "isActive": true
  }
}
```
Same shape on every other user-returning endpoint (`GET /api/users`, deactivate/activate/reset-password).

**Errors:**
- `403` if `role` isn't one of the roles the caller may create
- `400` if `firstName`/`lastName`/`zmid` is missing/empty, a required `districtId`/`facilityId` is missing, references a district/facility outside the caller's own scope (for `district_supervisor`/`facility_supervisor` callers), or references a **soft-deleted** (`isActive: false`) district/facility
- `409 { "error": "Email already in use" }` on a duplicate email
- `409 { "error": "ZMID already in use" }` on a duplicate zmid
- `409 { "error": "Facility already has an active supervisor" }` — creating a `facility_supervisor` for a facility that already has a different active one. Deactivate the existing one first (`PUT /:id/deactivate`) to free up the facility.
- `409 { "error": "District already has an active supervisor" }` — creating a `district_supervisor` for a district that already has a different active one. Deactivate the existing one first (`PUT /:id/deactivate`) to free up the district.

---

### `PUT /api/users/:id/deactivate`

Requires auth + CSRF. Follows the same one-level-down cascade as `POST /api/users`:

| Caller | May target |
|---|---|
| `super_admin` | any user, unscoped |
| `district_supervisor` | a `facility_supervisor` whose `districtId` matches their own |
| `facility_supervisor` | a `facility_worker` whose `facilityId` matches their own |
| `facility_worker` | nobody — `403` at the role-check layer |

A target that exists but is out of the caller's reach (wrong role, or right role but wrong district/facility) gets `403`, same as a caller with no permission at all — the response doesn't distinguish "exists but not yours" from "not allowed."

No body needed (send `{}` or an empty body).

**200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Display Name",
    "role": "facility_worker",
    "districtId": "uuid | null",
    "facilityId": "uuid",
    "phone": "string | null",
    "cnic": "string | null",
    "firstName": "string | null",
    "lastName": "string | null",
    "zmid": "string | null",
    "isActive": false
  }
}
```
Same shape on activate/reset-password below.

Deactivation takes effect immediately — the user's existing session (if any) is invalidated on their very next request, not just on their next login attempt. **404** if the user id doesn't exist.

---

### `PUT /api/users/:id/activate`

Requires auth + CSRF. **Same caller/target rules as `PUT /:id/deactivate` above** — reverses it. No body needed (send `{}` or an empty body).

**200:** same shape as deactivate's response, with `"isActive": true`.

Unlike deactivate/reset-password, this does **not** bump `tokenVersion` — deactivation already bumped it, so any JWT issued before the deactivation stays permanently invalid regardless of reactivation. The user simply logs in again and gets a fresh token matching the current `tokenVersion`.

**Errors:** `404` if the user id doesn't exist. `403` if the target is outside the caller's cascade (same rule as deactivate). `409 { "error": "Facility already has an active supervisor" }` — reactivating a `facility_supervisor` whose facility now has a different active supervisor (e.g. one was created to replace them while they were deactivated). `409 { "error": "District already has an active supervisor" }` — **new** — same case, one level up, for a `district_supervisor`.

---

### `PUT /api/users/:id/reset-password`

Requires auth + CSRF. Same caller/target rules as `PUT /:id/deactivate` above.

**Body:** `{ "password": "min 8 characters" }` — whoever resets it sets the new password directly; communicate it to the user out-of-band. A self-serve, email-based alternative also exists now (`POST /api/auth/forgot-password` / `POST /api/auth/reset-password/:token`, §4 above) — this admin-driven route is for cases where that isn't practical (e.g. the account can't access its own email).

**200:** same shape as deactivate's response, minus the `isActive` field.

Resetting the password also invalidates the user's current session immediately (not just future logins with the old password) — relevant if the reset was prompted by a suspected compromise. **404** if the user id doesn't exist. **400** if the new password is under 8 characters.

---

### `GET /api/districts`

Requires auth only (no CSRF for GET). Allowed roles: `super_admin` (all districts), `district_supervisor` (their own district only — a one-item array). `facility_supervisor`/`facility_worker` get `403`.

**200:**
```json
{
  "districts": [
    {
      "id": "uuid",
      "name": "...",
      "province": "Sindh",
      "isActive": true,
      "createdAt": "ISO 8601",
      "supervisorName": "string | null",
      "supervisorEmail": "string | null"
    }
  ]
}
```
`province` is **new**. `supervisorName`/`supervisorEmail` — both `null` if the district currently has no active `district_supervisor`. A district can have at most one active `district_supervisor` at a time (enforced at the DB level — see §2), so this is never ambiguous.

Includes soft-deleted (`isActive: false`) districts — this list is unfiltered by design so a deleted district can still be found and reactivated.

---

### `POST /api/districts`

Requires auth + CSRF. **`super_admin` only.**

**Body:** `{ "name": "District Name", "province": "Sindh" }` — `province` is **new**, optional, defaults to `"Sindh"` if omitted (every district in the system today is in Sindh; the field exists for when that's no longer true).

**201:** `{ "district": { "id": "uuid", "name": "...", "province": "Sindh", "isActive": true, "createdAt": "ISO 8601" } }`

**409** if the name is already in use (district names are globally unique).

---

### `GET /api/districts/:id` — **new**

Requires auth + CSRF-exempt (GET). **`super_admin` only** — `403` for every other role, including `district_supervisor` (their own `GET /api/dashboard` already gives them everything this would show for their own district).

Drill-down detail: the district plus every facility in it (active **and** inactive — same unfiltered behavior as `GET /api/facilities`) with its own status rollup, plus a district-wide rollup.

**200:**
```json
{
  "district": {
    "id": "uuid",
    "name": "Karachi Central",
    "province": "Sindh",
    "isActive": true,
    "createdAt": "ISO 8601",
    "facilityCount": 6,
    "statusCounts": { "critical": 3, "low": 5, "adequate": 18, "no_data": 2 },
    "facilities": [
      {
        "id": "uuid",
        "name": "AKUH Main Campus",
        "isActive": true,
        "facilitySupervisorId": "uuid | null",
        "facilitySupervisorName": "string | null",
        "facilitySupervisorEmail": "string | null",
        "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 }
      }
    ]
  }
}
```
`facilitySupervisorEmail` is **new**, alongside the existing `facilitySupervisorId`/`facilitySupervisorName` — `null` under the same condition (no active supervisor).
A facility with zero vaccines configured yet still appears in `facilities`, with all-zero `statusCounts` — it isn't silently dropped. `statusCounts` values are `critical`/`low`/`adequate`/`no_data` — see `GET /api/dashboard` below for what each means.

**404** if the district id doesn't exist.

---

### `PUT /api/districts/:id`

Requires auth + CSRF. **`super_admin` only.**

**Body:** `{ "name": "New District Name" }`

**200:** `{ "district": { "id": "uuid", "name": "...", "isActive": true, "createdAt": "ISO 8601" } }`

**403** for any non-super_admin. **404** unknown id. **409** if the new name collides with another district's name.

---

### `DELETE /api/districts/:id`

Requires auth + CSRF. **`super_admin` only.** Soft-delete — sets `isActive: false`, never removes the row (facilities/users FK to it).

**200:** `{ "district": { "id": "uuid", "name": "...", "isActive": false, "createdAt": "ISO 8601" } }`

**409** if the district still has any active facility, or any active user (its own district_supervisor accounts) — clear those first (deactivate the users, soft-delete the facilities), then retry. **403**/**404** as above.

A soft-deleted district's facilities disappear from `GET /api/dashboard` (once each facility itself is also deactivated — deleting a district requires this already), but the district itself still appears in `GET /api/districts` and `GET /api/districts/:id`.

---

### `PUT /api/districts/:id/activate`

Requires auth + CSRF. **`super_admin` only.** Reverses the soft-delete. Same response shape as `DELETE`, with `isActive: true`. **403**/**404** as above.

---

### `GET /api/facilities`

Requires auth only (no CSRF for GET). Allowed roles: `super_admin` (all facilities), `district_supervisor` (facilities within their own district only). `facility_supervisor`/`facility_worker` get `403`.

**200:**
```json
{
  "facilities": [
    {
      "id": "uuid",
      "name": "AKUH Main Campus",
      "districtId": "uuid",
      "unionCouncil": "string | null",
      "town": "string | null",
      "isActive": true,
      "createdAt": "ISO 8601",
      "facilitySupervisorId": "uuid | null",
      "facilitySupervisorName": "string | null"
    }
  ]
}
```
`unionCouncil`/`town` are **new**. `facilitySupervisorId`/`facilitySupervisorName` — both `null` if the facility currently has no active supervisor. A facility can have at most one active `facility_supervisor` at a time (enforced at the DB level — see §2), so this is never ambiguous. Includes soft-deleted (`isActive: false`) facilities — unfiltered by design, same reasoning as `GET /api/districts`.

---

### `POST /api/facilities`

Requires auth + CSRF. Allowed roles: `super_admin`, `district_supervisor`.

**Body:**
```jsonc
{
  "name": "Facility Name",
  "districtId": "uuid",     // required only when caller is super_admin; ignored/forced to caller's own district if caller is district_supervisor
  "unionCouncil": "UC 5",   // new, optional
  "town": "Malir"           // new, optional
}
```

**201:** `{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "unionCouncil": "string | null", "town": "string | null", "isActive": true, "createdAt": "ISO 8601" } }`

Side effect: a fixed default starter set of **13** vaccines is cloned into the new facility as its own independent rows (was 5 — `BCG`, `OPV`, `Pentavalent`, `Measles`, `PCV`; **currently placeholder names `"Vaccine 01"`–`"Vaccine 13"` pending the client's real EPI list — see `api/_lib/defaultVaccines.js`, no response-shape change when that list is swapped in**), each immediately paired with a `thresholds` row left unconfigured (`minQuantity: null`) — this is what `PUT /api/thresholds/:id` (below) will have to edit. No frontend action needed for this; it just means a brand-new facility already has an editable vaccine list and threshold rows out of the box. The `facility_supervisor` can add more / rename these afterward via `POST`/`PUT /api/vaccines` below (restricted to the same 13-name list — see that section), scoped to this facility only.

**400** if (`super_admin` only) `districtId` is missing, unknown, or references a **soft-deleted** district.

---

### `GET /api/facilities/:id` — **new**

Requires auth only (no CSRF for GET). Allowed roles: `super_admin` (any facility), `district_supervisor` (their own district's facilities only — `403` otherwise). `facility_supervisor`/`facility_worker` get `403` — their own `GET /api/dashboard` already covers this for their one facility.

Drill-down detail: facility metadata plus its full vaccine/stock list and a status rollup, in one call — no need to fetch the whole scoped dashboard and filter client-side to one `facilityId`.

**200:**
```json
{
  "facility": {
    "id": "uuid",
    "name": "AKUH Main Campus",
    "districtId": "uuid",
    "districtName": "Karachi Central",
    "unionCouncil": "string | null",
    "town": "string | null",
    "isActive": true,
    "createdAt": "ISO 8601",
    "facilitySupervisorId": "uuid | null",
    "facilitySupervisorName": "string | null",
    "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 },
    "vaccines": [
      {
        "thresholdId": "uuid",
        "facilityId": "uuid",
        "facilityName": "AKUH Main Campus",
        "districtId": "uuid",
        "districtName": "Karachi Central",
        "vaccineId": "uuid",
        "vaccineName": "Vaccine 01",
        "minQuantity": 20,
        "quantity": 8,
        "recordedAt": "ISO 8601 | null",
        "status": "critical | low | adequate | no_data"
      }
    ]
  }
}
```
`vaccines` is the same row shape as `GET /api/dashboard`'s `facilities` array (see below), just scoped to this one facility. No `isActive` filtering on the lookup or the vaccine list — a soft-deleted facility is still fully viewable (matches `GET /api/facilities`'s unfiltered list behavior).

**404** if the facility id doesn't exist. **403** if a `district_supervisor` targets a facility outside their own district.

---

### `PUT /api/facilities/:id`

Requires auth + CSRF. Allowed roles: `super_admin` (any facility), `district_supervisor` (own district only).

**Body:** `{ "name": "New Facility Name" }`

**200:** `{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "unionCouncil": "string | null", "town": "string | null", "isActive": true, "createdAt": "ISO 8601" } }`

**403** if a district_supervisor targets a facility outside their own district. **404** unknown id.

---

### `DELETE /api/facilities/:id`

Requires auth + CSRF. Allowed roles: `super_admin`, `district_supervisor` (own district only). Soft-delete — sets `isActive: false`.

**200:** `{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "unionCouncil": "string | null", "town": "string | null", "isActive": false, "createdAt": "ISO 8601" } }`

**409** if the facility still has any active user (`facility_supervisor` or `facility_worker`) — deactivate them first via `PUT /api/users/:id/deactivate`, then retry. **403**/**404** as above.

A soft-deleted facility **disappears from `GET /api/dashboard`** (it's an operational view — no reason to monitor something deleted) but **still appears in `GET /api/facilities`** and remains fully viewable via `GET /api/facilities/:id` (so it can be found and reactivated, and history/reporting screens aren't missing rows). **Filter any facility picker (e.g. choosing a facility when creating a district_supervisor-scoped user) to `isActive === true`** — the backend will otherwise reject creating a new user against an inactive facility with a `400`, but a picker shouldn't offer it in the first place.

---

### `PUT /api/facilities/:id/activate`

Requires auth + CSRF. Allowed roles: `super_admin`, `district_supervisor` (own district only). Reverses the soft-delete. Same response shape as `DELETE`, with `isActive: true`. **403**/**404** as above.

---

### `GET /api/vaccines`

Requires auth only (no CSRF needed for GET). **Vaccines are facility-scoped, not a shared global list** — every facility has its own independent set of rows, even if two facilities happen to have vaccines with the same name.

| Caller | Sees |
|---|---|
| `super_admin` | every vaccine, unscoped |
| `district_supervisor` | vaccines belonging to any facility in their own district |
| `facility_supervisor` / `facility_worker` | only their own facility's vaccines |

**200:**
```json
{ "vaccines": [{ "id": "uuid", "name": "Vaccine 01", "facilityId": "uuid", "createdAt": "ISO 8601" }, "..."] }
```
Vaccine names are currently placeholders (`"Vaccine 01"`–`"Vaccine 13"`) pending the client's official EPI vaccine list — see `api/_lib/defaultVaccines.js`. Fetch this endpoint for pickers rather than hardcoding names; the values will change but the shape won't.

---

### `POST /api/vaccines`

Requires auth + CSRF. **`facility_supervisor` only.** Adds a vaccine to the caller's own facility — never affects any other facility, even one with a vaccine of the same name (uniqueness is scoped per facility, not global).

**`name` is new: must be one of the 13 default vaccine names** (see `GET /api/vaccines`) — anything else is rejected with the standard zod `400 { "error": "Validation failed", "fields": {...} }` shape, not a custom message. Since every facility already has all 13 auto-provisioned at creation, this endpoint is now mainly for re-adding one after it was deleted via `DELETE /api/vaccines/:id` below.

**Body:**
```jsonc
{ "name": "Vaccine 01", "minQuantity": 0 } // name must be one of the 13 defaults; minQuantity optional, omitted means "not yet configured" (null), an explicit 0 is a deliberate choice — see the threshold type note below
```

**201:**
```json
{ "vaccine": { "id": "uuid", "name": "Vaccine 01", "facilityId": "uuid", "createdAt": "ISO 8601" } }
```

Side effect: a `thresholds` row is provisioned in the same transaction (same reason as `POST /api/facilities` above — `GET /api/dashboard` would otherwise never show this vaccine).

**400** if `name` isn't one of the 13 defaults. **409** if a vaccine with this name already exists **at this facility** (a different facility having the same name is fine — and since every facility starts with all 13, this is the common case for any name you haven't deleted first). **403** for any role other than `facility_supervisor`.

---

### `PUT /api/vaccines/:id`

Requires auth + CSRF. **`facility_supervisor` only**, and only for a vaccine belonging to their own facility. Renames a vaccine. **Same name restriction as `POST` above applies here too.**

**Body:** `{ "name": "Vaccine 02" }` — must be one of the 13 defaults.

**200:** `{ "vaccine": { "id": "uuid", "name": "Vaccine 02", "facilityId": "uuid", "createdAt": "ISO 8601" } }`

**400** if `name` isn't one of the 13 defaults. **404** if the vaccine id doesn't exist. **403** if it exists but belongs to a different facility than the caller's. **409** on a name collision within the same facility.

---

### `DELETE /api/vaccines/:id` — **new**

Requires auth + CSRF. **`facility_supervisor` only**, and only for a vaccine belonging to their own facility. Real hard delete — the row is actually removed.

**204 No Content** on success, no body.

**409 `{ "error": "Cannot delete a vaccine with recorded stock history" }`** if any `stock_entries` row (received/used/adjustment/legacy) has ever been recorded against it — stock history is append-only, so a vaccine that's ever had activity can't be removed, only left alone. There's no way to force it from the frontend; the `409` is authoritative — only offer a delete action for vaccines with no stock activity yet.

**403** if it belongs to another facility. **404** if unknown.

---

### `PUT /api/vaccines/:id/stock` — **new** ("edit current stock")

Requires auth + CSRF. **`facility_supervisor` only**, and only for a vaccine belonging to their own facility. `stock_entries` can never be updated directly (append-only, enforced at both the app level and the DB grant level) — this inserts a new correction row instead, computed as the delta between what you send and the live balance.

**Body — the NEW total, not a delta:**
```json
{ "quantity": 47 }
```

**200 — correction applied:**
```json
{
  "vaccineId": "uuid",
  "balance": 47,
  "entry": {
    "id": "uuid",
    "facilityId": "uuid",
    "vaccineId": "uuid",
    "quantity": 12,
    "entryType": "adjustment_increase | adjustment_decrease",
    "recordedBy": "uuid",
    "createdAt": "ISO 8601"
  }
}
```

**200 — submitted quantity equals the current balance (no-op, `entry` key omitted):**
```json
{ "vaccineId": "uuid", "balance": 47 }
```

`entryType` is one of two new values (`adjustment_increase`/`adjustment_decrease`) alongside the existing `received`/`used`/`legacy` — if you render/label `entryType` anywhere (e.g. the audit log), handle these two as well, probably as "Stock correction (+)" / "Stock correction (−)". `quantity` in the body must be a non-negative integer (same validation as everywhere else stock quantities appear). `403` cross-facility, `404` unknown vaccine.

This also means `GET /api/dashboard`'s `quantity` and any insufficient-stock check now factor in corrections automatically — nothing else to change there.

---

### `POST /api/stock-entries`

Requires auth + CSRF. Allowed roles: `facility_supervisor`, `facility_worker`. **Append-only** — there is no update/delete endpoint for this resource, ever (`PUT /api/vaccines/:id/stock` above is a *correction*, i.e. a new row, not an edit of an existing one).

**`facility_worker`'s type is still fully derived from role, not sent by the client — always `"used"`, regardless of body content.** **`facility_supervisor` — new: now chooses between `"received"` and `"returned"`** via an optional `entryType` field, instead of always being forced to `"received"`. Both add to the balance. Any value outside `{"received", "returned"}` (e.g. `"used"`, which is worker-only) is rejected with `400` at validation — not silently downgraded to `"received"` the way an unrecognized field used to be silently stripped.

| Caller | `entryType` in body | Recorded as | Effect on balance |
|---|---|---|---|
| `facility_supervisor` | omitted | `"received"` (default, backward-compatible) | adds |
| `facility_supervisor` | `"received"` | `"received"` | adds |
| `facility_supervisor` | `"returned"` | `"returned"` | adds |
| `facility_supervisor` | anything else | — | `400`, rejected |
| `facility_worker` | anything or omitted | `"used"` (always, body ignored) | subtracts |

Current stock (`GET /api/dashboard`'s `quantity` field) is a running balance — `SUM(received) + SUM(returned) + SUM(adjustment_increase) − SUM(used) − SUM(adjustment_decrease)` for that facility/vaccine — not "the latest entry."

**New: a `"received"` entry requires five additional fields; `"returned"` needs none of them.**

**Body — received:**
```jsonc
{
  "vaccineId": "uuid",
  "quantity": 50,
  "batchNo": "B-2026-001",      // new, required for received
  "expiryDate": "2027-06-30",   // new, required for received — plain date string (varchar), not a timestamp; reference metadata only, no FEFO/depletion logic reads it
  "dosesPerVial": 10,           // new, required for received — positive integer
  "manufacturer": "Manufacturer Name", // new, required for received
  "remarks": "outreach"         // new, required for received — exactly "outreach" or "fixed", nothing else
}
```

**Body — returned:**
```json
{ "vaccineId": "uuid", "quantity": 5, "entryType": "returned" }
```

`quantity` must be a non-negative integer. `facilityId` is never part of the request — it's always the caller's own facility, forced server-side. `vaccineId` must belong to the caller's own facility (vaccines are facility-scoped — see `GET /api/vaccines` above).

**201:**
```json
{
  "entry": {
    "id": "uuid",
    "facilityId": "uuid",
    "vaccineId": "uuid",
    "quantity": 50,
    "entryType": "received | returned | used",
    "recordedBy": "uuid — the submitting user's id",
    "batchNo": "string | null",
    "expiryDate": "string | null",
    "dosesPerVial": "number | null",
    "manufacturer": "string | null",
    "remarks": "string | null",
    "createdAt": "ISO 8601"
  }
}
```
The five new fields are `null` for `used`/`returned` entries, populated for `received`.

**400** if: `quantity` is negative or not an integer; `vaccineId` isn't a valid UUID or doesn't belong to the caller's own facility; `entryType` is present but not one of the values the caller's role may use; a `received` entry (explicit or defaulted) is missing one or more of `batchNo`/`expiryDate`/`dosesPerVial`/`manufacturer`/`remarks` (message: `"batchNo, expiryDate, dosesPerVial, manufacturer, and remarks are required for a received entry"`); **or** (`facility_worker` only) the `quantity` would drive the facility's stock below zero for that vaccine — the response includes the currently available amount:
```json
{ "error": "Insufficient stock", "available": 12 }
```
The frontend should use this to show "only 12 left" rather than a generic error — this check is authoritative server-side; a client-side pre-check is a UX nicety only, never sufficient alone.

**New backend side effect, no response-shape change:** if this entry (from either role) drops the facility/vaccine's balance below its configured threshold (status flips to `critical`), the backend automatically emails the facility's own supervisor(s), the owning district's supervisor, and every super_admin — once per critical episode, not on every subsequent entry while it stays critical (it fires again only after a later entry brings the balance back to `adequate`/`low` and it drops into `critical` again). Nothing about this is visible in the `201` response. The one observable effect: the specific request that first crosses into `critical` takes noticeably longer to respond, since it waits on a real outbound email send before returning — every other request responds at normal speed.

---

### `PUT /api/thresholds/:id`

Requires auth + CSRF. **`facility_supervisor` only**, and only for a threshold row belonging to their own facility. The `:id` is a threshold row's own id — use a row's `thresholdId` from `GET /api/dashboard` or `GET /api/facilities/:id` (both below), not a facility or vaccine id.

**Body:** `{ "minQuantity": 0 }` (non-negative integer)

**200:**
```json
{
  "threshold": {
    "id": "uuid",
    "facilityId": "uuid",
    "vaccineId": "uuid",
    "minQuantity": 20,
    "updatedAt": "ISO 8601"
  }
}
```

**404** if the threshold id doesn't exist. **403** if it exists but belongs to a different facility than the caller's.

---

### `GET /api/dashboard`

Requires auth only (no CSRF for GET). All four roles may call this — scope differs per role (§2), enforced server-side regardless of what's requested. This is the endpoint the frontend should poll (15–30s `refetchInterval` via TanStack Query, per the architecture doc) for "live" updates.

**200:**
```json
{
  "facilities": [
    {
      "thresholdId": "uuid",         // pass this to PUT /api/thresholds/:id
      "facilityId": "uuid",
      "facilityName": "AKUH Main Campus",
      "districtId": "uuid",
      "districtName": "Karachi Central",
      "unionCouncil": "string | null", // the facility's own profile field, same as GET /api/facilities
      "town": "string | null",
      "vaccineId": "uuid",
      "vaccineName": "Vaccine 01",
      "minQuantity": 20,            // null if a supervisor has never configured this threshold — see status note below
      "quantity": 15,               // running balance; null if no stock entry has ever been recorded for this pair
      "recordedAt": "ISO 8601 | null", // most recent stock-entry timestamp contributing to this pair, if any
      "status": "critical | low | adequate | no_data"
    }
    // one row per (facility, vaccine) pair in scope
  ],
  "summary": {
    "districtCount": 1,
    "facilityCount": 6,
    "statusCounts": { "critical": 3, "low": 5, "adequate": 18, "no_data": 2 },
    "byFacility": [
      {
        "facilityId": "uuid",
        "facilityName": "AKUH Main Campus",
        "districtId": "uuid",
        "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 }
      }
    ]
  }
}
```

**`status` values changed — breaking change if you render these literally.** Was `red`/`amber`/`green`/`no_data`; now `critical`/`low`/`adequate`/`no_data` — domain vocabulary instead of a color, so the frontend owns the color mapping instead of the backend baking one in. Banding logic: `no_data` if `quantity` is `null` (no stock entry ever recorded) **or** `minQuantity` is `null` (threshold never configured — this is the default state for every newly-provisioned facility/vaccine pair, until a `facility_supervisor` sets a real value via `PUT /api/thresholds/:id`); otherwise `critical` if `quantity < minQuantity`, `low` if `quantity < minQuantity * 1.2`, else `adequate`. An explicitly-set `minQuantity` of `0` is a deliberate choice (distinct from the unconfigured `null` default) and is evaluated normally — since `quantity` can never be negative, it always reports `adequate`.

**`summary` is new — additive, doesn't change the existing `facilities` array.** Derived from the same rows already returned, no extra request needed:
- `districtCount` / `facilityCount`: distinct counts across rows in scope. For a `district_supervisor` this is always `districtCount: 1` (their own district). A facility with zero vaccines configured yet contributes no rows and so isn't counted in `facilityCount` here — use `GET /api/districts/:id` or `GET /api/facilities/:id` if you need a facility to show up even with nothing configured.
- `statusCounts`: tally of every row's `status`, scoped the same way `facilities` is.
- `byFacility`: per-facility rollup — use this to show "which facility has low/critical stock" at a glance, without re-deriving it client-side from the flat `facilities` array.

`super_admin` gets rows across every facility/district. `district_supervisor` gets rows only for facilities in their own district. `facility_supervisor`/`facility_worker` get rows only for their own single facility — this is enforced before the query runs, not filtered after, so there's no way to widen scope via request params (there are none to manipulate — scope is entirely derived from the session). A soft-deleted (`isActive: false`) facility never appears here, even to `super_admin`.

---

### `GET /api/audit-log`

Requires auth only (no CSRF for GET). Allowed roles: `super_admin` (unscoped — every row), `district_supervisor` (only rows tagged with their own district), **`facility_supervisor`** (rows whose actor is facility-level staff at their own facility — themselves or one of their own `facility_worker`s; a district_supervisor's own upstream actions on their facility, e.g. `CREATE_FACILITY`, are still excluded even though those rows carry the same facilityId). `facility_worker` gets `403` — no access to this endpoint at all, denied before any query runs.

**Optional `?limit=N` query param — new.** Caps the response to the `N` most recent rows (already ordered newest-first) instead of returning the whole scoped log. Applies identically across all three allowed roles' scoping — it only caps row count, never widens what's visible. `N` must be a positive integer, max `500`; anything else (`0`, negative, non-numeric) returns:
```json
// 400
{ "error": "Validation failed", "fields": { /* zod issue tree */ } }
```
Omit `limit` entirely to keep the previous unlimited behavior.

**200:**
```json
{
  "auditLog": [
    {
      "id": "uuid",
      "actorId": "uuid",
      "actorName": "string",
      "actorRole": "super_admin | district_supervisor | facility_supervisor | facility_worker",
      "action": "CREATE_USER | DEACTIVATE_USER | ACTIVATE_USER | RESET_PASSWORD | CREATE_DISTRICT | EDIT_DISTRICT | DEACTIVATE_DISTRICT | ACTIVATE_DISTRICT | CREATE_FACILITY | EDIT_FACILITY | DEACTIVATE_FACILITY | ACTIVATE_FACILITY | CREATE_VACCINE | EDIT_VACCINE | DELETE_VACCINE | ADJUST_STOCK | STOCK_ENTRY | SET_THRESHOLD",
      "entityType": "user | district | facility | vaccine | stock_entry | threshold",
      "entityId": "uuid | null",
      "districtId": "uuid | null",
      "districtName": "string | null",
      "facilityId": "uuid | null",
      "facilityName": "string | null",
      "details": { "...": "action-specific — see below" },
      "createdAt": "ISO 8601"
    }
    // newest first
  ]
}
```

`actorName`/`actorRole` reflect the actor's *current* name/role (there's no role-change endpoint, so this is effectively historical too). `districtName`/`facilityName` are resolved from the row's own `districtId`/`facilityId` — the event's owning district/facility, not necessarily the actor's own — so a row can have a `facilityName` even for an action recorded by a `district_supervisor`, and `facilityName` is `null` for district-level actions like `CREATE_DISTRICT`.

**`details` shape by action:**
| Action | `details` |
|---|---|
| `CREATE_USER` | `{ "role": "...", "email": "..." }` |
| `DEACTIVATE_USER` / `ACTIVATE_USER` / `RESET_PASSWORD` | `{ "email": "...", "name": "..." }` — the affected user's own email/name |
| `CREATE_DISTRICT` / `EDIT_DISTRICT` / `DEACTIVATE_DISTRICT` / `ACTIVATE_DISTRICT` | `{ "name": "..." }` |
| `CREATE_FACILITY` / `EDIT_FACILITY` / `DEACTIVATE_FACILITY` / `ACTIVATE_FACILITY` | `{ "name": "..." }` |
| `CREATE_VACCINE` / `EDIT_VACCINE` / `DELETE_VACCINE` | `{ "name": "..." }` |
| `STOCK_ENTRY` | `{ "vaccineId": "uuid", "vaccineName": "...", "quantity": 0, "entryType": "received \| used" }` |
| `ADJUST_STOCK` | `{ "vaccineId": "uuid", "vaccineName": "...", "previousBalance": 0, "newBalance": 0, "delta": 0 }` |
| `SET_THRESHOLD` | `{ "vaccineId": "uuid", "minQuantity": 0 }` |

For a `facility_supervisor`'s view specifically: this includes their own writes (e.g. their own `"received"` `STOCK_ENTRY` rows, their own `ADJUST_STOCK`/vaccine-management actions) alongside their workers' `"used"` entries.

---

### `GET /api/health`

Public, unauthenticated. `{ "status": "ok" }` — not part of the app's data API, just a liveness check.

---

## 5. Data model quick reference

| Field | Type | Notes |
|---|---|---|
| `role` | enum | `super_admin`, `district_supervisor`, `facility_supervisor`, `facility_worker` |
| `entryType` | enum | `received` (facility_supervisor, adds), `returned` (facility_supervisor, adds — new), `used` (facility_worker, subtracts), `adjustment_increase`/`adjustment_decrease` (facility_supervisor, via `PUT /api/vaccines/:id/stock`) — never sent unchecked by the client: `facility_worker` is hardcoded server-side regardless of body content, `facility_supervisor` may choose `received`/`returned` via the body but nothing outside that pair. A sixth value, `legacy`, only appears on stock entries created before this field existed and never on anything new. |
| `status` (dashboard/detail row) | enum | `critical`, `low`, `adequate`, `no_data` — see `GET /api/dashboard` |
| `isActive` (district/facility/user) | boolean | Soft-delete flag. `false` means deactivated/deleted but the row still exists for history — filter to `true` in any picker, but don't assume `GET` list endpoints filter it for you (they mostly don't, by design — see each endpoint above). |
| any `*Id` field | UUID string | or `null` where noted above |
| any `*At` field | ISO 8601 timestamp string | UTC |
| `quantity` (stock entry) | non-negative integer | the magnitude of one received/returned/used/adjustment movement, not a running total — see `POST /api/stock-entries` and `PUT /api/vaccines/:id/stock` |
| `quantity` (dashboard/detail row) | non-negative integer, or `null` | dashboard `quantity` is a computed running balance, not stored directly; `null` means no stock entry has ever been recorded for this pair |
| `minQuantity` | non-negative integer, or `null` | `null` means this threshold has never been configured (the default for every newly-provisioned facility/vaccine pair) — distinct from an explicit `0`, which is a deliberate supervisor choice |
| `statusCounts` | object | `{ critical, low, adequate, no_data }`, each a non-negative integer count — appears in `GET /api/dashboard`'s `summary`, `GET /api/facilities/:id`, and `GET /api/districts/:id` |
| `province` (district) | string | new — defaults to `"Sindh"` if omitted at creation |
| `unionCouncil`, `town` (facility) | string, or `null` | new — both optional, no validation beyond non-empty/length |
| `phone`, `cnic` (user) | string, or `null` | new — both optional, no validation beyond non-empty/length, on every role |
| `batchNo`, `manufacturer`, `remarks` (stock entry) | string, or `null` | new — `remarks` is a fixed two-value enum (`"outreach"` \| `"fixed"`), the other two are free text. All `null` unless `entryType` is `received` |
| `expiryDate` (stock entry) | string (`YYYY-MM-DD`), or `null` | new — plain date string, not a timestamp. Reference metadata only: doesn't affect the balance, no FEFO/depletion logic. `null` unless `entryType` is `received` |
| `dosesPerVial` (stock entry) | positive integer, or `null` | new — `null` unless `entryType` is `received` |

`password_hash` and `tokenVersion` are internal-only and never appear in any API response.
