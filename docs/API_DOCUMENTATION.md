# Smart Stock Alert — API Documentation (by Role)

For Amna / frontend integration. This groups every endpoint by **who can call it, what it does for them, and the request/response shape** — use it to build each role's screens without cross-referencing a second doc for JSON shapes. `docs/api-reference.md` remains the flat, endpoint-first source of truth if you need the full detail on a shared endpoint (e.g. every role's variant of `GET /api/dashboard` in one place) — this doc is the per-role build list.

**Endpoints marked 🆕 were added or changed shape in the most recent rounds of work and may not match older frontend code.** See `FRONTEND_HANDOFF.md` for the round-by-round changelog if you're picking up from a specific point.

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
| View / create a district | ✅ | ✅ view own only | ❌ | ❌ |
| Rename / delete / reactivate a district 🆕 | ✅ | ❌ | ❌ | ❌ |
| View district detail (facilities + status) 🆕 | ✅ | ❌ (own dashboard covers it) | ❌ | ❌ |
| View / create a facility | ✅ all | ✅ own district | ❌ | ❌ |
| Rename / delete / reactivate a facility 🆕 | ✅ | ✅ own district | ❌ | ❌ |
| View facility detail (vaccines + status) 🆕 | ✅ | ✅ own district | ❌ (own dashboard covers it) | ❌ |
| View vaccines | ✅ all | ✅ own district's facilities' | ✅ own facility's | ✅ own facility's |
| Add / rename / delete a vaccine 🆕 | ❌ | ❌ | ✅ own facility | ❌ |
| Correct a vaccine's current stock 🆕 | ❌ | ❌ | ✅ own facility | ❌ |
| View user accounts (+ names 🆕) | ✅ everyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Create a user account | ✅ → district supervisor | ✅ → facility supervisor (max one active per facility 🆕) | ✅ → facility worker | ❌ |
| Deactivate a user | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Activate (reverse a deactivation) | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Force-reset a password | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Record stock **received** from district | ❌ | ❌ | ✅ own facility | ❌ |
| Record stock **used** | ❌ | ❌ | ❌ | ✅ own facility |
| Edit a threshold | ❌ | ❌ | ✅ own facility | ❌ |
| View the audit log | ✅ everything | ✅ own district | ✅ **own actions + own facility_workers' actions** | ❌ |

✅ = allowed at the scope shown. ❌ = the backend rejects with `403` before any data is touched — never just hidden in the UI. Treat these as a guide for what to *show*, not the actual security boundary; the backend re-checks everything server-side regardless of what the frontend does.

**Vaccines are facility-scoped, not one shared list** — each facility manages its own independent set. **Stock entries are typed** — a Facility Supervisor's submission via `POST /api/stock-entries` is always recorded as `received` (adds to stock); a Facility Worker's is always recorded as `used` (subtracts) and is rejected server-side if it would exceed what's currently on hand. Neither role sends the type themselves — it's derived from who's logged in.

**Districts and facilities are soft-deleted, never actually removed** — "delete" flips an `isActive` flag to `false`; "activate" reverses it. Both now appear in every response with an `isActive` field, and both are blocked from deletion (`409`) while they still have active children (users, or for a district, active facilities too).

**A facility can have at most one active Facility Supervisor at a time — enforced at the database level.** Creating or reactivating a second one for the same facility gets `409 { "error": "Facility already has an active supervisor" }`. Deactivate the current one first to replace them.

**Dashboard status values are `critical` / `low` / `adequate` / `no_data`** (previously `red`/`amber`/`green`/`no_data`) — domain words, not colors; the frontend owns the color mapping.

**Every account requires a `name`, alongside email and password, at creation — for every role.** It's a plain display string (1–120 characters, no uniqueness check) returned in the login response, `POST`/`GET /api/users`, and every deactivate/activate/reset-password response.

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

---

## 2. Super Admin

**Scope:** unscoped — `districtId` and `facilityId` are both `null`. The only role that sees the entire system at once.

**Functionality:** onboards the system (creates districts, creates the one `district_supervisor` per district), has unscoped account-management authority over every user, and can rename/delete/reactivate any district. **Cannot** create a facility, a `facility_supervisor`, or a `facility_worker` directly — account/facility creation only ever cascades one level down. Cannot record stock entries or edit thresholds.

