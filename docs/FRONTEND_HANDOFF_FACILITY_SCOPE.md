# Frontend Handoff — Facility Supervisor / Facility Worker Scope Changes

For the Claude Code session working on the **frontend** repo. This is a focused changelog for one specific backend change, not a general API doc — read `API_DOCUMENTATION.md` and `docs/api-reference.md` in this docs folder for the full contract; this doc only covers what's *different* from what you may have already built against.


---

## Why this changed

Manual role-by-role testing of the Facility Supervisor screens surfaced that the original spec (Facility Supervisor records one kind of "stock count") didn't match the real intended workflow: a Facility Supervisor logs *stock received from the district*, and a Facility Worker separately logs *stock used/administered* — two different movements on the same running balance, not one. That, plus three related asks (Facility Supervisor manages their own facility's vaccine list, sees their own workers' audit trail, and the dashboard shows which facility/district a user belongs to), drove the changes below.

---

## Breaking changes — check these before assuming old code still works

### 1. `POST /api/stock-entries` — the `quantity` field no longer means "current count"

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

### 2. `GET /api/dashboard` — `quantity` is now a running balance

Same field name, different meaning: `quantity` is now `SUM(received) − SUM(used)` for that facility/vaccine, not "the last entry." If your UI treated it as a point-in-time snapshot, no change needed — it still represents "current stock," just computed differently server-side. `status` (`red`/`amber`/`green`/`no_data`) is unaffected.

**New field:** `districtName` (string), alongside the existing `facilityName`. Use both to show a Facility Supervisor/Worker which facility and district they're part of — this was one of the explicit asks.

### 3. `GET /api/vaccines` — no longer one shared list

**Before:** every facility saw the same 5 vaccines (BCG, OPV, Pentavalent, Measles, PCV), and the response had no `facilityId`.
**Now:** each facility has its **own independent** vaccine list (still seeded with those same 5 names by default, but a Facility Supervisor can add to or rename their own facility's list without touching anyone else's). Response rows now include `facilityId`.

Practical effect for you: nothing changes about *how* you call `GET /api/vaccines` — it's still scoped server-side to whatever the caller is allowed to see. But if you cached vaccine names/ids as global constants anywhere in the frontend, stop — always fetch them per-session, since two facilities can now have vaccines with the same name but different ids, and a given vaccine id only belongs to one facility.

### 4. `GET /api/audit-log` — Facility Supervisor can now call this (previously a hard `403`)

Scope is narrow and specific: a Facility Supervisor sees **only rows where the actor is one of their own Facility Workers** — not their own actions (their own `received` entries, threshold edits, worker account creation don't appear here). This is intentional, not a bug: it's meant to answer "what have my workers been doing," not "show me everything about my facility."

---

## New endpoints — Facility Supervisor only

### `POST /api/vaccines`
```jsonc
// request
{ "name": "Rotavirus", "minQuantity": 0 } // minQuantity optional, defaults to 0
// 201 response
{ "vaccine": { "id": "uuid", "name": "Rotavirus", "facilityId": "uuid", "createdAt": "ISO 8601" } }
```
`409` if a vaccine with this name already exists **at this facility** (same name at a different facility is fine — no collision).

### `PUT /api/vaccines/:id`
```jsonc
// request
{ "name": "New Name" }
// 200 response
{ "vaccine": { "id": "uuid", "name": "New Name", "facilityId": "uuid", "createdAt": "ISO 8601" } }
```
`403` if the vaccine belongs to another facility (even if you have its id). `404` if it doesn't exist. `409` on a name collision within the same facility.

Both require the standard `x-csrf-token` header like any other mutating route.

---

## What this means for each screen

### Facility Supervisor
- **Stock entry form**: reframe as "Record stock received" — no type selector needed, the backend already knows this caller only ever adds stock. Remove any UI that let a Facility Supervisor pick "received vs. used."
- **New: vaccine management.** Needs a screen (or a section of the existing threshold-management screen) to add a new vaccine and rename an existing one, scoped to their own facility. `POST`/`PUT /api/vaccines` above.
- **New: audit log view.** A read-only list of their Facility Workers' actions — `GET /api/audit-log`, same response shape as the district_supervisor's view you may have already built, just narrower scope.
- **Dashboard**: display `facilityName` and the new `districtName`.

### Facility Worker
- **Stock entry form**: reframe as "Record stock used." The vaccine dropdown should be populated from `GET /api/vaccines` (their own facility's list, set by their supervisor) and, for each option, show the current remaining stock — pull that from `GET /api/dashboard`'s per-vaccine `quantity` for this facility and join it into the dropdown display.
- **Handle the insufficient-stock error**: if `POST /api/stock-entries` returns `400` with `{ "error": "Insufficient stock", "available": N }`, show the user "only N left" rather than a generic failure message.
- **Dashboard/login screen**: already shows `facilityName` and current stock per vaccine (this didn't change) — no districtName needed here, a Facility Worker's token has no `districtId` by design.
- No change to account/threshold/vaccine-management access — still none of that, unchanged.

---

## Reference

- `API_DOCUMENTATION.md` (backend repo root) — full role-grouped capability list, now updated to match this doc.
- `docs/api-reference.md` (backend repo) — the concrete JSON contract for every endpoint, including the ones above.
