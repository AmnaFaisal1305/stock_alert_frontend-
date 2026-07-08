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

Four roles, strictly cascading: `super_admin` → `district_supervisor` → `facility_supervisor` → `facility_worker`. A logged-in user's `role`, `districtId`, and `facilityId` come back in the login response (§3) — use them to drive UI visibility, but **never treat that as the security boundary**; the backend re-checks on every request regardless of what the frontend shows.

| Role | districtId | facilityId | Can see (dashboard) | Can see (audit-log) | Can create |
|---|---|---|---|---|---|
| `super_admin` | `null` | `null` | everything, unscoped | everything, unscoped | `district_supervisor` |
| `district_supervisor` | set | `null` | own district only | own district only | `facility_supervisor` |
| `facility_supervisor` | set | set | own facility only | **own actions + their own `facility_worker`s' actions** | `facility_worker` |
| `facility_worker` | `null` | set | own facility only | no access — `403` | nothing |

Vaccines are also scoped, not a shared global list: each facility has its own independent set (see `GET/POST/PUT /api/vaccines` below). A `facility_supervisor` manages their own facility's list; `facility_worker` only reads it (to populate the stock-entry form's vaccine dropdown).

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

Common status codes across all endpoints: `400` (validation or bad reference id), `401` (no/expired/revoked session), `403` (wrong role, wrong scope, or missing/invalid CSRF token), `404` (resource not found), `409` (unique constraint, e.g. duplicate email), `429` (rate limited).

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

### `GET /api/users`

Requires auth only (no CSRF for GET). Not part of the original locked spec — added so each role that can create an account has a way to see the accounts already in their own scope (and, for `super_admin`, to discover a target user's `id` for the unscoped `PUT /:id/deactivate`/`PUT /:id/reset-password` below). `facility_worker` gets `403` — they can't create accounts at all.

| Caller | Sees |
|---|---|
| `super_admin` | every user, unscoped |
| `district_supervisor` | users with `districtId` equal to their own — i.e. the `facility_supervisor`s they created (**not** `facility_worker`s two levels down — those carry `districtId: null` by design, Section 10) |
| `facility_supervisor` | users with `facilityId` equal to their own — i.e. the `facility_worker`s they created |

**200:**
```json
{
  "users": [
    { "id": "uuid", "email": "user@example.com", "name": "Display Name", "role": "facility_worker", "districtId": null, "facilityId": "uuid", "isActive": true }
  ]
}
```

---

### `POST /api/users`

Requires auth + CSRF. Allowed roles: `super_admin`, `district_supervisor`, `facility_supervisor` (each may only create the one role below them — see §2's table).

**Body:**
```jsonc
{
  "email": "new.user@example.com",
  "password": "min 8 characters",
  "name": "Display Name", // required, 1-120 chars — a plain display name, not validated for uniqueness
  "role": "district_supervisor | facility_supervisor | facility_worker", // must match exactly what the caller may create
  "districtId": "uuid",   // required only when caller is super_admin creating a district_supervisor
  "facilityId": "uuid"    // required only when caller is district_supervisor creating a facility_supervisor
}
```
`facility_supervisor` creating a `facility_worker`: omit both `districtId` and `facilityId` — they're forced server-side to the caller's own facility (and `districtId` stays `null` on the new user).

**201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "new.user@example.com",
    "name": "Display Name",
    "role": "facility_worker",
    "districtId": null,
    "facilityId": "uuid"
  }
}
```

**Errors:** `403` if `role` doesn't match what the caller may create; `400` if `name` is missing/empty, or a required `districtId`/`facilityId` is missing, or references a district/facility outside the caller's own scope (e.g. a `district_supervisor` naming a facility in another district); `409` if the email is already in use.

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
    "districtId": null,
    "facilityId": "uuid",
    "isActive": false
  }
}
```

Deactivation takes effect immediately — the user's existing session (if any) is invalidated on their very next request, not just on their next login attempt. **404** if the user id doesn't exist.

---

### `PUT /api/users/:id/activate`

Requires auth + CSRF. **Same caller/target rules as `PUT /:id/deactivate` above** — reverses it. No body needed (send `{}` or an empty body).

**200:** same shape as deactivate's response, with `"isActive": true`.

Unlike deactivate/reset-password, this does **not** bump `tokenVersion` — deactivation already bumped it, so any JWT issued before the deactivation stays permanently invalid regardless of reactivation. The user simply logs in again and gets a fresh token matching the current `tokenVersion`. **404** if the user id doesn't exist. **403** if the target is outside the caller's cascade (same rule as deactivate).

---

### `PUT /api/users/:id/reset-password`

Requires auth + CSRF. Same caller/target rules as `PUT /:id/deactivate` above.

**Body:** `{ "password": "min 8 characters" }` — whoever resets it sets the new password directly (there is no email-based reset flow in this system); communicate it to the user out-of-band.

**200:** same shape as deactivate's response, minus the `isActive` field.