### `POST /api/districts`
```jsonc
// request
{ "name": "Karachi Central" }
// 201
{ "district": { "id": "uuid", "name": "Karachi Central", "isActive": true, "createdAt": "ISO 8601" } }
// 409 — name already in use
```

### `GET /api/districts`
```json
// 200 — every district, including soft-deleted ones
{ "districts": [{ "id": "uuid", "name": "...", "isActive": true, "createdAt": "ISO 8601" }] }
```

### `GET /api/districts/:id` 🆕
Drill-down: the district plus every facility in it (even ones with zero vaccines configured), each with a status rollup.
```json
// 200
{
  "district": {
    "id": "uuid", "name": "Karachi Central", "isActive": true, "createdAt": "ISO 8601",
    "facilityCount": 6,
    "statusCounts": { "critical": 3, "low": 5, "adequate": 18, "no_data": 2 },
    "facilities": [
      { "id": "uuid", "name": "AKUH Main Campus", "isActive": true, "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null", "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 } }
    ]
  }
}
// 404 — unknown id
```

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
{ "facilities": [{ "id": "uuid", "name": "...", "districtId": "uuid", "isActive": true, "createdAt": "ISO 8601", "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null" }] }
```
`facilitySupervisorId`/`facilitySupervisorName` 🆕 — both `null` if unstaffed.

### `GET /api/users`
```json
// 200 — every user, of every role
{ "users": [{ "id": "uuid", "email": "...", "name": "...", "role": "...", "districtId": "uuid | null", "districtName": "string | null", "facilityId": "uuid | null", "facilityName": "string | null", "isActive": true }] }
```

### `POST /api/users`
Creates a `district_supervisor` account for any district. This is the only role a super_admin can create directly.
```jsonc
// request
{ "email": "ds@akuh.pilot", "password": "min 8 chars", "name": "Display Name", "role": "district_supervisor", "districtId": "uuid" }
// 201
{ "user": { "id": "uuid", "email": "...", "name": "...", "role": "district_supervisor", "districtId": "uuid", "facilityId": null, "isActive": true } }
// 409
{ "error": "Email already in use" }
```

### `PUT /api/users/:id/deactivate`
Deactivates **any** user account, unscoped. Takes effect immediately.
```json
// 200
{ "user": { "id": "uuid", "email": "...", "name": "...", "role": "...", "districtId": "uuid | null", "facilityId": "uuid | null", "isActive": false } }
```

### `PUT /api/users/:id/activate`
Reactivates **any** user account, unscoped — reverses a deactivation. Same shape as deactivate, `isActive: true`. **409 `{ "error": "Facility already has an active supervisor" }`** 🆕 if reactivating a `facility_supervisor` whose facility now has a different active one.

### `PUT /api/users/:id/reset-password`
```jsonc
// request
{ "password": "min 8 chars" }
// 200 — same shape as deactivate, minus isActive
```

### `GET /api/vaccines`
```json
// 200 — every vaccine in the system, unscoped
{ "vaccines": [{ "id": "uuid", "name": "BCG", "facilityId": "uuid", "createdAt": "ISO 8601" }] }
```

### `GET /api/dashboard`
Stock dashboard rows and a status summary across **every** facility and district, all at once — see §Facility Supervisor below for the full row/summary shape, identical across roles, just scoped differently.

### `GET /api/audit-log`
The entire audit log, unscoped — every mutation any user has ever made. Row shape: see §Facility Supervisor below.

---

## 3. District Supervisor

**Scope:** one district — `districtId` is set, `facilityId` is `null`.

**Functionality:** builds out their own district (creates facilities, creates the `facility_supervisor` for each one — at most one active supervisor per facility, enforced server-side), manages/renames/deletes facilities within it, and can view a drill-down detail of any facility in their district. **Cannot** create a district, a `district_supervisor`, or a `facility_worker` account. Cannot record a stock entry or edit a threshold. Cannot see anything outside their own district.

### `GET /api/districts`
```json
// 200 — a one-item list: just their own district
{ "districts": [{ "id": "uuid", "name": "...", "isActive": true, "createdAt": "ISO 8601" }] }
```

### `POST /api/facilities`
`districtId` is forced server-side to their own — never taken from the request. Clones the default starter vaccine set (BCG, OPV, Pentavalent, Measles, PCV) into the new facility, each with a threshold row defaulted to `minQuantity: 0`.
```jsonc
// request
{ "name": "AKUH Main Campus" }
// 201
{ "facility": { "id": "uuid", "name": "AKUH Main Campus", "districtId": "uuid", "isActive": true, "createdAt": "ISO 8601" } }
```

### `GET /api/facilities`
```json
// 200 — every facility within their own district, including soft-deleted ones
{ "facilities": [{ "id": "uuid", "name": "...", "districtId": "uuid", "isActive": true, "createdAt": "ISO 8601", "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null" }] }
```

### `GET /api/facilities/:id` 🆕
Drill-down: facility metadata + its full vaccine/stock list + a status rollup, for a facility within their own district.
```json
// 200
{
  "facility": {
    "id": "uuid", "name": "AKUH Main Campus", "districtId": "uuid", "districtName": "Karachi Central",
    "isActive": true, "createdAt": "ISO 8601",
    "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null",
    "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 },
    "vaccines": [
      { "thresholdId": "uuid", "vaccineId": "uuid", "vaccineName": "BCG", "minQuantity": 20, "quantity": 8, "recordedAt": "ISO 8601 | null", "status": "critical" }
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
{ "users": [{ "id": "uuid", "email": "...", "name": "...", "role": "facility_supervisor", "districtId": "uuid", "districtName": "...", "facilityId": "uuid", "facilityName": "...", "isActive": true }] }
```

### `POST /api/users`
Creates a `facility_supervisor` account for a facility already in their own district.
```jsonc
// request
{ "email": "fs@akuh.pilot", "password": "min 8 chars", "name": "Display Name", "role": "facility_supervisor", "facilityId": "uuid" }
// 201
{ "user": { "id": "uuid", "email": "...", "name": "...", "role": "facility_supervisor", "districtId": "uuid", "facilityId": "uuid", "isActive": true } }
// 400 — facilityId missing/unknown/soft-deleted, or outside their own district
// 409
{ "error": "Facility already has an active supervisor" } // 🆕 — that facility already has a different active facility_supervisor
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
`summary` 🆕 — additive, alongside the unchanged `facilities` array. `districtCount` is always `1` for this role. Use `summary.byFacility` to show which facility needs attention at a glance instead of deriving it from the flat row list yourself. `status` values changed 🆕: `critical`/`low`/`adequate` (was `red`/`amber`/`green`), `no_data` unchanged.

### `GET /api/audit-log`
```json
// 200 — every mutation whose owning district matches theirs, newest first
{ "auditLog": [{ "id": "uuid", "actorId": "uuid", "actorName": "...", "actorRole": "...", "action": "...", "entityType": "...", "entityId": "uuid | null", "districtId": "uuid | null", "districtName": "string | null", "facilityId": "uuid | null", "facilityName": "string | null", "details": {}, "createdAt": "ISO 8601" }] }
```

---

## 4. Facility Supervisor

**Scope:** one facility within one district — both `districtId` and `facilityId` are set. **A facility can only ever have one active Facility Supervisor at a time.**

**Functionality:** runs day-to-day operations for their one facility — creates `facility_worker` accounts, records stock **received**, manages their facility's vaccine list (add/rename/**delete** 🆕), is the only role that can edit a threshold or **directly correct a vaccine's current stock count** 🆕. **Never records "used" stock.**

### `GET /api/users`
```json
// 200 — the facility_workers they've created
{ "users": [{ "id": "uuid", "email": "...", "name": "...", "role": "facility_worker", "districtId": "uuid", "districtName": "...", "facilityId": "uuid", "facilityName": "...", "isActive": true }] }
```

### `POST /api/users`
`facilityId` forced to their own; the new `facility_worker`'s `districtId` is also forced to the caller's own district 🆕 (previously `null` by design — reversed).
```jsonc
// request
{ "email": "worker@akuh.pilot", "password": "min 8 chars", "name": "Display Name", "role": "facility_worker" }
// 201
{ "user": { "id": "uuid", "email": "...", "name": "...", "role": "facility_worker", "districtId": "uuid", "facilityId": "uuid", "isActive": true } }
```

### `PUT /api/users/:id/deactivate` / `:id/activate` / `:id/reset-password`
Scoped to a `facility_worker` whose `facilityId` matches their own — `403` otherwise, or on anyone at/above their own level.

### `POST /api/stock-entries`
Always recorded as `"received"` for this role — adds to the facility's running balance.
```jsonc
// request
{ "vaccineId": "uuid", "quantity": 50 }
// 201
{ "entry": { "id": "uuid", "facilityId": "uuid", "vaccineId": "uuid", "quantity": 50, "entryType": "received", "recordedBy": "uuid", "createdAt": "ISO 8601" } }
```

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
```jsonc
// request
{ "name": "Rotavirus", "minQuantity": 0 } // minQuantity optional
// 201
{ "vaccine": { "id": "uuid", "name": "Rotavirus", "facilityId": "uuid", "createdAt": "ISO 8601" } }
// 409 — duplicate name at this facility
```

### `PUT /api/vaccines/:id`
```jsonc
// request
{ "name": "New Name" }
// 200 — same shape as POST's vaccine object
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
  "facilities": [{ "thresholdId": "uuid", "facilityId": "uuid", "facilityName": "...", "districtId": "uuid", "districtName": "...", "vaccineId": "uuid", "vaccineName": "...", "minQuantity": 20, "quantity": 15, "recordedAt": "ISO 8601 | null", "status": "critical | low | adequate | no_data" }],
  "summary": { "districtCount": 1, "facilityCount": 1, "statusCounts": { "critical": 0, "low": 1, "adequate": 4, "no_data": 0 }, "byFacility": [{ "facilityId": "uuid", "facilityName": "...", "districtId": "uuid", "statusCounts": { "critical": 0, "low": 1, "adequate": 4, "no_data": 0 } }] }
}
```
`status` values 🆕: `critical`/`low`/`adequate`/`no_data` (was `red`/`amber`/`green`/`no_data`). `summary` 🆕 — for this role it's just their one facility's own numbers restated, included for shape-consistency across roles.

### `GET /api/audit-log`
```json
// 200 — their own actions plus their own facility_workers', at their own facility only
{ "auditLog": [{ "id": "uuid", "actorId": "uuid", "actorName": "...", "actorRole": "...", "action": "STOCK_ENTRY", "entityType": "stock_entry", "entityId": "uuid", "districtId": "uuid", "districtName": "...", "facilityId": "uuid", "facilityName": "...", "details": { "vaccineId": "uuid", "vaccineName": "BCG", "quantity": 50, "entryType": "received" }, "createdAt": "ISO 8601" }] }
```

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
- **A request body can never grant more than the caller's own role allows.** Submitting `"role": "super_admin"` in a `POST /api/users` body from a facility_supervisor session just gets rejected — the creatable role and scope (`districtId`/`facilityId`) always come from the caller's own verified session, never from what the client sends. The same rule applies to `POST /api/stock-entries`'s `entryType`, forced from the caller's role.
- **Deactivation and password reset always follow the same one-level-down cascade as account creation** — enforced server-side after loading the target row, never inferred from the request URL alone.
- **A facility's active Facility Supervisor is unique, enforced at the DB level** — any attempt to have two produces a `409`, whether via `POST /api/users` or `PUT /api/users/:id/activate`.
- **Districts and facilities soft-delete, never hard-delete** — `isActive: false`, blocked with `409` while active children exist. Deleted rows keep appearing in their own `GET`/list endpoints (unfiltered by design) but disappear from `GET /api/dashboard`.
- **Every write, from every role, produces exactly one audit log row.**
- **No self-serve anything** — no signup, no "forgot password" flow, no self-deactivation. Every account is created by exactly one role above it in the cascade.
- Common error codes across all endpoints: `400` (validation/bad id), `401` (no/expired/revoked session — re-authenticate, don't retry), `403` (wrong role, wrong scope, or missing/invalid CSRF token), `404` (not found), `409` (duplicate or business-rule conflict), `429` (rate limited).

---

## Related docs

- `docs/api-reference.md` — the flat, endpoint-first request/response JSON contract, plus auth code samples and a full data-model reference.
- `FRONTEND_HANDOFF.md` — the round-by-round changelog of backend changes, framed as "what's different from what you may have already built."
- `docs/functionality.md` — the same role breakdown as this doc, in more narrative detail.
- `users.md` (ask Ahmed — gitignored, contains real passwords) — one working login per role to test against immediately.
