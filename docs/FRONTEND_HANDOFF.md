# Frontend Handoff — Backend Changes

For the Claude Code session working on the **frontend** repo. This is a focused changelog for backend changes across six rounds of work, not a general API doc — read `API_DOCUMENTATION.md` and `docs/api-reference.md` in this backend repo for the full contract; this doc only covers what's *different* from what you may have already built against.

**Status as of this doc:** Rounds 1–5 are committed, passing the full backend test suite, and deployed/verified live on `https://smart-stock-alert-be.vercel.app`. **Round 6 is implemented and the full backend test suite (92/92) passes locally, but it is not yet committed or deployed** — see Round 6 below before building against it, and note that the live deployed backend does not yet have these changes.

---

## Why this changed

Manual role-by-role testing of the Facility Supervisor screens surfaced that the original spec (Facility Supervisor records one kind of "stock count") didn't match the real intended workflow: a Facility Supervisor logs *stock received from the district*, and a Facility Worker separately logs *stock used/administered* — two different movements on the same running balance, not one. That, plus three related asks (Facility Supervisor manages their own facility's vaccine list, sees their own workers' audit trail, and the dashboard shows which facility/district a user belongs to), drove **Round 1** below.

Continued role-by-role testing then surfaced two more rounds: every account needs a display `name` and a way to reactivate a deactivated one (**Round 2**), and the audit log needed human-readable actor/scope info instead of raw ids, plus a small widening of what a Facility Supervisor can see there (**Round 3**).

The next round of testing asked for delete/rename on every entity in the hierarchy (vaccines, facilities, districts) and a way to correct a facility's stock count directly, plus three smaller gaps: a Facility Worker's own district wasn't visible, `GET /api/users` only returned ids not names, and some audit log rows were missing enough detail to be useful (**Round 4**).

District Supervisor/Super Admin testing then surfaced that `GET /api/dashboard` had no aggregation — a District Supervisor scanning for trouble had to eyeball every facility/vaccine row instead of seeing at a glance which facility needed attention, and there was no drill-down from an overview into one facility's (or one district's) full detail. That, plus `GET /api/facilities` not showing who's staffing each facility, and a real gap where nothing stopped two active Facility Supervisor accounts existing for the same facility, drove **Round 5** below.

---

## Round 1 — stock movement split, facility-scoped vaccines, audit log for Facility Supervisor

### Breaking changes — check these before assuming old code still works

#### 1. `POST /api/stock-entries` — the `quantity` field no longer means "current count"

**Before:** each entry was an absolute snapshot; the *latest* entry was "current stock."
**Now:** every entry is a movement. Which direction is **derived from who's logged in** — you don't send it, and if you do send an `entryType` field it's silently ignored:

| Caller | Always recorded as | Effect |
|---|---|---|
| `facility_supervisor` | `"received"` | adds to the facility's stock |
| `facility_worker` | `"used"` | subtracts from the facility's stock |

Request body is unchanged: `{ "vaccineId": "uuid", "quantity": 0 }`. Response now includes `entryType` in the returned `entry` object.

**New failure mode — Facility Worker only:** if `quantity` would take the balance below zero, you get back:
```json
// 400
{ "error": "Insufficient stock", "available": 12 }
```
Use `available` to tell the user how many doses are actually left, rather than a generic error. This is the authoritative check — enforce it server-side only; a client-side pre-check (disabling submit past the known stock) is a nice UX touch but not required for correctness.

#### 2. `GET /api/dashboard` — `quantity` is now a running balance

Same field name, different meaning: `quantity` is now `SUM(received) − SUM(used)` for that facility/vaccine, not "the last entry." If your UI treated it as a point-in-time snapshot, no change needed — it still represents "current stock," just computed differently server-side. `status` (`red`/`amber`/`green`/`no_data`) is unaffected by this specific change — **but see Round 5 below, which renames these values entirely.** Don't build against `red`/`amber`/`green` for new code; that's stale as of Round 5.

**New field:** `districtName` (string), alongside the existing `facilityName`. Use both to show a Facility Supervisor/Worker which facility and district they're part of — this was one of the explicit asks.

