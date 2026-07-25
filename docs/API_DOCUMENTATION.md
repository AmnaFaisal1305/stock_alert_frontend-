# Smart Stock Alert — API Documentation (by Role)

For Amna / frontend integration. This groups every endpoint by **who can call it, what it does for them, and the request/response shape** — use it to build each role's screens without cross-referencing a second doc for JSON shapes. `docs/api-reference.md` remains the flat, endpoint-first source of truth if you need the full detail on a shared endpoint (e.g. every role's variant of `GET /api/dashboard` in one place) — this doc is the per-role build list.

**Endpoints marked 🆕 were added or changed shape in the most recent rounds of work and may not match older frontend code.** See `FRONTEND_HANDOFF.md` for the round-by-round changelog, framed as "what's different from what you may have already built" — start there if you're picking up from a specific point. **The latest round adds Google Sign-In (§1, one new endpoint, additive) alongside a breaking change to every role's `POST /api/users`**: the `name` field is gone, replaced by required `firstName`/`lastName`, plus a new required `zmid`. The round before that added the self-serve forgot-password flow (§1, two new endpoints) — purely additive. Before that: critical-stock alert emails (a `POST /api/stock-entries` side effect — no response-shape change), and before that, two breaking changes (vaccine name restriction, batch fields required on a "received" stock entry).

**Base URL:**
- Local dev: `http://localhost:3000`
- Deployed (production): `https://smart-stock-alert-be.vercel.app`

---

## Before you start: the auth model in 30 seconds

- Auth is **cookie-based**, not a bearer token. Every `fetch` call needs `credentials: "include"` or nothing works.
- Login returns a `csrfToken` in the JSON **response body**. Store it in memory (not `localStorage`) and send it back as an `x-csrf-token` header on **every** `POST`/`PUT`/`DELETE` request. `GET` requests don't need it.
- Sessions last 8 hours, no refresh flow — on any `401`, redirect to login.
- Every role sits in exactly one strict cascade: `super_admin → district_supervisor → facility_supervisor → facility_worker`. A role's visible scope is fully determined by two fields returned at login — `districtId` and `facilityId` — never by anything the frontend sends.

Full details, code samples: `docs/api-reference.md` §1–3.

---

## Capability matrix (quick overview)

| Capability | Super Admin | District Supervisor | Facility Supervisor | Facility Worker |
|---|---|---|---|---|
| Log in / log out | ✅ | ✅ | ✅ | ✅ |
| View dashboard (+ status summary 🆕) | ✅ everything | ✅ own district | ✅ own facility | ✅ own facility |
| View / create a district (+ supervisor name/email 🆕) | ✅ | ✅ view own only | ❌ | ❌ |
| Rename / delete / reactivate a district 🆕 | ✅ | ❌ | ❌ | ❌ |
| View district detail (facilities + status, + facility supervisor email 🆕) | ✅ | ❌ (own dashboard covers it) | ❌ | ❌ |
| View / create a facility | ✅ all | ✅ own district | ❌ | ❌ |
| Rename / delete / reactivate a facility 🆕 | ✅ | ✅ own district | ❌ | ❌ |
| View facility detail (vaccines + status) 🆕 | ✅ | ✅ own district | ❌ (own dashboard covers it) | ❌ |
| View vaccines | ✅ all | ✅ own district's facilities' | ✅ own facility's | ✅ own facility's |
| Add / rename / delete a vaccine 🆕 | ❌ | ❌ | ✅ own facility, **name must be one of the 13 defaults 🆕** | ❌ |
| Correct a vaccine's current stock 🆕 | ❌ | ❌ | ✅ own facility | ❌ |
| View user accounts (+ names 🆕, + phone/CNIC 🆕) | ✅ everyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Create a user account | ✅ **→ any role directly: district/facility supervisor, facility worker 🆕** (one active supervisor per district/facility) | ✅ → facility supervisor (max one active per facility) | ✅ → facility worker | ❌ |
| Deactivate a user | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Activate (reverse a deactivation) | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Force-reset a password | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Record stock **received** from district (batch metadata required 🆕) | ❌ | ❌ | ✅ own facility | ❌ |
| Record stock **returned** to the facility 🆕 | ❌ | ❌ | ✅ own facility | ❌ |
| Record stock **used** | ❌ | ❌ | ❌ | ✅ own facility |
| Edit a threshold | ❌ | ❌ | ✅ own facility | ❌ |
| View the audit log (`?limit=N` to cap results 🆕) | ✅ everything | ✅ own district | ✅ **own actions + own facility_workers' actions** | ❌ |

✅ = allowed at the scope shown. ❌ = the backend rejects with `403` before any data is touched — never just hidden in the UI. Treat these as a guide for what to *show*, not the actual security boundary; the backend re-checks everything server-side regardless of what the frontend does.

**Vaccines are facility-scoped, not one shared list** — each facility manages its own independent set. **Stock entries are typed.** A Facility Worker's submission via `POST /api/stock-entries` is always recorded as `used` (subtracts) and is rejected server-side if it would exceed what's currently on hand — that role never sends a type, it's derived from who's logged in. A Facility Supervisor now chooses between `received` (stock arriving from the district) and `returned` 🆕 (stock physically returned to the facility, e.g. by workers at end of day) — both add to the balance; omitting the type still defaults to `received`, so any existing "record stock" screen keeps working unchanged.