Resetting the password also invalidates the user's current session immediately (not just future logins with the old password) — relevant if the reset was prompted by a suspected compromise. **404** if the user id doesn't exist. **400** if the new password is under 8 characters.

---

### `GET /api/districts`

Requires auth only (no CSRF for GET). Allowed roles: `super_admin` (all districts), `district_supervisor` (their own district only — a one-item array). `facility_supervisor`/`facility_worker` get `403`. Not part of the original locked spec — added to support a district picker in facility-creation UI.

**200:** `{ "districts": [{ "id": "uuid", "name": "...", "createdAt": "ISO 8601" }] }`

---

### `POST /api/districts`

Requires auth + CSRF. **`super_admin` only.**

**Body:** `{ "name": "District Name" }`

**201:** `{ "district": { "id": "uuid", "name": "...", "createdAt": "ISO 8601" } }`

**409** if the name is already in use.

---

### `GET /api/facilities`

Requires auth only (no CSRF for GET). Allowed roles: `super_admin` (all facilities), `district_supervisor` (facilities within their own district only). `facility_supervisor`/`facility_worker` get `403`. Not part of the original locked spec — added to support a facility picker when a `district_supervisor` creates a `facility_supervisor` account.

**200:** `{ "facilities": [{ "id": "uuid", "name": "...", "districtId": "uuid", "createdAt": "ISO 8601" }] }`

---

### `POST /api/facilities`

Requires auth + CSRF. Allowed roles: `super_admin`, `district_supervisor`.

**Body:**
```jsonc
{
  "name": "Facility Name",
  "districtId": "uuid" // required only when caller is super_admin; ignored/forced to caller's own district if caller is district_supervisor
}
```

**201:** `{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "createdAt": "ISO 8601" } }`

Side effect: a fixed default starter set of vaccines (BCG, OPV, Pentavalent, Measles, PCV) is cloned into the new facility as its own independent rows, each immediately paired with a `thresholds` row defaulted to `minQuantity: 0` — this is what `PUT /api/thresholds/:id` (below) will have to edit. No frontend action needed for this; it just means a brand-new facility already has an editable vaccine list and threshold rows out of the box. The `facility_supervisor` can add more / rename these afterward via `POST`/`PUT /api/vaccines` below — changes are scoped to this facility only.

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
{ "vaccines": [{ "id": "uuid", "name": "BCG", "facilityId": "uuid", "createdAt": "ISO 8601" }, "..."] }
```

---

### `POST /api/vaccines`

Requires auth + CSRF. **`facility_supervisor` only.** Adds a new vaccine to the caller's own facility — never affects any other facility, even one with a vaccine of the same name (uniqueness is scoped per facility, not global).

**Body:**
```jsonc
{ "name": "Rotavirus", "minQuantity": 0 } // minQuantity optional, defaults to 0
```

**201:**
```json
{ "vaccine": { "id": "uuid", "name": "Rotavirus", "facilityId": "uuid", "createdAt": "ISO 8601" } }
```

Side effect: a `thresholds` row is provisioned in the same transaction (same reason as `POST /api/facilities` above — `GET /api/dashboard` would otherwise never show this vaccine).

**409** if a vaccine with this name already exists **at this facility** (a different facility having the same name is fine). **403** for any role other than `facility_supervisor`.

---

### `PUT /api/vaccines/:id`

Requires auth + CSRF. **`facility_supervisor` only**, and only for a vaccine belonging to their own facility. Renames a vaccine.

**Body:** `{ "name": "New Name" }`

**200:** `{ "vaccine": { "id": "uuid", "name": "New Name", "facilityId": "uuid", "createdAt": "ISO 8601" } }`

**404** if the vaccine id doesn't exist. **403** if it exists but belongs to a different facility than the caller's. **409** on a name collision within the same facility.

---

### `POST /api/stock-entries`

Requires auth + CSRF. Allowed roles: `facility_supervisor`, `facility_worker`. **Append-only** — there is no update/delete endpoint for this resource, ever; a mistaken entry is corrected by submitting a new one, not editing the old one.

**The type of movement is derived from the caller's role, not sent by the client:**

| Caller | Recorded as | Effect on the facility's balance |
|---|---|---|
| `facility_supervisor` | `"received"` | adds |
| `facility_worker` | `"used"` | subtracts |

Current stock (`GET /api/dashboard`'s `quantity` field) is a running balance — `SUM(received) − SUM(used)` for that facility/vaccine — not "the latest entry." Don't send an `entryType` field in the body; it's ignored even if present.

**Body:**
```json
{ "vaccineId": "uuid", "quantity": 0 }
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
    "entryType": "received | used",
    "recordedBy": "uuid — the submitting user's id",
    "createdAt": "ISO 8601"
  }
}
```

**400** if: `quantity` is negative or not an integer; `vaccineId` isn't a valid UUID or doesn't belong to the caller's own facility; **or** (`facility_worker` only) the `quantity` would drive the facility's stock below zero for that vaccine — the response includes the currently available amount:
```json
{ "error": "Insufficient stock", "available": 12 }
```
The frontend should use this to show "only 12 left" rather than a generic error — this check is authoritative server-side; a client-side pre-check is a UX nicety only, never sufficient alone.

---

### `PUT /api/thresholds/:id`

Requires auth + CSRF. **`facility_supervisor` only**, and only for a threshold row belonging to their own facility. The `:id` is a threshold row's own id — use a row's `thresholdId` from `GET /api/dashboard` (below), not a facility or vaccine id.

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
      "vaccineId": "uuid",
      "vaccineName": "BCG",
      "minQuantity": 20,
      "quantity": 15,               // running balance: SUM(received) - SUM(used); null if no stock entry has ever been recorded for this pair
      "recordedAt": "ISO 8601 | null", // most recent stock-entry timestamp contributing to this pair, if any
      "status": "red | amber | green | no_data"
    }
    // one row per (facility, vaccine) pair in scope
  ]
}
```