#### 3. `GET /api/vaccines` — no longer one shared list

**Before:** every facility saw the same 5 vaccines (BCG, OPV, Pentavalent, Measles, PCV), and the response had no `facilityId`.
**Now:** each facility has its **own independent** vaccine list (still seeded with those same 5 names by default, but a Facility Supervisor can add to or rename their own facility's list without touching anyone else's). Response rows now include `facilityId`.

Practical effect for you: nothing changes about *how* you call `GET /api/vaccines` — it's still scoped server-side to whatever the caller is allowed to see. But if you cached vaccine names/ids as global constants anywhere in the frontend, stop — always fetch them per-session, since two facilities can now have vaccines with the same name but different ids, and a given vaccine id only belongs to one facility.

#### 4. `GET /api/audit-log` — Facility Supervisor can now call this (previously a hard `403`)

Scope as originally shipped: a Facility Supervisor saw only their own Facility Workers' actions, not their own. **This has since changed — see Round 3 below, which is the current, correct behavior.** Don't build against "own actions excluded"; that's stale.

### New endpoints — Facility Supervisor only

#### `POST /api/vaccines`
```jsonc
// request
{ "name": "Rotavirus", "minQuantity": 0 } // minQuantity optional, defaults to 0
// 201 response
{ "vaccine": { "id": "uuid", "name": "Rotavirus", "facilityId": "uuid", "createdAt": "ISO 8601" } }
```
`409` if a vaccine with this name already exists **at this facility** (same name at a different facility is fine — no collision).

#### `PUT /api/vaccines/:id`
```jsonc
// request
{ "name": "New Name" }
// 200 response
{ "vaccine": { "id": "uuid", "name": "New Name", "facilityId": "uuid", "createdAt": "ISO 8601" } }
```
`403` if the vaccine belongs to another facility (even if you have its id). `404` if it doesn't exist. `409` on a name collision within the same facility.

Both require the standard `x-csrf-token` header like any other mutating route.

---

## Round 2 — required `name` field + account reactivation

### Breaking change: `POST /api/users` now requires `name`

**Every account, every role** created via `POST /api/users` must include a `name` (plain free-text display string, no format requirements beyond non-empty, max 120 chars):
```jsonc
// request
{ "email": "...", "password": "...", "name": "Jane Doe", "role": "...", /* districtId/facilityId as applicable */ }
```
Omitting it now gets a `400` from zod validation before any DB call runs. **Every create-user form in the frontend (super_admin→district_supervisor, district_supervisor→facility_supervisor, facility_supervisor→facility_worker) needs a "Name" input added, or account creation breaks for every role as of this deploy.**

### `name` now appears everywhere a user object comes back

- **Login response**: `user.name` — use this for the sidebar/dashboard display name instead of falling back to email.
- **`GET /api/users`**: each row now includes `name`.
- **`POST /api/users`, deactivate/activate/reset-password responses**: the returned `user` object includes `name`.

Pre-existing accounts (created before this shipped) were backfilled with a name derived from their email's local part (e.g. `fs.demo@akuh.pilot` → `fs.demo`) — expect to see those placeholder-looking names on old demo accounts until someone edits them; there is currently no "edit my name" endpoint, only set-at-creation.

### New endpoint: `PUT /api/users/:id/activate`

Reverses a deactivation. Same cascade/scope rules as `PUT /api/users/:id/deactivate` (super_admin unscoped; district_supervisor → their own facility_supervisors; facility_supervisor → their own facility_workers):
```jsonc
// 200 response
{ "user": { "id": "uuid", "email": "...", "name": "...", "role": "...", "isActive": true, /* ... */ } }
```
`403` outside the caller's cascade, `404` on an unknown id. Requires `x-csrf-token` like any other mutating route. Add an "Activate" action to every user-management screen, shown only when `isActive === false` (mirroring where "Deactivate" is shown only when `isActive === true`).

Note: a reactivated user must log in again to get a working session — reactivation does **not** restore any session/token that existed before the deactivation; that stays invalid permanently.

---

## Round 3 — audit log: readable actor/scope fields + Facility Supervisor sees own actions