**🆕 A `received` entry now requires shipment/batch metadata; `returned` does not.** `batchNo`, `expiryDate`, `dosesPerVial`, `manufacturer`, and `remarks` (`"outreach"` or `"fixed"` — a fixed two-value choice, not free text) are all required when `entryType` is `received` (or omitted, since that's the default), and rejected-as-missing with `400` otherwise. None of the five are needed for `returned`. See §4 below for the exact request shape.

**🆕 The 13 default vaccines are currently placeholder names (`"Vaccine 01"`–`"Vaccine 13"`), not real vaccine names.** Every new facility still auto-provisions all 13 at creation, same as before, but `POST`/`PUT /api/vaccines` now reject any name outside that fixed list with `400` — free-text vaccine names no longer work. This will change to the client's real EPI vaccine list once they send it (no shape change on your end, just different string values), so don't hardcode the placeholder names into UI copy anywhere that would be awkward to update later — fetch the list from `GET /api/vaccines` for pickers, same as before.

**Districts and facilities are soft-deleted, never actually removed** — "delete" flips an `isActive` flag to `false`; "activate" reverses it. Both now appear in every response with an `isActive` field, and both are blocked from deletion (`409`) while they still have active children (users, or for a district, active facilities too).

**A facility can have at most one active Facility Supervisor at a time — enforced at the database level.** Creating or reactivating a second one for the same facility gets `409 { "error": "Facility already has an active supervisor" }`. Deactivate the current one first to replace them.

**Same rule, one level up, for District Supervisors 🆕.** A district can have at most one active District Supervisor at a time. Creating or reactivating a second one for the same district gets `409 { "error": "District already has an active supervisor" }`.

**Dashboard status values are `critical` / `low` / `adequate` / `no_data`** (previously `red`/`amber`/`green`/`no_data`) — domain words, not colors; the frontend owns the color mapping.

**Every account requires a `name`, alongside email and password, at creation — for every role.** It's a plain display string (1–120 characters, no uniqueness check) returned in the login response, `POST`/`GET /api/users`, and every deactivate/activate/reset-password response.

**🆕 New profile fields:** districts now carry a `province` (defaults to `"Sindh"` if omitted at creation — every seeded district today is Sindh), facilities carry optional `unionCouncil`/`town`, and users carry optional `phone`/`cnic`. All are plain strings, nullable, no validation beyond non-empty/length — see each endpoint below for exactly where they're accepted and returned.

---

## 1. System Level

Endpoints with no role requirement — either public, or the entry point before any role-scoped access exists yet.

### `GET /api/health`
Liveness check. No auth needed.
```json
// 200
{ "status": "ok" }
```

### `POST /api/auth/login`
Log in with email + password. Rate-limited (10 attempts / 15 min / IP).
```jsonc
// request
{ "email": "user@akuh.pilot", "password": "..." }
// 200
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "...", "districtId": "uuid | null", "facilityId": "uuid | null" },
  "csrfToken": "string — store in memory, send as x-csrf-token on every mutating request"
}
// 401
{ "error": "Invalid email or password" }
```

### `POST /api/auth/logout`
Requires auth + CSRF (the one mutating route that runs on the public `authRouter`, but still needs both). Invalidates the session server-side immediately.
```
// 204 No Content
```

### `POST /api/auth/google` 🆕
No auth needed — alternative to `POST /api/auth/login`, not a replacement for it; password login still works exactly as before. Rate-limited (10 attempts / 15 min / IP, its own budget). Uses Google Identity Services on the frontend to get a signed Google ID token, then verifies it here — only used to confirm the person controls that Gmail inbox, nothing else about the Google account is trusted (not the name, not the photo).
```jsonc
// request
{ "idToken": "the raw ID token string Google's Sign-In button/library returns" }
// 200 — identical shape to POST /api/auth/login's success response
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "...", "districtId": "uuid | null", "facilityId": "uuid | null" },
  "csrfToken": "string — store in memory, send as x-csrf-token on every mutating request"
}
// 401 — token invalid/expired/malformed, or Google-side email not verified
{ "error": "Invalid Google credential" }
// 403 — token is genuinely valid, but the verified email doesn't match any registered account
// (or matches one that's been deactivated) — show an "Access Denied" screen, don't retry
{ "error": "Access denied", "code": "NOT_REGISTERED" }
// 503 — Google sign-in isn't configured server-side yet; fall back to password login
{ "error": "Google sign-in is not configured" }
```

### `POST /api/auth/forgot-password` 🆕
No auth needed — this is the self-serve entry point. Rate-limited (10 attempts / 15 min / IP, its own budget separate from login's). **Always returns the same `200` regardless of whether the email is registered, active, or not** — never branch UI behavior on this response, and never surface a different message for "email not found" (that's the whole point: no signal either way).
```jsonc
// request
{ "email": "user@akuh.pilot" }
// 200 — always this, regardless of outcome
{ "message": "If that email is registered, a reset link has been sent." }
```
If the email matches an active account, an email is sent with a link shaped `{FRONTEND_URL}/reset-password?token=<token>` — read `token` from the query string and pass it straight through as the `:token` path segment on the endpoint below. The token expires in **30 minutes** and can only be used **once**.

### `POST /api/auth/reset-password/:token` 🆕
No auth needed. Same shared rate limit as `forgot-password`. Unlike that endpoint, this one's error *is* specific — the token itself is the secret at this point, not an enumeration vector.
```jsonc
// request
{ "password": "newPassword123" }  // min 8 characters, same bar as every other password field
// 200
{ "message": "Password reset. Please log in." }
// 400 — invalid, expired, or already-used token
{ "error": "Invalid or expired token" }
// 400 — password too short
{ "error": "Validation failed", "fields": { /* zod tree */ } }
```
Does **not** log the user in — no cookie, no `csrfToken` in the response. Send them to the normal login screen after a `200`.

---

## 2. Super Admin

**Scope:** unscoped — `districtId` and `facilityId` are both `null`. The only role that sees the entire system at once.

**Functionality:** onboards the system (creates districts, creates any account below their own role), has unscoped account-management authority over every user, and can rename/delete/reactivate any district. **🆕 Can now create a `district_supervisor`, `facility_supervisor`, or `facility_worker` directly**, not just the top-of-cascade `district_supervisor` — see `POST /api/users` below. Still cannot create a facility, record stock entries, or edit thresholds.

### `POST /api/districts`
```jsonc
// request
{ "name": "Karachi Central", "province": "Sindh" } // 🆕 province optional, defaults to "Sindh" if omitted
// 201
{ "district": { "id": "uuid", "name": "Karachi Central", "province": "Sindh", "isActive": true, "createdAt": "ISO 8601" } }
// 409 — name already in use
```

### `GET /api/districts`
```json
// 200 — every district, including soft-deleted ones
{ "districts": [{ "id": "uuid", "name": "...", "province": "Sindh", "isActive": true, "createdAt": "ISO 8601", "supervisorName": "string | null", "supervisorEmail": "string | null" }] }
```
`province` 🆕. `supervisorName`/`supervisorEmail` — both `null` if the district has no active `district_supervisor` yet.

### `GET /api/districts/:id` 🆕
Drill-down: the district plus every facility in it (even ones with zero vaccines configured), each with a status rollup.
```json
// 200
{
  "district": {
    "id": "uuid", "name": "Karachi Central", "province": "Sindh", "isActive": true, "createdAt": "ISO 8601",
    "facilityCount": 6,
    "statusCounts": { "critical": 3, "low": 5, "adequate": 18, "no_data": 2 },
    "facilities": [
      { "id": "uuid", "name": "AKUH Main Campus", "isActive": true, "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null", "facilitySupervisorEmail": "string | null", "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 } }
    ]
  }
}
// 404 — unknown id
```
`facilitySupervisorEmail` 🆕 — alongside the existing `facilitySupervisorId`/`facilitySupervisorName`, same `null`-if-unstaffed rule.

### `PUT /api/districts/:id` 🆕
```jsonc
// request
{ "name": "New District Name" }
// 200
{ "district": { "id": "uuid", "name": "New District Name", "isActive": true, "createdAt": "ISO 8601" } }
// 409 — name collides with another district
```

### `DELETE /api/districts/:id` 🆕
Soft-delete.
```json
// 200
{ "district": { "id": "uuid", "name": "...", "isActive": false, "createdAt": "ISO 8601" } }
// 409 — still has an active facility or active user
```

### `PUT /api/districts/:id/activate` 🆕
Reverses the soft-delete. Same shape as `DELETE`, `isActive: true`.

### `GET /api/facilities`
```json
// 200 — every facility, across all districts, including soft-deleted ones
{ "facilities": [{ "id": "uuid", "name": "...", "districtId": "uuid", "unionCouncil": "string | null", "town": "string | null", "isActive": true, "createdAt": "ISO 8601", "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null" }] }
```
`unionCouncil`/`town` 🆕. `facilitySupervisorId`/`facilitySupervisorName` — both `null` if unstaffed.

### `POST /api/facilities` — super_admin can create in **any** district
Unlike `district_supervisor` (§3 below), a super_admin session has no district of its own, so `districtId` must be supplied in the body — validated as a real, active district server-side, `400` otherwise. Same `unionCouncil`/`town` fields as the district_supervisor variant.
```jsonc
// request
{ "name": "AKUH Main Campus", "districtId": "uuid", "unionCouncil": "UC 5", "town": "Malir" } // unionCouncil/town optional
// 201
{ "facility": { "id": "uuid", "name": "AKUH Main Campus", "districtId": "uuid", "unionCouncil": "UC 5", "town": "Malir", "isActive": true, "createdAt": "ISO 8601" } }
// 400 — districtId missing, or doesn't reference a real/active district
{ "error": "districtId is required" }  // or: { "error": "Unknown districtId" }
```
Auto-provisions the same 13 default vaccines + threshold rows as the district_supervisor variant.

### `GET /api/users`
```json
// 200 — every user, of every role
{ "users": [{ "id": "uuid", "email": "...", "name": "...", "role": "...", "districtId": "uuid | null", "districtName": "string | null", "facilityId": "uuid | null", "facilityName": "string | null", "phone": "string | null", "cnic": "string | null", "firstName": "string | null", "lastName": "string | null", "zmid": "string | null", "isActive": true }] }
```
`phone`/`cnic` 🆕.

### `POST /api/users` 🆕 — now creates any role directly
Previously restricted to creating only a `district_supervisor`. **Now creates a `district_supervisor`, `facility_supervisor`, or `facility_worker` directly** — useful for provisioning accounts from client-supplied profiles (name/email/CNIC/phone) without going through the district_supervisor → facility_supervisor → facility_worker cascade. The frontend only needs to expose the `district_supervisor` path for now (per the existing UI); the other two exist for a later phase, but the API accepts them today if you want to build ahead.

Since Super Admin has no district/facility of their own, `districtId`/`facilityId` always come from the request body — validated as an existing, active district/facility before use (never trusted blindly).

**🆕 Breaking change: `name` is gone from the request body, replaced by `firstName`/`lastName`.** The server computes `name` as `` `${firstName} ${lastName}` `` and still returns it exactly as before — every existing name-*reading* screen is unaffected, only the *creation form* needs a first-name/last-name split instead of one name field. Also new: `zmid`, a required, unique organization identifier (free-text, no format validation beyond non-empty).
```jsonc
// request — creating a district_supervisor
{ "email": "ds@akuh.pilot", "password": "min 8 chars", "firstName": "Jane", "lastName": "Doe", "zmid": "Z-1001", "role": "district_supervisor", "districtId": "uuid", "phone": "03001234567", "cnic": "12345-1234567-1" }

// request — creating a facility_supervisor directly 🆕
{ "email": "fs@akuh.pilot", "password": "min 8 chars", "firstName": "Jane", "lastName": "Doe", "zmid": "Z-1002", "role": "facility_supervisor", "facilityId": "uuid" }

// request — creating a facility_worker directly 🆕
{ "email": "fw@akuh.pilot", "password": "min 8 chars", "firstName": "Jane", "lastName": "Doe", "zmid": "Z-1003", "role": "facility_worker", "facilityId": "uuid" }

// 201 (all three roles, same shape)
{ "user": { "id": "uuid", "email": "...", "name": "Jane Doe", "firstName": "Jane", "lastName": "Doe", "zmid": "Z-1001", "role": "...", "districtId": "uuid", "facilityId": "uuid | null", "phone": "string | null", "cnic": "string | null", "isActive": true } }
// 400 — facilityId/districtId missing, unknown, or references a soft-deleted district/facility
// 409
{ "error": "Email already in use" }
// 409 — that zmid already belongs to another account
{ "error": "ZMID already in use" }
// 409 — that district already has a different active district_supervisor
{ "error": "District already has an active supervisor" }
// 409 — that facility already has a different active facility_supervisor
{ "error": "Facility already has an active supervisor" }
```
`phone`/`cnic` — both optional, on every role's creation body, not just the ones shown above. `firstName`/`lastName`/`zmid` 🆕 — all required, on every role's creation body.

### `PUT /api/users/:id/deactivate`
Deactivates **any** user account, unscoped. Takes effect immediately.
```json
// 200
{ "user": { "id": "uuid", "email": "...", "name": "...", "role": "...", "districtId": "uuid | null", "facilityId": "uuid | null", "phone": "string | null", "cnic": "string | null", "isActive": false } }
```
`phone`/`cnic` 🆕 — same shape on activate/reset-password below, and on every role's version of these three endpoints.

### `PUT /api/users/:id/activate`
Reactivates **any** user account, unscoped — reverses a deactivation. Same shape as deactivate, `isActive: true`. **409 `{ "error": "Facility already has an active supervisor" }`** if reactivating a `facility_supervisor` whose facility now has a different active one. **409 `{ "error": "District already has an active supervisor" }`** 🆕 — same case, one level up, for a `district_supervisor`.

### `PUT /api/users/:id/reset-password`
```jsonc
// request
{ "password": "min 8 chars" }
// 200 — same shape as deactivate, minus isActive
```

### `GET /api/vaccines`
```json
// 200 — every vaccine in the system, unscoped
{ "vaccines": [{ "id": "uuid", "name": "Vaccine 01", "facilityId": "uuid", "createdAt": "ISO 8601" }] }
```

### `GET /api/dashboard`
Stock dashboard rows and a status summary across **every** facility and district, all at once — see §Facility Supervisor below for the full row/summary shape, identical across roles, just scoped differently.

### `GET /api/audit-log`
The entire audit log, unscoped — every mutation any user has ever made. Row shape: see §Facility Supervisor below. Accepts an optional `?limit=N` query param 🆕 (positive integer, max 500) to cap the response to the `N` most recent rows instead of the entire log — see §District Supervisor's `GET /api/audit-log` below for the full note (applies identically to every role that can call this endpoint).

---

## 3. District Supervisor

**Scope:** one district — `districtId` is set, `facilityId` is `null`.

**Functionality:** builds out their own district (creates facilities, creates the `facility_supervisor` for each one — at most one active supervisor per facility, enforced server-side), manages/renames/deletes facilities within it, and can view a drill-down detail of any facility in their district. **Cannot** create a district, a `district_supervisor`, or a `facility_worker` account. Cannot record a stock entry or edit a threshold. Cannot see anything outside their own district.

### `GET /api/districts`
```json
// 200 — a one-item list: just their own district
{ "districts": [{ "id": "uuid", "name": "...", "province": "Sindh", "isActive": true, "createdAt": "ISO 8601", "supervisorName": "string | null", "supervisorEmail": "string | null" }] }
```
`province` 🆕. `supervisorName`/`supervisorEmail` — reflects themselves (the caller), since it's their own district's active supervisor.

### `POST /api/facilities`
`districtId` is forced server-side to their own — never taken from the request. **🆕 Clones all 13 default vaccines** into the new facility (was 5 — `BCG`, `OPV`, `Pentavalent`, `Measles`, `PCV`; **currently placeholder names `"Vaccine 01"`–`"Vaccine 13"`, will become the client's real EPI list later with no shape change**), each with a threshold row left unconfigured (`minQuantity: null`) until a `facility_supervisor` sets a real value via `PUT /api/thresholds/:id`.
```jsonc
// request
{ "name": "AKUH Main Campus", "unionCouncil": "UC 5", "town": "Malir" } // unionCouncil/town 🆕, both optional
// 201
{ "facility": { "id": "uuid", "name": "AKUH Main Campus", "districtId": "uuid", "unionCouncil": "UC 5", "town": "Malir", "isActive": true, "createdAt": "ISO 8601" } }
```

### `GET /api/facilities`
```json
// 200 — every facility within their own district, including soft-deleted ones
{ "facilities": [{ "id": "uuid", "name": "...", "districtId": "uuid", "unionCouncil": "string | null", "town": "string | null", "isActive": true, "createdAt": "ISO 8601", "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null" }] }
```
`unionCouncil`/`town` 🆕.

### `GET /api/facilities/:id` 🆕
Drill-down: facility metadata + its full vaccine/stock list + a status rollup, for a facility within their own district.
```json
// 200
{
  "facility": {
    "id": "uuid", "name": "AKUH Main Campus", "districtId": "uuid", "districtName": "Karachi Central",
    "unionCouncil": "string | null", "town": "string | null",
    "isActive": true, "createdAt": "ISO 8601",
    "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null",
    "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 },
    "vaccines": [
      { "thresholdId": "uuid", "vaccineId": "uuid", "vaccineName": "Vaccine 01", "minQuantity": 20, "quantity": 8, "recordedAt": "ISO 8601 | null", "status": "critical" }
    ]
  }
}
// 403 — facility belongs to a different district
// 404 — unknown id
```

### `PUT /api/facilities/:id` 🆕
```jsonc
// request
{ "name": "New Facility Name" }
// 200 — same shape as the facility object above (without districtName/statusCounts/vaccines)
// 403 — outside their own district
```

### `DELETE /api/facilities/:id` 🆕
Soft-delete, own district only.
```json
// 200
{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "isActive": false, "createdAt": "ISO 8601" } }
// 409 — still has an active user (facility_supervisor or facility_worker)
```

### `PUT /api/facilities/:id/activate` 🆕
Reverses the soft-delete. Same shape as `DELETE`, `isActive: true`.

### `GET /api/users`
```json
// 200 — the facility_supervisors they've created (not facility_workers two levels down)
{ "users": [{ "id": "uuid", "email": "...", "name": "...", "firstName": "string | null", "lastName": "string | null", "zmid": "string | null", "role": "facility_supervisor", "districtId": "uuid", "districtName": "...", "facilityId": "uuid", "facilityName": "...", "isActive": true }] }
```

### `POST /api/users`
Creates a `facility_supervisor` account for a facility already in their own district.

**🆕 Breaking change: `name` is gone from the request body, replaced by `firstName`/`lastName`** (server computes `name` as before — see the Super Admin section above for the full note). Also new: required, unique `zmid`.
```jsonc
// request
{ "email": "fs@akuh.pilot", "password": "min 8 chars", "firstName": "Jane", "lastName": "Doe", "zmid": "Z-2001", "role": "facility_supervisor", "facilityId": "uuid", "phone": "03001234567", "cnic": "12345-1234567-1" } // phone/cnic, both optional
// 201
{ "user": { "id": "uuid", "email": "...", "name": "Jane Doe", "firstName": "Jane", "lastName": "Doe", "zmid": "Z-2001", "role": "facility_supervisor", "districtId": "uuid", "facilityId": "uuid", "phone": "string | null", "cnic": "string | null", "isActive": true } }
// 400 — facilityId missing/unknown/soft-deleted, or outside their own district
// 409
{ "error": "Facility already has an active supervisor" } // that facility already has a different active facility_supervisor
// 409 — that zmid already belongs to another account
{ "error": "ZMID already in use" }
```

### `PUT /api/users/:id/deactivate` / `:id/activate` / `:id/reset-password`
Same shapes as Super Admin's above — scoped to a `facility_supervisor` whose `districtId` matches their own. `403` on a peer, a facility_supervisor elsewhere, or any facility_worker. `activate` can also return **409** 🆕 (same "already has an active supervisor" case).

### `GET /api/vaccines`
```json
// 200 — vaccines belonging to any facility in their own district
{ "vaccines": [{ "id": "uuid", "name": "...", "facilityId": "uuid", "createdAt": "ISO 8601" }] }
```

### `GET /api/dashboard`
```json
// 200
{
  "facilities": [
    { "thresholdId": "uuid", "facilityId": "uuid", "facilityName": "...", "districtId": "uuid", "districtName": "...", "vaccineId": "uuid", "vaccineName": "...", "minQuantity": 20, "quantity": 15, "recordedAt": "ISO 8601 | null", "status": "critical | low | adequate | no_data" }
  ],
  "summary": {
    "districtCount": 1,
    "facilityCount": 6,
    "statusCounts": { "critical": 3, "low": 5, "adequate": 18, "no_data": 2 },
    "byFacility": [
      { "facilityId": "uuid", "facilityName": "...", "districtId": "uuid", "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 } }
    ]
  }
}
```
`summary` 🆕 — additive, alongside the unchanged `facilities` array. `districtCount` is always `1` for this role. Use `summary.byFacility` to show which facility needs attention at a glance instead of deriving it from the flat row list yourself. `status` values changed 🆕: `critical`/`low`/`adequate` (was `red`/`amber`/`green`), `no_data` unchanged. `no_data` now covers two cases: no stock entry ever recorded for that facility/vaccine pair, **or** `minQuantity` is `null` (threshold never configured — see `docs/api-reference.md` for the full banding logic).

### `GET /api/audit-log`
```json
// 200 — every mutation whose owning district matches theirs, newest first
{ "auditLog": [{ "id": "uuid", "actorId": "uuid", "actorName": "...", "actorRole": "...", "action": "...", "entityType": "...", "entityId": "uuid | null", "districtId": "uuid | null", "districtName": "string | null", "facilityId": "uuid | null", "facilityName": "string | null", "details": {}, "createdAt": "ISO 8601" }] }
```
**`?limit=N` query param 🆕** — e.g. `GET /api/audit-log?limit=5` returns only the 5 most recent rows in this role's scope, instead of the whole thing. Useful for a "recent activity" widget that doesn't need to fetch and slice the full log client-side. `N` must be a positive integer (max 500) or the request is rejected with `400`. Omitting it keeps the old unlimited behavior.

---

## 4. Facility Supervisor

**Scope:** one facility within one district — both `districtId` and `facilityId` are set. **A facility can only ever have one active Facility Supervisor at a time.**

**Functionality:** runs day-to-day operations for their one facility — creates `facility_worker` accounts, records stock **received** or **returned** 🆕, manages their facility's vaccine list (add/rename/**delete** 🆕, restricted to the 13 default names 🆕), is the only role that can edit a threshold or **directly correct a vaccine's current stock count** 🆕. **Never records "used" stock.**

### `GET /api/users`
```json
// 200 — the facility_workers they've created
{ "users": [{ "id": "uuid", "email": "...", "name": "...", "role": "facility_worker", "districtId": "uuid", "districtName": "...", "facilityId": "uuid", "facilityName": "...", "phone": "string | null", "cnic": "string | null", "firstName": "string | null", "lastName": "string | null", "zmid": "string | null", "isActive": true }] }
```
`phone`/`cnic` 🆕.

### `POST /api/users`
`facilityId` forced to their own; the new `facility_worker`'s `districtId` is also forced to the caller's own district (previously `null` by design — reversed).

**🆕 Breaking change: `name` is gone from the request body, replaced by `firstName`/`lastName`** (server computes `name` as before — see the Super Admin section above for the full note). Also new: required, unique `zmid`.
```jsonc
// request
{ "email": "worker@akuh.pilot", "password": "min 8 chars", "firstName": "Jane", "lastName": "Doe", "zmid": "Z-3001", "role": "facility_worker", "phone": "03001234567", "cnic": "12345-1234567-1" } // phone/cnic, both optional
// 201
{ "user": { "id": "uuid", "email": "...", "name": "Jane Doe", "firstName": "Jane", "lastName": "Doe", "zmid": "Z-3001", "role": "facility_worker", "districtId": "uuid", "facilityId": "uuid", "phone": "string | null", "cnic": "string | null", "isActive": true } }
// 409 — that zmid already belongs to another account
{ "error": "ZMID already in use" }
```

### `PUT /api/users/:id/deactivate` / `:id/activate` / `:id/reset-password`
Scoped to a `facility_worker` whose `facilityId` matches their own — `403` otherwise, or on anyone at/above their own level.

### `POST /api/stock-entries`
🆕 Now a choice between `"received"` (stock arriving from the district) and `"returned"` (stock physically returned to the facility, e.g. by workers at end of day) — both add to the facility's running balance. `entryType` is optional in the body and defaults to `"received"` if omitted, so an existing "record stock" form that doesn't send it at all keeps working. Any other value (e.g. `"used"`, which is `facility_worker`-only) is rejected with `400` — it's not just ignored, the request never reaches the database.

**`received` requires five additional fields; `returned` doesn't need any of them:**
```jsonc
// request — received (batch metadata required)
{
  "vaccineId": "uuid",
  "quantity": 50,
  "batchNo": "B-2026-001",
  "expiryDate": "2027-06-30",      // plain date string, not a full timestamp
  "dosesPerVial": 10,
  "manufacturer": "Manufacturer Name",
  "remarks": "outreach"            // or "fixed" — no other value accepted
}
// 201
{ "entry": { "id": "uuid", "facilityId": "uuid", "vaccineId": "uuid", "quantity": 50, "entryType": "received", "recordedBy": "uuid", "batchNo": "B-2026-001", "expiryDate": "2027-06-30", "dosesPerVial": 10, "manufacturer": "Manufacturer Name", "remarks": "outreach", "createdAt": "ISO 8601" } }

// request — returned (no batch fields needed)
{ "vaccineId": "uuid", "quantity": 5, "entryType": "returned" }
// 201
{ "entry": { "id": "uuid", "facilityId": "uuid", "vaccineId": "uuid", "quantity": 5, "entryType": "returned", "recordedBy": "uuid", "batchNo": null, "expiryDate": null, "dosesPerVial": null, "manufacturer": null, "remarks": null, "createdAt": "ISO 8601" } }

// 400 — received without one or more of the five required fields
{ "error": "batchNo, expiryDate, dosesPerVial, manufacturer, and remarks are required for a received entry" }
```
Expiry is reference metadata only — it does **not** affect the stock balance or expire anything automatically; there's no FEFO/depletion logic. Just capture and display it.

**🆕 Backend side effect, no response-shape change:** if this entry drops the vaccine's balance below its configured threshold (status flips to `critical`), the backend automatically emails the facility's own supervisor(s), the owning district's supervisor, and every super_admin — once per "critical episode" (it won't re-email on every subsequent entry while it stays critical, only when it first crosses into critical and again if it later recovers and drops critical again). This is entirely invisible in the API response — no new field, nothing to build UI for. The one observable side effect: **the very first entry that pushes a pair into critical takes noticeably longer to respond** (it waits on a real outbound email send before returning `201`); every other entry responds at normal speed. Dashboard badges (§Related capability matrix) are unaffected — this alert is email-only, not a new in-app notification.

### `PUT /api/thresholds/:id`
The only role that can do this — only a threshold row belonging to their own facility.
```jsonc
// request
{ "minQuantity": 20 }
// 200
{ "threshold": { "id": "uuid", "facilityId": "uuid", "vaccineId": "uuid", "minQuantity": 20, "updatedAt": "ISO 8601" } }
```

### `GET /api/vaccines`
```json
// 200 — their own facility's vaccine list
{ "vaccines": [{ "id": "uuid", "name": "...", "facilityId": "uuid", "createdAt": "ISO 8601" }] }
```

### `POST /api/vaccines`
🆕 `name` must now be one of the 13 default vaccine names (`GET /api/vaccines` for the exact current list — see the placeholder-names note above) — anything else is rejected with `400`, not a generic validation message you need to special-case, just the standard `{ "error": "Validation failed", "fields": {...} }` shape. Since every facility already gets all 13 at creation, this endpoint is mainly for re-adding one after it was deleted.
```jsonc
// request
{ "name": "Vaccine 01", "minQuantity": 0 } // minQuantity optional; omitted = "not yet configured" (null), an explicit 0 is a deliberate choice
// 201
{ "vaccine": { "id": "uuid", "name": "Vaccine 01", "facilityId": "uuid", "createdAt": "ISO 8601" } }
// 400 — name isn't one of the 13 defaults
// 409 — duplicate name at this facility
```

### `PUT /api/vaccines/:id`
🆕 Same name restriction as `POST` above applies to renames.
```jsonc
// request
{ "name": "Vaccine 02" }
// 200 — same shape as POST's vaccine object
// 400 — name isn't one of the 13 defaults
// 403 — belongs to another facility
```

### `DELETE /api/vaccines/:id` 🆕
Real hard delete — only possible for a vaccine with zero recorded stock history.
```json
// 204 No Content
// 409
{ "error": "Cannot delete a vaccine with recorded stock history" }
```

### `PUT /api/vaccines/:id/stock` 🆕
Send the new total, not a delta — the server computes and records the correction.
```jsonc
// request
{ "quantity": 47 }
// 200 — correction applied
{ "vaccineId": "uuid", "balance": 47, "entry": { "id": "uuid", "quantity": 12, "entryType": "adjustment_increase | adjustment_decrease", "recordedBy": "uuid", "createdAt": "ISO 8601" } }
// 200 — no-op, submitted value equals current balance (no `entry` key)
{ "vaccineId": "uuid", "balance": 47 }
```

### `GET /api/dashboard`
```json
// 200 — their one facility only
{
  "facilities": [{ "thresholdId": "uuid", "facilityId": "uuid", "facilityName": "...", "districtId": "uuid", "districtName": "...", "unionCouncil": "string | null", "town": "string | null", "vaccineId": "uuid", "vaccineName": "...", "minQuantity": 20, "quantity": 15, "recordedAt": "ISO 8601 | null", "status": "critical | low | adequate | no_data" }],
  "summary": { "districtCount": 1, "facilityCount": 1, "statusCounts": { "critical": 0, "low": 1, "adequate": 4, "no_data": 0 }, "byFacility": [{ "facilityId": "uuid", "facilityName": "...", "districtId": "uuid", "statusCounts": { "critical": 0, "low": 1, "adequate": 4, "no_data": 0 } }] }
}
```
`status` values 🆕: `critical`/`low`/`adequate`/`no_data` (was `red`/`amber`/`green`/`no_data`). `summary` 🆕 — for this role it's just their one facility's own numbers restated, included for shape-consistency across roles. `unionCouncil`/`town` 🆕 — the facility's own profile fields, same as `GET /api/facilities`, repeated on every row (harmless duplication — a facility_supervisor only ever has one facility, so it's the same value on every row).

