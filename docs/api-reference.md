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
| `super_admin` | `null` | `null` | everything, unscoped | everything, unscoped | `district_supervisor` |
| `district_supervisor` | set | `null` | own district only | own district only | `facility_supervisor` |
| `facility_supervisor` | set | set | own facility only | **own actions + their own `facility_worker`s' actions** | `facility_worker` |
| `facility_worker` | set (see note) | set | own facility only | no access — `403` | nothing |

Vaccines are also scoped, not a shared global list: each facility has its own independent set (see `GET/POST/PUT/DELETE /api/vaccines` below). A `facility_supervisor` manages their own facility's list; `facility_worker` only reads it (to populate the stock-entry form's vaccine dropdown).

**A `facility_supervisor` account is unique per facility, enforced at the database level.** `POST /api/users` (district_supervisor creating a facility_supervisor) and `PUT /api/users/:id/activate` (reactivating one) both return `409 { "error": "Facility already has an active supervisor" }` if the target facility already has a different active supervisor. To replace one, deactivate the old account first.

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
      "isActive": true
    }
  ]
}
```
`districtName`/`facilityName` are resolved via a join, not stored on `users` — use them instead of a separate district/facility lookup wherever a user list/table is rendered.

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
`facility_supervisor` creating a `facility_worker`: omit both `districtId` and `facilityId` — they're forced server-side to the caller's own facility and its owning district.

**201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "new.user@example.com",
    "name": "Display Name",
    "role": "facility_worker",
    "districtId": "uuid",
    "facilityId": "uuid",
    "isActive": true
  }
}
```