### `GET /api/audit-log` response rows are now enriched — supersedes Round 1's §4 above

Every row across every role's view now includes, in addition to the existing `actorId`/`districtId`/`facilityId`:

```jsonc
{
  "id": "uuid",
  "actorId": "uuid",
  "actorName": "string",       // NEW
  "actorRole": "super_admin | district_supervisor | facility_supervisor | facility_worker", // NEW
  "action": "...",
  "entityType": "...",
  "entityId": "uuid | null",
  "districtId": "uuid | null",
  "districtName": "string | null", // NEW
  "facilityId": "uuid | null",
  "facilityName": "string | null", // NEW
  "details": { "...": "unchanged" },
  "createdAt": "ISO 8601"
}
```
Render `actorName`/`actorRole` instead of the raw `actorId`, and `districtName`/`facilityName` instead of raw ids, wherever the audit log is displayed (super_admin's unscoped view, district_supervisor's district view, facility_supervisor's facility view). `districtName`/`facilityName` reflect the *event's* owning district/facility, not necessarily the actor's own — e.g. a `district_supervisor`'s `CREATE_FACILITY` row will show that facility's name even though the actor's own token has no `facilityId`. `facilityName` is `null` for district-level actions (e.g. `CREATE_DISTRICT`).

### Breaking change (in the "your test data will look different" sense): Facility Supervisor now sees their own actions too

**Before (Round 1):** Facility Supervisor's audit view excluded their own writes — only Facility Workers' actions showed up.
**Now:** Facility Supervisor sees **their own actions plus their own Facility Workers'** — e.g. their own `received` stock entries, their own vaccine adds/renames, their own worker-account creations now appear alongside their workers' `used` entries. Still scoped to their own facility only; still never shows a district_supervisor's actions on that facility (e.g. the facility's own creation).

If you built the Facility Supervisor's audit screen assuming "only my workers, never me," update that assumption — no other role's scope changed.

---

## What this means for each screen

### Every role (Round 2)
- **Any create-account form** needs a required "Name" field — this is universal, not role-specific.
- **Sidebar/header/dashboard**: show the logged-in user's `name` (from the login response), not just email.
- **User-management list/table**: add a "Name" column; add an "Activate" action next to "Deactivate", toggled by `isActive`.