`quantity` used to be "the latest entry's value"; it's now a running balance (received adds, used subtracts) — see `POST /api/stock-entries` above. `districtName` is new — use it (with `facilityName`) to show a `facility_supervisor`/`facility_worker` which facility and district they're part of.

**Status banding** (placeholder, pending real product input — see `docs/repository-guide.md` §8): `no_data` if `quantity` is null, `red` if `quantity < minQuantity`, `amber` if `quantity < minQuantity * 1.2`, else `green`.

`super_admin` gets rows across every facility/district. `district_supervisor` gets rows only for facilities in their own district. `facility_supervisor`/`facility_worker` get rows only for their own single facility — this is enforced before the query runs, not filtered after, so there's no way to widen scope via request params (there are none to manipulate — scope is entirely derived from the session).

---

### `GET /api/audit-log`

Requires auth only (no CSRF for GET). Allowed roles: `super_admin` (unscoped — every row), `district_supervisor` (only rows tagged with their own district), **`facility_supervisor`** (rows whose actor is facility-level staff at their own facility — themselves or one of their own `facility_worker`s; a district_supervisor's own upstream actions on their facility, e.g. `CREATE_FACILITY`, are still excluded even though those rows carry the same facilityId). `facility_worker` gets `403` — no access to this endpoint at all, denied before any query runs.

**200:**
```json
{
  "auditLog": [
    {
      "id": "uuid",
      "actorId": "uuid",
      "actorName": "string",
      "actorRole": "super_admin | district_supervisor | facility_supervisor | facility_worker",
      "action": "CREATE_USER | CREATE_DISTRICT | CREATE_FACILITY | CREATE_VACCINE | EDIT_VACCINE | STOCK_ENTRY | SET_THRESHOLD",
      "entityType": "user | district | facility | vaccine | stock_entry | threshold",
      "entityId": "uuid | null",
      "districtId": "uuid | null",
      "districtName": "string | null",
      "facilityId": "uuid | null",
      "facilityName": "string | null",
      "details": { "...": "action-specific, e.g. { role, email } for CREATE_USER, or { vaccineId, quantity, entryType } for STOCK_ENTRY" },
      "createdAt": "ISO 8601"
    }
    // newest first
  ]
}
```

`actorName`/`actorRole` reflect the actor's *current* name/role (there's no role-change endpoint, so this is effectively historical too). `districtName`/`facilityName` are resolved from the row's own `districtId`/`facilityId` — the event's owning district/facility, not necessarily the actor's own — so a row can have a `facilityName` even for an action recorded by a `district_supervisor`, and `facilityName` is `null` for district-level actions like `CREATE_DISTRICT`.

For a `facility_supervisor`'s view specifically: this now includes their own writes (e.g. their own `"received"` `STOCK_ENTRY` rows) alongside their workers' `"used"` entries — previously their own actions were filtered out.

---

### `GET /api/health`

Public, unauthenticated. `{ "status": "ok" }` — not part of the app's data API, just a liveness check.

---

## 5. Data model quick reference

| Field | Type | Notes |
|---|---|---|
| `role` | enum | `super_admin`, `district_supervisor`, `facility_supervisor`, `facility_worker` |
| `entryType` | enum | `received` (facility_supervisor, adds) or `used` (facility_worker, subtracts) — never sent by the client, always derived from the caller's role. A third value, `legacy`, only appears on stock entries created before this field existed and never on anything new. |
| any `*Id` field | UUID string | or `null` where noted above |
| any `*At` field | ISO 8601 timestamp string | UTC |
| `quantity` (stock entry) | non-negative integer | the magnitude of one received/used movement, not a running total — see `POST /api/stock-entries` |
| `quantity` (dashboard row), `minQuantity` | non-negative integer, or `null` for dashboard `quantity` | dashboard `quantity` is a computed running balance, not stored directly |

`password_hash` and `tokenVersion` are internal-only and never appear in any API response.