### `GET /api/audit-log`
```json
// 200 — their own actions plus their own facility_workers', at their own facility only
{ "auditLog": [{ "id": "uuid", "actorId": "uuid", "actorName": "...", "actorRole": "...", "action": "STOCK_ENTRY", "entityType": "stock_entry", "entityId": "uuid", "districtId": "uuid", "districtName": "...", "facilityId": "uuid", "facilityName": "...", "details": { "vaccineId": "uuid", "vaccineName": "Vaccine 01", "quantity": 50, "entryType": "received | returned", "batchNo": "string | null", "expiryDate": "string | null", "dosesPerVial": "number | null", "manufacturer": "string | null", "remarks": "string | null" }, "createdAt": "ISO 8601" }] }
```
`details.entryType` 🆕 can now be `"returned"`, and `details.batchNo`/`expiryDate`/`dosesPerVial`/`manufacturer`/`remarks` 🆕 are included (`null` for `returned`/`used` entries, populated for `received`). For a Recent Activity widget showing the last 5 entries: `GET /api/audit-log?limit=5` — caps server-side instead of fetching everything and slicing client-side.

---

## 5. Facility Worker

**Scope:** narrowest role — `facilityId` is set. `districtId` is also set 🆕 for accounts created after the round that added it (previously always `null`).