**Errors:**
- `403` if `role` doesn't match what the caller may create
- `400` if `name` is missing/empty, a required `districtId`/`facilityId` is missing, references a district/facility outside the caller's own scope, or references a **soft-deleted** (`isActive: false`) district/facility
- `409 { "error": "Email already in use" }` on a duplicate email
- `409 { "error": "Facility already has an active supervisor" }` — **new** — creating a `facility_supervisor` for a facility that already has a different active one. Deactivate the existing one first (`PUT /:id/deactivate`) to free up the facility.

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
    "isActive": false
  }
}
```

Deactivation takes effect immediately — the user's existing session (if any) is invalidated on their very next request, not just on their next login attempt. **404** if the user id doesn't exist.

---

### `PUT /api/users/:id/activate`

Requires auth + CSRF. **Same caller/target rules as `PUT /:id/deactivate` above** — reverses it. No body needed (send `{}` or an empty body).

**200:** same shape as deactivate's response, with `"isActive": true`.

Unlike deactivate/reset-password, this does **not** bump `tokenVersion` — deactivation already bumped it, so any JWT issued before the deactivation stays permanently invalid regardless of reactivation. The user simply logs in again and gets a fresh token matching the current `tokenVersion`.

**Errors:** `404` if the user id doesn't exist. `403` if the target is outside the caller's cascade (same rule as deactivate). `409 { "error": "Facility already has an active supervisor" }` — **new** — reactivating a `facility_supervisor` whose facility now has a different active supervisor (e.g. one was created to replace them while they were deactivated).

---

### `PUT /api/users/:id/reset-password`

Requires auth + CSRF. Same caller/target rules as `PUT /:id/deactivate` above.

**Body:** `{ "password": "min 8 characters" }` — whoever resets it sets the new password directly (there is no email-based reset flow in this system); communicate it to the user out-of-band.

**200:** same shape as deactivate's response, minus the `isActive` field.

Resetting the password also invalidates the user's current session immediately (not just future logins with the old password) — relevant if the reset was prompted by a suspected compromise. **404** if the user id doesn't exist. **400** if the new password is under 8 characters.

---

### `GET /api/districts`

Requires auth only (no CSRF for GET). Allowed roles: `super_admin` (all districts), `district_supervisor` (their own district only — a one-item array). `facility_supervisor`/`facility_worker` get `403`.

**200:** `{ "districts": [{ "id": "uuid", "name": "...", "isActive": true, "createdAt": "ISO 8601" }] }`

Includes soft-deleted (`isActive: false`) districts — this list is unfiltered by design so a deleted district can still be found and reactivated.

---

### `POST /api/districts`

Requires auth + CSRF. **`super_admin` only.**

**Body:** `{ "name": "District Name" }`

**201:** `{ "district": { "id": "uuid", "name": "...", "isActive": true, "createdAt": "ISO 8601" } }`

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
        "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 }
      }
    ]
  }
}
```
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
      "isActive": true,
      "createdAt": "ISO 8601",
      "facilitySupervisorId": "uuid | null",
      "facilitySupervisorName": "string | null"
    }
  ]
}
```
`facilitySupervisorId`/`facilitySupervisorName` are **new** — both `null` if the facility currently has no active supervisor. A facility can have at most one active `facility_supervisor` at a time (enforced at the DB level — see §2), so this is never ambiguous. Includes soft-deleted (`isActive: false`) facilities — unfiltered by design, same reasoning as `GET /api/districts`.

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

**201:** `{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "isActive": true, "createdAt": "ISO 8601" } }`

Side effect: a fixed default starter set of vaccines (BCG, OPV, Pentavalent, Measles, PCV) is cloned into the new facility as its own independent rows, each immediately paired with a `thresholds` row defaulted to `minQuantity: 0` — this is what `PUT /api/thresholds/:id` (below) will have to edit. No frontend action needed for this; it just means a brand-new facility already has an editable vaccine list and threshold rows out of the box. The `facility_supervisor` can add more / rename these afterward via `POST`/`PUT /api/vaccines` below — changes are scoped to this facility only.

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
        "vaccineName": "BCG",
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

**200:** `{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "isActive": true, "createdAt": "ISO 8601" } }`

**403** if a district_supervisor targets a facility outside their own district. **404** unknown id.

---

### `DELETE /api/facilities/:id`

Requires auth + CSRF. Allowed roles: `super_admin`, `district_supervisor` (own district only). Soft-delete — sets `isActive: false`.

**200:** `{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "isActive": false, "createdAt": "ISO 8601" } }`

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

**The type of movement is derived from the caller's role, not sent by the client:**

| Caller | Recorded as | Effect on the facility's balance |
|---|---|---|
| `facility_supervisor` | `"received"` | adds |
| `facility_worker` | `"used"` | subtracts |

Current stock (`GET /api/dashboard`'s `quantity` field) is a running balance — `SUM(received) + SUM(adjustment_increase) − SUM(used) − SUM(adjustment_decrease)` for that facility/vaccine — not "the latest entry." Don't send an `entryType` field in the body; it's ignored even if present.

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
      "vaccineId": "uuid",
      "vaccineName": "BCG",
      "minQuantity": 20,
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

**`status` values changed — breaking change if you render these literally.** Was `red`/`amber`/`green`/`no_data`; now `critical`/`low`/`adequate`/`no_data` — domain vocabulary instead of a color, so the frontend owns the color mapping instead of the backend baking one in. Banding logic is unchanged, just relabeled: `no_data` if `quantity` is `null`, `critical` if `quantity < minQuantity`, `low` if `quantity < minQuantity * 1.2`, else `adequate`.

**`summary` is new — additive, doesn't change the existing `facilities` array.** Derived from the same rows already returned, no extra request needed:
- `districtCount` / `facilityCount`: distinct counts across rows in scope. For a `district_supervisor` this is always `districtCount: 1` (their own district). A facility with zero vaccines configured yet contributes no rows and so isn't counted in `facilityCount` here — use `GET /api/districts/:id` or `GET /api/facilities/:id` if you need a facility to show up even with nothing configured.
- `statusCounts`: tally of every row's `status`, scoped the same way `facilities` is.
- `byFacility`: per-facility rollup — use this to show "which facility has low/critical stock" at a glance, without re-deriving it client-side from the flat `facilities` array.

`super_admin` gets rows across every facility/district. `district_supervisor` gets rows only for facilities in their own district. `facility_supervisor`/`facility_worker` get rows only for their own single facility — this is enforced before the query runs, not filtered after, so there's no way to widen scope via request params (there are none to manipulate — scope is entirely derived from the session). A soft-deleted (`isActive: false`) facility never appears here, even to `super_admin`.

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
| `entryType` | enum | `received` (facility_supervisor, adds), `used` (facility_worker, subtracts), `adjustment_increase`/`adjustment_decrease` (facility_supervisor, via `PUT /api/vaccines/:id/stock`) — never sent by the client, always derived from the caller's role/route. A fifth value, `legacy`, only appears on stock entries created before this field existed and never on anything new. |
| `status` (dashboard/detail row) | enum | `critical`, `low`, `adequate`, `no_data` — see `GET /api/dashboard` |
| `isActive` (district/facility/user) | boolean | Soft-delete flag. `false` means deactivated/deleted but the row still exists for history — filter to `true` in any picker, but don't assume `GET` list endpoints filter it for you (they mostly don't, by design — see each endpoint above). |
| any `*Id` field | UUID string | or `null` where noted above |
| any `*At` field | ISO 8601 timestamp string | UTC |
| `quantity` (stock entry) | non-negative integer | the magnitude of one received/used/adjustment movement, not a running total — see `POST /api/stock-entries` and `PUT /api/vaccines/:id/stock` |
| `quantity` (dashboard/detail row), `minQuantity` | non-negative integer, or `null` for `quantity` | dashboard `quantity` is a computed running balance, not stored directly |
| `statusCounts` | object | `{ critical, low, adequate, no_data }`, each a non-negative integer count — appears in `GET /api/dashboard`'s `summary`, `GET /api/facilities/:id`, and `GET /api/districts/:id` |

`password_hash` and `tokenVersion` are internal-only and never appear in any API response.
