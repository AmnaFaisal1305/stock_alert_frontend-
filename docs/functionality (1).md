# Functionality — What Each Role Can Do

A plain, role-first breakdown of what the backend actually allows *today*, derived directly from the current code (`routes/**/index.js`, `api/_lib/rbac.js`), not from the original proposal. Where behavior has been extended past the original locked spec (`docs/smart-stock-alert-architecture.md`), that's called out explicitly. For request/response shapes, see `docs/api-reference.md`; this document answers "who can do what," not "how do I call it."

There are exactly **four roles**, in one strict, non-branching cascade:

```
super_admin → district_supervisor → facility_supervisor → facility_worker
```

Every user has exactly one role, set at account creation and never changed afterward (there is no "promote/demote a user's role" endpoint). A role's scope comes entirely from two token fields — `districtId` and `facilityId` — set once at creation and carried in every JWT the user is issued. Every account also has a required plain-text `name`, shown alongside `email` everywhere a user is listed.

---

## 1. Capability matrix

| Capability | `super_admin` | `district_supervisor` | `facility_supervisor` | `facility_worker` |
|---|---|---|---|---|
| Log in / log out | ✅ | ✅ | ✅ | ✅ |
| View dashboard (+ status summary) | ✅ every facility | ✅ own district only | ✅ own facility only | ✅ own facility only |
| View districts (+ active supervisor's name/email) | ✅ all | ✅ own district only | ❌ | ❌ |
| View one district's detail (its facilities + status rollup) | ✅ any | ❌ (own dashboard already covers it) | ❌ | ❌ |
| Create / rename / soft-delete / reactivate a district | ✅ | ❌ | ❌ | ❌ |
| View facilities (+ active supervisor's name/email) | ✅ all | ✅ own district's only | ❌ | ❌ |
| View one facility's detail (its vaccines + status rollup) | ✅ any | ✅ own district's only | ❌ (own dashboard already covers it) | ❌ |
| Create a facility | ✅ (any district) | ✅ (own district, forced) | ❌ | ❌ |
| Rename / soft-delete / reactivate a facility | ✅ any | ✅ own district's only | ❌ | ❌ |
| View vaccines (facility-scoped, not a shared list) | ✅ all | ✅ own district's facilities' | ✅ own facility's | ✅ own facility's |
| Add / rename / delete a vaccine (name restricted to the 13 defaults) | ❌ | ❌ | ✅ own facility only | ❌ |
| Correct a vaccine's current stock directly | ❌ | ❌ | ✅ own facility only | ❌ |
| View user accounts (+ phone/CNIC) | ✅ every user | ✅ own district's `facility_supervisor`s | ✅ own facility's `facility_worker`s | ❌ |
| Create a user account | ✅ → **any role directly**: `district_supervisor` / `facility_supervisor` / `facility_worker` (one active supervisor per district/facility) | ✅ → `facility_supervisor` (one active per facility) | ✅ → `facility_worker` | ❌ |
| Deactivate a user account | ✅ any user | ✅ own district's `facility_supervisor`s only | ✅ own facility's `facility_worker`s only | ❌ |
| Reactivate a deactivated user account | ✅ any user | ✅ own district's `facility_supervisor`s only | ✅ own facility's `facility_worker`s only | ❌ |
| Force-reset a user's password | ✅ any user | ✅ own district's `facility_supervisor`s only | ✅ own facility's `facility_worker`s only | ❌ |
| Record stock **received** from the district (batch metadata required) | ❌ | ❌ | ✅ own facility | ❌ |
| Record stock **returned** to the facility | ❌ | ❌ | ✅ own facility | ❌ |
| Record stock **used** | ❌ | ❌ | ❌ | ✅ own facility |
| Edit a threshold | ❌ | ❌ | ✅ own facility only | ❌ |
| View the audit log (`?limit=N` to cap results) | ✅ unscoped | ✅ own district only | ✅ **own actions + own `facility_worker`s' actions** | ❌ |
| Reset own password via email, self-serve, no admin involved | ✅ | ✅ | ✅ | ✅ |
| Receive a critical-stock alert email when a stock entry pushes a vaccine into `critical` | ✅ every episode, any facility | ✅ own district's facilities only | ✅ own facility only | ❌ never |

✅ = allowed, at the scope noted. ❌ = the backend rejects the request before any data is touched (`403 Forbidden`, checked at the role/scope layer — never merely "not shown in the UI").

---

## 2. Super Admin

The only unscoped role — `districtId` and `facilityId` are both `null` on this account.

**Can do:**
- Create a **district** (`POST /api/districts`).
- **Rename, soft-delete, or reactivate any district** (`PUT`/`DELETE`/`PUT /:id/activate /api/districts/:id`) — deletion is a soft flag (`isActive: false`), never a real row removal, and is refused (`409`) while the district still has any active facility or active user (its own `district_supervisor`).
- **Create a `district_supervisor`, `facility_supervisor`, or `facility_worker` account directly** (`POST /api/users`) — previously restricted to `district_supervisor` only; now accepts any of the three roles below super_admin in one call. Since super_admin has no district/facility of its own, `districtId`/`facilityId` are taken from the request body (validated as an existing, active district/facility before use — never trusted blindly). This exists to provision accounts directly from client-supplied profiles (name/email/CNIC/phone) without going through the cascade; the frontend only needs to expose the `district_supervisor` path today, the other two are available for a later phase. **A district may only ever have one active `district_supervisor`, and a facility only one active `facility_supervisor`, at a time** — attempting to create a second at either level gets a `409` naming which; deactivate the existing one first.
- **Deactivate any account, of any role, unscoped** (`PUT /api/users/:id/deactivate`) — the only role that can reach every account in the system this way; `district_supervisor`/`facility_supervisor` have the same action but only within their own scope (see below). Takes effect immediately: the target's current session stops working on its very next request, not just on their next login.
- **Reactivate any deactivated account, unscoped** (`PUT /api/users/:id/activate`) — reverses a deactivation. Unlike deactivation, this does *not* itself invalidate anything; the account just logs in again normally. Reactivating a `district_supervisor`/`facility_supervisor` whose district/facility now has a different active one at that level gets the same `409` as creation.
- **Force-reset any account's password, of any role, unscoped** (`PUT /api/users/:id/reset-password`) — same unscoped reach as deactivation above. Also invalidates the account's current session immediately. **A separate, self-serve path also exists now** (`POST /api/auth/forgot-password` / `POST /api/auth/reset-password/:token`, public, no admin involved) — see the new §Self-serve password reset section below; this admin-driven path still exists alongside it, e.g. for an account that can't access its own email.

**Can see:**
- The dashboard, unscoped — every active facility, every district, all at once, plus a summary (counts by status, district/facility counts, a per-facility rollup).
- Every district and every facility, including soft-deleted ones — each district/facility row includes the name/email of its currently active supervisor (`null` if unstaffed).
- A drill-down detail of any single district (`GET /api/districts/:id`) — every facility in it (even ones with zero vaccines configured yet), each with its own status rollup, plus a district-wide rollup. Also works for any single facility (`GET /api/facilities/:id`) — its full vaccine/stock list plus a status rollup, in one call.
- Every user account in the system, of every role.
- The full audit log, unscoped — every mutation any user has ever made, enriched with the actor's name/role and the affected district's/facility's name (not just raw ids). Supports `?limit=N` to cap the response to the `N` most recent rows.

**Cannot do:**
-cc(that's a `district_supervisor`'s job, scoped to their own district).
- Record a stock entry, edit a threshold, or manage a facility's vaccine list (not part of this role's journey — those belong to facility-level roles).

---

## 3. District Supervisor

Scoped to one district — `districtId` is set, `facilityId` is `null`. **At most one account can hold this role, active, per district** — enforced at the database level, same rule as facility-level supervisors below.

**Can do:**
- Create a **facility** within their own district (`POST /api/facilities`) — `districtId` is forced server-side to their own, never taken from the request body; `unionCouncil`/`town` are optional free-text fields on the request. Creating a facility automatically clones the default starter set of **13** vaccines into it (currently placeholder names `"Vaccine 01"`–`"Vaccine 13"`, pending the client's real EPI list), each immediately paired with a threshold row left unconfigured (`minQuantity: null`), so it's ready for a `facility_supervisor` to configure right away.
- **Rename, soft-delete, or reactivate a facility within their own district** (`PUT`/`DELETE`/`PUT /:id/activate /api/facilities/:id`) — rejected (`403`) for a facility in another district. Deletion is a soft flag, refused (`409`) while the facility still has any active user.
- Create a **`facility_supervisor`** account (`POST /api/users`) — but only for a facility that already belongs to their own district and is still active; the backend checks the target facility's `districtId`/`isActive` server-side and rejects (`400`) otherwise. **A facility may only ever have one active `facility_supervisor` at a time** — attempting to create or reactivate a second gets `409 { "error": "Facility already has an active supervisor" }`.
- **Deactivate, reactivate, or force-reset the password of a `facility_supervisor` within their own district** (`PUT /api/users/:id/deactivate`, `PUT /api/users/:id/activate`, `PUT /api/users/:id/reset-password`) — the backend loads the target first and checks both that its role is exactly `facility_supervisor` and that its `districtId` matches their own, rejecting (`403`) a `facility_supervisor` from another district, a `facility_worker` two levels down, or a peer `district_supervisor`.

**Can see:**
- The dashboard, scoped to their own district — every active facility within it, at once, plus a summary (their own district always counts as `districtCount: 1`).
- Every district-scoped user they can see includes the `facility_supervisor`s they've created — filtered by `districtId` matching their own **and** role `facility_supervisor` (this does **not** include the `facility_worker`s two levels down, and does not leak a peer `district_supervisor` sharing their district either).
- Their own district's row via `GET /api/districts` (a one-item list, not every district) — includes their own name/email as `supervisorName`/`supervisorEmail`.
- Every facility within their own district via `GET /api/facilities`, including soft-deleted ones — each row includes its active `facility_supervisor`'s name/email, `null` if unstaffed.
- A drill-down detail of any single facility in their own district (`GET /api/facilities/:id`) — full vaccine/stock list plus a status rollup. Rejected (`403`) for a facility outside their district.
- The audit log, filtered to their own district — every mutation whose owning district matches theirs, including stock entries, threshold changes, and vaccine management made by facility-level roles under them. Enriched with actor name/role and district/facility name. Supports `?limit=N`.

**Cannot do:**
- Create a district, or a `district_supervisor`/`facility_worker` account (outside their one creatable role).
- Deactivate, reactivate, or reset the password of a peer `district_supervisor`, a `facility_supervisor` outside their own district, or any `facility_worker` (even one inside their own district) — the target's role must be exactly `facility_supervisor` **and** its `districtId` must match their own, or the request is rejected.
- Record a stock entry, edit a threshold, or manage a facility's vaccine list — those require `facilityId` to be set, which this role never has.
- View a district drill-down detail (`GET /api/districts/:id`) at all — `403`, even for their own district (their own `GET /api/dashboard` already covers everything it would show).
- See any district, facility, user, or audit-log row outside their own district.

---

## 4. Facility Supervisor

Scoped to one facility within one district — both `districtId` and `facilityId` are set. **At most one account can hold this role, active, per facility** — enforced at the database level.

**Can do:**
- Create a **`facility_worker`** account (`POST /api/users`) — `facilityId` is forced server-side to their own facility; the new worker's `districtId` is also forced to the caller's own district (populated at creation, not `null` by design as originally specced).
- **Deactivate, reactivate, or force-reset the password of a `facility_worker` within their own facility** (`PUT /api/users/:id/deactivate`, `PUT /api/users/:id/activate`, `PUT /api/users/:id/reset-password`) — the backend checks both that the target's role is exactly `facility_worker` and that its `facilityId` matches their own, rejecting (`403`) a `facility_worker` from another facility.
- **Manage their own facility's vaccine list** — add (`POST /api/vaccines`), rename (`PUT /api/vaccines/:id`), or hard-delete (`DELETE /api/vaccines/:id`) a vaccine. **The name must be one of the 13 default vaccine names** — anything else is rejected with `400`; since every facility already has all 13 auto-provisioned at creation, this is now mainly for re-adding one after a delete. Deletion is real (the row is removed), but only ever succeeds for a vaccine with zero recorded stock history (`409` otherwise — stock history is append-only, so a vaccine that's ever had activity can't be fully removed). Vaccines are facility-scoped, not a shared list: adding/renaming one only ever affects their own facility, even if another facility has a vaccine of the same name.
- **Record a stock entry** (`POST /api/stock-entries`) — `facilityId` forced to their own. Now a choice between `"received"` (stock arriving from the district, the default if omitted) and `"returned"` (stock physically returned to the facility, e.g. by workers at end of day) — both add to the balance. A `"received"` entry requires five additional fields (`batchNo`, `expiryDate`, `dosesPerVial`, `manufacturer`, `remarks` — the last a fixed `"outreach"`/`"fixed"` choice); `"returned"` needs none of them. This is **append-only**: there is no update/delete route for stock entries anywhere in this system, for any role.
- **Directly correct a vaccine's current stock count** (`PUT /api/vaccines/:id/stock`) — submit the *new total*, not a delta; the server computes the signed difference against the live balance and inserts one new stock-entry row typed `adjustment_increase`/`adjustment_decrease`. This never edits an existing row — the append-only rule still holds, this is just a second way to add a row besides the normal received/used flow.
- **Edit a threshold** (`PUT /api/thresholds/:id`) — but only a threshold row that belongs to their own facility; the backend loads the row first and checks its `facilityId` against their own before allowing the update, rejecting (`403`) otherwise.

**Can see:**
- The dashboard, scoped to their own single facility only, plus a summary (restating the same facility's numbers, for shape-consistency with other roles).
- The `facility_worker`s they've created, via `GET /api/users` filtered to their own `facilityId` and role.
- `GET /api/vaccines` (their own facility's list — every role can see its own scope of this).
- **The audit log, scoped to their own facility** — their own actions (vaccine management, stock corrections, threshold edits, received-stock entries, worker account management) plus their `facility_worker`s' actions (used-stock entries). This deliberately excludes a `district_supervisor`'s own upstream actions on this facility (e.g. its own creation), even though those rows carry the same `facilityId`. Enriched the same way as other roles' views. Supports `?limit=N`.

**Cannot do:**
- Create a district, facility, `district_supervisor`, or `facility_supervisor` account.
- Deactivate, reactivate, or reset the password of a `facility_worker` from a different facility, or of any account at their own level or above.
- View any district, any facility list/detail, or a facility outside their own — denied at the role-check layer (`403`), before any query runs.
- Edit a threshold or manage a vaccine belonging to a different facility, even if they know its id.
- Record stock as `"used"` — that's exclusively the `facility_worker`'s movement type. Sending `"used"` (or anything else outside `{"received", "returned"}`) as a `facility_supervisor` is rejected with `400`, not silently downgraded.

---

## 5. Facility Worker

The narrowest role — `facilityId` is set. `districtId` is also set for accounts created since the cascade was updated to populate it (previously always `null`; accounts created before that change may still carry a legacy `null`).

**Can do:**
- **Record a stock entry** (`POST /api/stock-entries`) — `facilityId` forced to their own, always recorded as `"used"` for this role (doses administered/consumed). Rejected with `400` if the quantity would drive the facility's balance for that vaccine below zero — the response includes how much is actually available, so the frontend can show the real number instead of a generic error. Same append-only rule as above: no update/delete route exists.

**Can see:**
- The dashboard, scoped to their own single facility only — same shape a `facility_supervisor` sees for that facility, used here as read-only confirmation after submitting a count.
- `GET /api/vaccines` (their own facility's list, read-only for this role — used to populate the stock-entry form's vaccine dropdown).

**Cannot do:**
- Create any account at all — the creatable-role map has no entry for this role; `POST /api/users` rejects every attempt regardless of what role is requested.
- Edit a threshold, manage the vaccine list, or correct stock directly.
- View districts, facilities, other users, or the audit log at all — all denied at the role-check layer, before any scope-filtered query even runs.

---

## 6. Rules that apply to every role equally

- **Every mutating request needs a valid session (JWT cookie) *and* a CSRF token** (`x-csrf-token` header) — no role is exempt. `GET` requests need only a valid session.
- **A request body can never grant itself more than the caller's own role allows.** Submitting `"role": "super_admin"` in a `POST /api/users` body from a `facility_supervisor` session does nothing except get the request rejected — the creatable role and the scope (`districtId`/`facilityId`) are always derived from the caller's own verified token, never trusted from what the client sends (`super_admin` is the one exception: since it has no district/facility of its own, it's allowed to send `districtId`/`facilityId` explicitly, always validated as an existing, active district/facility first). The same governing rule applies to `POST /api/stock-entries`'s movement type: a `facility_worker` can never produce anything but `"used"` regardless of the body, and a `facility_supervisor` can only ever produce `"received"` or `"returned"` — any other value is rejected outright.
- **Account management (deactivate/reactivate/reset-password) follows the same one-level-down cascade as account creation.** `super_admin` reaches every account, unscoped. `district_supervisor` and `facility_supervisor` may only act on the *one role directly below them*, and only within their own scope — a `district_supervisor` cannot reach a `facility_worker` two levels down, and neither can reach a peer or anyone above them in the cascade. This is checked server-side after loading the target row, never inferred from the request alone.
- **A district can have at most one active `district_supervisor`, and a facility at most one active `facility_supervisor`, enforced at the database level** — not just application logic. Creating or reactivating a second one at either level is rejected with `409` before it can happen, whether attempted via `POST /api/users` or `PUT /api/users/:id/activate`.
- **Districts and facilities soft-delete, never hard-delete.** `DELETE` on either sets `isActive: false` rather than removing the row, and is refused (`409`) while the entity still has any active child (facilities/users for a district; users for a facility). Deleted rows keep appearing in their own `GET`/list/detail endpoints (unfiltered by design, so they can be found and reactivated) but disappear from `GET /api/dashboard`, which only ever shows active facilities.
- **Stock entries are typed and append-only.** Every row is one of `received` or `returned` (facility_supervisor, both add), `used` (facility_worker, subtracts, capped at the current balance), or `adjustment_increase`/`adjustment_decrease` (facility_supervisor, via the direct stock-correction endpoint) — never edited or deleted once written, only ever added to. "Current stock" is always the running sum of every row for that facility/vaccine, not the latest row. A `received` entry additionally requires batch/shipment metadata (batch no, expiry, doses per vial, manufacturer, remarks); `returned` and the other types don't.
- **A stock entry (either role) that drops a facility/vaccine's balance into `critical` status automatically emails the facility's supervisor(s), the district's supervisor, and every super_admin** — once per critical episode, not on every entry while it stays critical. Invisible in the API response; the only observable effect is that the specific request crossing into `critical` responds a bit slower (it waits on the real email send).
- **Every write, from every role, produces exactly one `audit_log` row** — account creation, stock entries/corrections, threshold changes, vaccine management, district/facility creation/rename/delete/reactivate, deactivation, reactivation, and password resets are all recorded, with `actorId` identifying who did it and enriched with the actor's current name/role and the event's owning district's/facility's name at read time. One deliberate exception: the self-serve `POST /api/auth/forgot-password` request (below) isn't tied to any authenticated role and isn't logged — only the completed reset is.
- **Account creation and management have no self-serve path — with one deliberate exception.** No signup, no self-deactivation; every account is created by exactly one role above it in the cascade, and creation/deactivation/reactivation/admin-driven-reset are all enforced the same way regardless of who's asking. **The one exception**: password reset also has a self-serve path now (`POST /api/auth/forgot-password` / `POST /api/auth/reset-password/:token`, public, no session or admin required) — a single-use, 30-minute emailed token, deliberately enumeration-safe (the response never reveals whether an email is registered).

---

## Related docs

- `docs/api-reference.md` — the concrete request/response contract for every endpoint mentioned above.
- `API_DOCUMENTATION.md` — the same information grouped by role with inline JSON payloads, written for frontend build-out.
- `FRONTEND_HANDOFF.md` — the round-by-round changelog of what changed and why, if you need the history behind a specific behavior.
- `docs/repository-guide.md` — how the role/scope checks in this document are actually implemented in code.
- `docs/smart-stock-alert-architecture.md` — the original design spec this cascade was built from.