**Functionality:** field-level role — logs in, sees their own facility's current per-vaccine stock, records how many doses they **used**, checks the dashboard as read-only confirmation. **Cannot** create any account, edit a threshold, manage the vaccine list, or view districts/facilities/other users/the audit log at all.

### `POST /api/stock-entries`
Always recorded as `"used"` for this role — subtracts from the facility's running balance.
```jsonc
// request
{ "vaccineId": "uuid", "quantity": 5 }
// 201
{ "entry": { "id": "uuid", "facilityId": "uuid", "vaccineId": "uuid", "quantity": 5, "entryType": "used", "recordedBy": "uuid", "createdAt": "ISO 8601" } }
// 400 — would drive stock below zero
{ "error": "Insufficient stock", "available": 3 }
```
🆕 Same critical-stock alert side effect as the facility_supervisor's version above — a `"used"` entry that drops the balance below threshold triggers the same backend email, invisible in this response.

### `GET /api/vaccines`
```json
// 200 — their own facility's vaccine list, read-only for this role
{ "vaccines": [{ "id": "uuid", "name": "...", "facilityId": "uuid", "createdAt": "ISO 8601" }] }
```

### `GET /api/dashboard`
Same shape as Facility Supervisor's above — one facility, `facilities` + `summary`. Use `quantity` per vaccine to show remaining stock in the entry form's dropdown before submitting.

