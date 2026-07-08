# Frontend Handoff — Backend Changes

For the Claude Code session working on the **frontend** repo. This is a focused changelog for backend changes across three rounds of work, not a general API doc — read `API_DOCUMENTATION.md` and `docs/api-reference.md` in this backend repo for the full contract; this doc only covers what's *different* from what you may have already built against.

**Status as of this doc:** all three rounds below are implemented, passing the full backend test suite (61/61), committed, and **deployed and verified live** on `https://smart-stock-alert-be.vercel.app`. Safe to build against now.

---

## Why this changed

Manual role-by-role testing of the Facility Supervisor screens surfaced that the original spec (Facility Supervisor records one kind of "stock count") didn't match the real intended workflow: a Facility Supervisor logs *stock received from the district*, and a Facility Worker separately logs *stock used/administered* — two different movements on the same running balance, not one. That, plus three related asks (Facility Supervisor manages their own facility's vaccine list, sees their own workers' audit trail, and the dashboard shows which facility/district a user belongs to), drove **Round 1** below.

Continued role-by-role testing then surfaced two more rounds: every account needs a display `name` and a way to reactivate a deactivated one (**Round 2**), and the audit log needed human-readable actor/scope info instead of raw ids, plus a small widening of what a Facility Supervisor can see there (**Round 3**).

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

Same field name, different meaning: `quantity` is now `SUM(received) − SUM(used)` for that facility/vaccine, not "the last entry." If your UI treated it as a point-in-time snapshot, no change needed — it still represents "current stock," just computed differently server-side. `status` (`red`/`amber`/`green`/`no_data`) is unaffected.

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

### Facility Supervisor
- **Stock entry form**: reframe as "Record stock received" — no type selector needed, the backend already knows this caller only ever adds stock. Remove any UI that let a Facility Supervisor pick "received vs. used."
- **Vaccine management.** A screen (or section of the existing threshold-management screen) to add a new vaccine and rename an existing one, scoped to their own facility. `POST`/`PUT /api/vaccines` above.
- **Audit log view.** Now shows their own actions plus their Facility Workers' (Round 3) — same response shape as the district_supervisor's view, just narrower scope, and now enriched with `actorName`/`actorRole`/`districtName`/`facilityName`.
- **Dashboard**: display `facilityName` and `districtName`.

### Facility Worker
- **Stock entry form**: reframe as "Record stock used." The vaccine dropdown should be populated from `GET /api/vaccines` (their own facility's list, set by their supervisor) and, for each option, show the current remaining stock — pull that from `GET /api/dashboard`'s per-vaccine `quantity` for this facility and join it into the dropdown display.
- **Handle the insufficient-stock error**: if `POST /api/stock-entries` returns `400` with `{ "error": "Insufficient stock", "available": N }`, show the user "only N left" rather than a generic failure message.
- **Dashboard/login screen**: already shows `facilityName` and current stock per vaccine (this didn't change) — no districtName needed here, a Facility Worker's token has no `districtId` by design.
- No change to account/threshold/vaccine-management/audit-log access — still none of that, unchanged.

---

## Reference

- `API_DOCUMENTATION.md` (backend repo root) — full role-grouped capability list, now updated to match this doc.
- `docs/api-reference.md` (backend repo) — the concrete JSON contract for every endpoint, including the ones above.