### Super Admin (Round 5)
- **District list/overview**: `GET /api/districts` stays a flat list — for a per-district health view (facility count + status breakdown), use the new `GET /api/districts/:id` drill-down instead of computing it client-side.
- **District detail screen**: new — `GET /api/districts/:id` gives you the facility list (with supervisor names) and status rollup for one district in a single call. This is also the one place that shows a facility with zero vaccines configured yet (the dashboard's `summary.byFacility` silently omits those).
- **Facility detail screen**: same idea, one level down — `GET /api/facilities/:id`.
- **Dashboard**: `status` values changed (`critical`/`low`/`adequate`, not `red`/`amber`/`green`) — update any hardcoded string comparisons or color-mapping switch statements.

### District Supervisor (Round 5)
- **District dashboard/overview**: `GET /api/dashboard`'s new `summary` block (`facilityCount`, `statusCounts`, `byFacility`) is what a top-of-page "state of my district" summary should be built from, instead of aggregating the flat `facilities` array yourself.
- **Facility list**: `GET /api/facilities` now includes `facilitySupervisorId`/`facilitySupervisorName` — show a "staffed/unstaffed" indicator without a second lookup.
- **Facility detail screen**: new — `GET /api/facilities/:id` for a drill-down from the list/overview into one facility's full vaccine/stock detail.
- **Creating/reassigning a Facility Supervisor**: check `facilitySupervisorId` isn't already set before offering "create" for a facility — creating a second one now `409`s (see below). Offer "replace" (deactivate current, then create) instead of a raw create action when one already exists.
- **Facility/district management (Round 4)**: rename, soft-delete ("Deactivate"), and reactivate actions for facilities they manage — `PUT /api/facilities/:id`, `DELETE /api/facilities/:id`, `PUT /api/facilities/:id/activate`.

### Facility Supervisor
- **Stock entry form**: reframe as "Record stock received" — no type selector needed, the backend already knows this caller only ever adds stock. Remove any UI that let a Facility Supervisor pick "received vs. used."
- **Vaccine management.** A screen (or section of the existing threshold-management screen) to add, rename, or **delete** (Round 4) a vaccine, scoped to their own facility. `POST`/`PUT`/`DELETE /api/vaccines`, plus `PUT /api/vaccines/:id/stock` (Round 4) for a direct stock correction ("edit current count" rather than logging another received/used entry).
- **Audit log view.** Now shows their own actions plus their Facility Workers' (Round 3) — same response shape as the district_supervisor's view, just narrower scope, and now enriched with `actorName`/`actorRole`/`districtName`/`facilityName`.
- **Dashboard**: display `facilityName` and `districtName`. `status` values changed (Round 5) — `critical`/`low`/`adequate`, not `red`/`amber`/`green`.

### Facility Worker
- **Stock entry form**: reframe as "Record stock used." The vaccine dropdown should be populated from `GET /api/vaccines` (their own facility's list, set by their supervisor) and, for each option, show the current remaining stock — pull that from `GET /api/dashboard`'s per-vaccine `quantity` for this facility and join it into the dropdown display.
- **Handle the insufficient-stock error**: if `POST /api/stock-entries` returns `400` with `{ "error": "Insufficient stock", "available": N }`, show the user "only N left" rather than a generic failure message.
- **Dashboard/login screen**: already shows `facilityName` and current stock per vaccine (this didn't change). `districtId`/`districtName` is now also populated for new Facility Worker accounts (Round 4) — see below — so it's fine to show it here now too if useful, though it was never required. `status` values changed (Round 5) — `critical`/`low`/`adequate`, not `red`/`amber`/`green` — update if this screen renders a status badge.
- No change to account/threshold/vaccine-management/audit-log access — still none of that, unchanged.

---

## Round 4 — delete/rename for vaccines, facilities, districts; stock correction; smaller gaps

**Deployed and verified live.**

### New endpoints — Facility Supervisor: vaccines

#### `DELETE /api/vaccines/:id`
Real delete — the vaccine row is actually removed, not soft-deleted. `204` with no body on success. **`409` if the vaccine has any recorded stock history** (any `POST /api/stock-entries` or stock-correction entry ever made against it) — stock history is permanent and append-only, so a vaccine that's ever had activity can't be deleted, only left alone. `403` if it belongs to another facility, `404` if unknown.

Practical effect: only offer a delete action for vaccines with no stock activity yet (e.g. freshly added, never used) — for anything else, disable/hide the delete button. There's no way to force it from the frontend; the 409 is authoritative.

#### `PUT /api/vaccines/:id/stock` — "edit current stock"
```jsonc
// request — the NEW total, not a delta
{ "quantity": 47 }
// 200 response, correction actually applied
{ "vaccineId": "uuid", "balance": 47, "entry": { "id": "uuid", "entryType": "adjustment_increase" | "adjustment_decrease", "quantity": 12, /* ... */ } }
// 200 response, submitted quantity equals the current balance — no-op, no `entry` key
{ "vaccineId": "uuid", "balance": 47 }
```
You send the number the stock *should* be; the backend computes the difference against the live balance and records it as a correction. `entryType` will be one of two new values (`adjustment_increase`/`adjustment_decrease`) alongside the existing `received`/`used`/`legacy` — if you have any UI that renders/labels `entryType` (e.g. the audit log), handle these two as well, probably as "Stock correction (+)" / "Stock correction (−)". `403` cross-facility, `404` unknown vaccine. `quantity` must be a non-negative integer (same validation as everywhere else stock quantities appear).

This also means `GET /api/dashboard`'s `quantity` and any insufficient-stock check now factor in corrections automatically — nothing else to change there.

### New endpoints — District Supervisor / Super Admin: facilities and districts

Facilities and districts are **soft-deleted**, not actually removed — real history (vaccines, thresholds, stock entries, users) hangs off them and can't just disappear. "Delete" flips an `isActive` flag to `false`; "activate" flips it back. Both objects now include `isActive` (boolean) in every response that returns them.

#### `PUT /api/facilities/:id` (super_admin, district_supervisor — own district only)
```jsonc
// request
{ "name": "New Facility Name" }
// 200 response
{ "facility": { "id": "uuid", "name": "...", "districtId": "uuid", "isActive": true, "createdAt": "ISO 8601" } }
```
`403` if a district_supervisor targets a facility outside their own district. `404` unknown id.

#### `DELETE /api/facilities/:id` (super_admin, district_supervisor — own district only)
Soft-delete. `200` with the updated (now `isActive: false`) facility on success. **`409` if the facility still has any active user** (facility_supervisor or facility_worker) — deactivate them first via the existing `PUT /api/users/:id/deactivate`, then retry. `403`/`404` same as above.

A soft-deleted facility **disappears from `GET /api/dashboard`** (it's an operational view — no reason to monitor something deleted) but **still appears in `GET /api/facilities`** (that list intentionally returns everything, active or not — same as `GET /api/users` already does — so it can be reactivated, and so history/reporting screens aren't missing rows). **Filter any facility picker (e.g. choosing a facility when creating a district_supervisor-scoped user) to `isActive === true`** — the backend will otherwise reject creating a new user against an inactive facility with a `400`, but a picker shouldn't offer it in the first place.

#### `PUT /api/facilities/:id/activate` (super_admin, district_supervisor — own district only)
Reverses the soft-delete. Same shape/response as deactivate, `isActive: true` again. `403`/`404` same rules.

#### `PUT /api/districts/:id` (super_admin only)
```jsonc
// request
{ "name": "New District Name" }
// 200 response
{ "district": { "id": "uuid", "name": "...", "isActive": true, "createdAt": "ISO 8601" } }
```
`403` for any non-super_admin. `404` unknown id. `409` if the new name collides with another district's name (district names are globally unique).

#### `DELETE /api/districts/:id` (super_admin only)
Soft-delete. `200` on success. **`409` if the district still has any active facility, or any active user** (its own district_supervisor accounts) — clear those first (deactivate the users, soft-delete the facilities). Same `GET` visibility rules as facilities: gone from anything scoped through an active-facilities filter, still listed by `GET /api/districts`.

#### `PUT /api/districts/:id/activate` (super_admin only)
Reverses the soft-delete.

### Smaller fixes bundled into this round

#### 1. Facility Worker accounts now have a real `districtId`
**Before:** a new Facility Worker's `districtId` was always `null` (by original design — "not needed at this scope"). **Now:** it's set to their facility's owning district at creation time, same as every other role — appears in the `POST /api/users` response, the login response, and `GET /api/users` rows. Accounts created before this shipped were backfilled on the shared dev DB, so you shouldn't see stray nulls there, but don't rely on it being non-null for logic that predates this change (defensive `?? null` handling is still fine).

#### 2. `GET /api/users` now includes `districtName`/`facilityName`
Same enrichment the audit log already got in Round 3, now on the user list too:
```jsonc
{ "id": "uuid", "email": "...", "name": "...", "role": "...", "districtId": "uuid | null", "districtName": "string | null", "facilityId": "uuid | null", "facilityName": "string | null", "isActive": true }
```
Use these instead of a separate district/facility lookup anywhere you render a user list/table.

#### 3. Audit log `details` is now more useful for two existing action types
- **`DEACTIVATE_USER` / `ACTIVATE_USER` / `RESET_PASSWORD`**: `details` now includes `{ "email": "...", "name": "..." }` for the affected user — previously `null`. Use this to render "Jane Doe (jane@...) was deactivated" instead of just an opaque entity id.
- **`STOCK_ENTRY`**: `details` now includes `vaccineName` alongside the existing `vaccineId`/`quantity`/`entryType`. New **`ADJUST_STOCK`** action (from the stock-correction endpoint above) has `details: { vaccineId, vaccineName, previousBalance, newBalance, delta }`.

---

## Round 5 — dashboard status rename + summary, facility drill-down endpoints, one-supervisor-per-facility

**Deployed and verified live.**

### Breaking change: `GET /api/dashboard`'s `status` values

**Before:** `"red" | "amber" | "green" | "no_data"`.
**Now:** `"critical" | "low" | "adequate" | "no_data"` — same banding logic (`no_data` if `quantity` is `null`, `critical` if under `minQuantity`, `low` if under `minQuantity * 1.2`, else `adequate`), just relabeled to domain vocabulary instead of a color, so the frontend owns the color mapping instead of the backend baking one in. **If you render/compare these strings anywhere (status badges, filters, tests), update them** — `red`/`amber`/`green` will simply never appear again.

### New: `GET /api/dashboard` returns a `summary` block

Additive — the existing `facilities` array is completely unchanged in shape, this is a new sibling key:
```jsonc
{
  "facilities": [ /* unchanged */ ],
  "summary": {
    "districtCount": 1,        // always 1 for a district_supervisor (their own district)
    "facilityCount": 6,        // facilities that have at least one dashboard row — see note below
    "statusCounts": { "critical": 3, "low": 5, "adequate": 18, "no_data": 2 },
    "byFacility": [
      { "facilityId": "uuid", "facilityName": "...", "districtId": "uuid", "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 } }
    ]
  }
}
```
This is what answers "which facility has low/critical stock" — use `summary.byFacility` instead of grouping the flat `facilities` array yourself. **Caveat:** `summary.facilityCount`/`byFacility` are derived from the same rows as `facilities`, so a facility with zero vaccines configured yet won't appear in `byFacility` at all (it contributes zero rows). If you need every facility to show up regardless — e.g. a district overview that shouldn't silently omit a brand-new, unconfigured facility — use the new `GET /api/districts/:id` below instead, which doesn't have this blind spot.

### New endpoint: `GET /api/facilities/:id` — Super Admin / District Supervisor (own district)

Drill-down for one facility: metadata + its full vaccine/stock list + a status rollup, in one call — instead of fetching the whole scoped dashboard and filtering client-side to one `facilityId`.
```jsonc
// 200
{
  "facility": {
    "id": "uuid", "name": "AKUH Main Campus",
    "districtId": "uuid", "districtName": "Karachi Central",
    "isActive": true, "createdAt": "ISO 8601",
    "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null",
    "statusCounts": { "critical": 1, "low": 0, "adequate": 3, "no_data": 1 },
    "vaccines": [
      { "thresholdId": "uuid", "vaccineId": "uuid", "vaccineName": "BCG", "minQuantity": 20, "quantity": 8, "recordedAt": "ISO 8601 | null", "status": "critical" }
      // same row shape as GET /api/dashboard's facilities array, scoped to this one facility
    ]
  }
}
```
`403` if a district_supervisor targets a facility outside their own district, `404` if unknown. No `isActive` filtering — a soft-deleted facility is still fully viewable here (same as `GET /api/facilities`'s list). Not available to facility_supervisor/facility_worker — their own `GET /api/dashboard` already covers their one facility.

### New endpoint: `GET /api/districts/:id` — Super Admin only

Drill-down for one district: metadata + **every** facility in it (active and inactive, including ones with zero vaccines configured — this is the fix for the blind spot noted above) + a status rollup per facility + a district-wide rollup.
```jsonc
// 200
{
  "district": {
    "id": "uuid", "name": "Karachi Central", "isActive": true, "createdAt": "ISO 8601",
    "facilityCount": 6,
    "statusCounts": { "critical": 3, "low": 5, "adequate": 18, "no_data": 2 },
    "facilities": [
      { "id": "uuid", "name": "...", "isActive": true, "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null", "statusCounts": { "critical": 0, "low": 0, "adequate": 0, "no_data": 0 } }
      // a facility with statusCounts all zero has no vaccines configured yet — not an error, just unstaffed/unconfigured
    ]
  }
}
```
`403` for any non-super_admin (a district_supervisor already gets this same data for their own district via `GET /api/dashboard`'s `summary.byFacility`), `404` if unknown.

### New: `GET /api/facilities` now includes who's staffing each facility

```jsonc
{ "id": "uuid", "name": "...", "districtId": "uuid", "isActive": true, "createdAt": "ISO 8601", "facilitySupervisorId": "uuid | null", "facilitySupervisorName": "string | null" }
```
Both `null` if the facility currently has no active supervisor. Use this to show a "staffed / unstaffed" indicator in a facility list without a second lookup.

### New business rule: one active Facility Supervisor per facility, enforced server-side

**Before:** nothing stopped a District Supervisor creating multiple active `facility_supervisor` accounts for the same facility (this happened by accident during testing — 18 duplicate test accounts on the shared dev DB were cleaned up as part of shipping this).
**Now:** enforced at the database level. Two places can return a new `409`:

```jsonc
// POST /api/users (creating a facility_supervisor for a facility that already has an active one)
// PUT /api/users/:id/activate (reactivating one while a different one is now active at that facility)
{ "error": "Facility already has an active supervisor" }
```

**Practical UI implication:** when offering "create a Facility Supervisor" for a facility, check whether `GET /api/facilities`/`GET /api/facilities/:id` already shows a non-null `facilitySupervisorId` for it first — if so, either hide the create action or make clear the flow is "replace" (deactivate the current one, then create/reactivate the new one), rather than letting the user hit a raw `409`.

---

## Round 6 — district supervisor email/name on district endpoints, audit-log `?limit=N`, facility detail confirmation

Driven by your `docs/api-requirement.md` (four asks). One of the four was already done before you asked (see #3 below); the other three are new.

#### 1. `GET /api/districts` — new `supervisorName`/`supervisorEmail` fields

```jsonc
{
  "id": "uuid", "name": "North District", "createdAt": "ISO 8601", "isActive": true,
  "supervisorName": "Dr. Fatima Malik",   // null if the district has no active district_supervisor
  "supervisorEmail": "f.malik@akuh.pilot" // null if the district has no active district_supervisor
}
```

**One behind-the-scenes change this required, worth knowing about:** the backend now enforces at most one active `district_supervisor` per district (mirrors the existing one-active-`facility_supervisor`-per-facility rule from Round 5). If your dev/test data ever had two active district_supervisors for the same district, one was deactivated during this rollout — check with Ahmed if a district_supervisor login you were using stops working. Going forward, creating or reactivating a second one for the same district now returns:
```jsonc
// 409
{ "error": "District already has an active supervisor" }
```
same shape as the existing facility_supervisor version of this error.

#### 2. `GET /api/districts/:id` — new `facilitySupervisorEmail` field per facility

Added alongside the existing `facilitySupervisorName` in each `district.facilities[]` item. `null` when that facility has no active supervisor.

#### 3. `GET /api/facilities/:id` — already open to `district_supervisor`, no change shipped

This was already implemented in Round 5 (`assertCanManageFacility` scope enforcement) and already covered by a passing test. **One correction to your doc:** the 403 body for a district_supervisor requesting a facility outside their district is `{ "error": "Forbidden" }`, not `{ "error": "Access denied" }` — kept as `"Forbidden"` for consistency with every other 403 in this API rather than special-casing this one route. Update any code checking the exact error string.

#### 4. `GET /api/audit-log?limit=N` — new optional query param

```
GET /api/audit-log?limit=5
```
Caps the response to the `N` most recent rows (already ordered newest-first). Applies to all three roles that can call this endpoint (`super_admin`, `district_supervisor`, `facility_supervisor`). Omit it and you get today's unlimited behavior — no change needed if you don't adopt this right away. `limit` must be a positive integer (max 500); anything else (`0`, negative, non-numeric) returns `400`.

**Practical UI implication for `facility-supervisor/Dashboard.jsx`'s Recent Activity feed:** switch from `getAuditLog()` + `logs.slice(0, 5)` to `getAuditLog({ limit: 5 })` (or a new `getRecentActivity(limit)` helper) — saves transferring the whole log on every dashboard poll.

---

## Reference

- `API_DOCUMENTATION.md` (backend repo root) — full role-grouped capability list with inline request/response payloads, now updated to match this doc.
- `docs/api-reference.md` (backend repo) — the concrete JSON contract for every endpoint, including the ones above.