---

## Rules that apply to every role, no exceptions

- **Every mutating request (`POST`/`PUT`/`DELETE`) needs a valid session cookie *and* the `x-csrf-token` header.** No role is exempt. `GET` requests only need the session cookie.
- **A request body can never grant more than the caller's own role allows.** Submitting `"role": "super_admin"` in a `POST /api/users` body from a facility_supervisor session just gets rejected — the creatable role and scope (`districtId`/`facilityId`) always come from the caller's own verified session, never from what the client sends (Super Admin is the one role allowed to send `districtId`/`facilityId` explicitly, since it has none of its own — always validated as a real, active district/facility first). `POST /api/stock-entries`'s `entryType` is similarly locked down: a `facility_worker` can never produce anything but `"used"` no matter what's in the body, and a `facility_supervisor` can only ever produce `"received"` or `"returned"` — any other value is rejected outright, not silently overridden.
- **Deactivation and password reset always follow the same one-level-down cascade as account creation** — enforced server-side after loading the target row, never inferred from the request URL alone.
- **A facility's active Facility Supervisor is unique, enforced at the DB level** — any attempt to have two produces a `409`, whether via `POST /api/users` or `PUT /api/users/:id/activate`. **Same rule for a district's active District Supervisor 🆕.**
- **Districts and facilities soft-delete, never hard-delete** — `isActive: false`, blocked with `409` while active children exist. Deleted rows keep appearing in their own `GET`/list endpoints (unfiltered by design) but disappear from `GET /api/dashboard`.
- **Every write, from every role, produces exactly one audit log row.**
- **No self-serve anything** — no signup, no "forgot password" flow, no self-deactivation. Every account is created by exactly one role above it in the cascade.
- Common error codes across all endpoints: `400` (validation/bad id), `401` (no/expired/revoked session — re-authenticate, don't retry), `403` (wrong role, wrong scope, or missing/invalid CSRF token), `404` (not found), `409` (duplicate or business-rule conflict), `429` (rate limited).

---

## Related docs

- `docs/api-reference.md` — the flat, endpoint-first request/response JSON contract, plus auth code samples and a full data-model reference.
- `FRONTEND_HANDOFF.md` — the round-by-round changelog of backend changes, framed as "what's different from what you may have already built."
- `docs/functionality.md` — the same role breakdown as this doc, in more narrative detail.
- `users.md` (ask Ahmed — gitignored, contains real passwords) — one working login per role to test against immediately. The `ds.demo`/`fs.demo`/`fw.demo` trio under `Karachi Central` now also has a sample `received` entry (with batch metadata) and a `returned` entry on its `OPV` vaccine, if you want to see the new fields on real data without creating your own.
