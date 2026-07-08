# Smart Stock Alert — API Documentation (by Role)

For Amna / frontend integration. This groups every endpoint by **who can call it and what it does for them**, rather than listing routes flat — use it to figure out what UI each role needs. For exact request/response JSON shapes, validation rules, and error formats, see `docs/api-reference.md`; this doc is the "who can do what" map.

**Base URL:**
- Local dev: `http://localhost:3000`
- Deployed (production): `https://smart-stock-alert-be.vercel.app`

---

## Before you start: the auth model in 30 seconds

- Auth is **cookie-based**, not a bearer token. Every `fetch` call needs `credentials: "include"` or nothing works.
- Login returns a `csrfToken` in the JSON **response body**. Store it in memory (not `localStorage`) and send it back as an `x-csrf-token` header on **every** `POST`/`PUT`/`DELETE` request. `GET` requests don't need it.
- Sessions last 8 hours, no refresh flow — on any `401`, redirect to login.
- Every role sits in exactly one strict cascade: `super_admin → district_supervisor → facility_supervisor → facility_worker`. A role's visible scope is fully determined by two fields returned at login — `districtId` and `facilityId` — never by anything the frontend sends.

Full details, code samples, and JSON shapes: `docs/api-reference.md` §1–3.

---

## Capability matrix (quick overview)

| Capability | Super Admin | District Supervisor | Facility Supervisor | Facility Worker |
|---|---|---|---|---|
| Log in / log out | ✅ | ✅ | ✅ | ✅ |
| View vaccines | ✅ all | ✅ own district's facilities' | ✅ own facility's | ✅ own facility's |
| Add / rename a vaccine | ❌ | ❌ | ✅ own facility | ❌ |
| View dashboard | ✅ everything | ✅ own district | ✅ own facility | ✅ own facility |
| View districts | ✅ all | ✅ own only | ❌ | ❌ |
| Create a district | ✅ | ❌ | ❌ | ❌ |
| View facilities | ✅ all | ✅ own district's | ❌ | ❌ |
| Create a facility | ✅ | ✅ own district | ❌ | ❌ |
| View user accounts | ✅ everyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Create a user account | ✅ → district supervisor | ✅ → facility supervisor | ✅ → facility worker | ❌ |
| Deactivate a user | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Activate (reverse a deactivation) | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Force-reset a password | ✅ anyone | ✅ own district's facility supervisors | ✅ own facility's workers | ❌ |
| Record stock **received** from district | ❌ | ❌ | ✅ own facility | ❌ |
| Record stock **used** | ❌ | ❌ | ❌ | ✅ own facility |
| Edit a threshold | ❌ | ❌ | ✅ own facility | ❌ |
| View the audit log | ✅ everything | ✅ own district | ✅ **own actions + own facility_workers' actions** | ❌ |

✅ = allowed at the scope shown. ❌ = the backend rejects with `403` before any data is touched — never just hidden in the UI. Treat these as a guide for what to *show*, not the actual security boundary; the backend re-checks everything server-side regardless of what the frontend does.

**Vaccines are facility-scoped, not one shared list** — each facility manages its own independent set. **Stock entries are typed** — a Facility Supervisor's submission is always recorded as `received` (adds to stock); a Facility Worker's is always recorded as `used` (subtracts) and is rejected server-side if it would exceed what's currently on hand. Neither role sends the type themselves — it's derived from who's logged in.

**Every account now requires a `name`, alongside email and password, at creation — for every role.** It's a plain display string (1–120 characters, no uniqueness check) returned in the login response, `POST`/`GET /api/users`, and every deactivate/activate/reset-password response, so the frontend can show a real name instead of just an email in the sidebar/dashboard and any user-listing screen. **This is a breaking change to every existing create-user form** — a request missing `name` now gets `400`.

---

## 1. System Level

Endpoints with no role requirement — either public, or the entry point before any role-scoped access exists yet.

**Functionality:** liveness check, and the authentication handshake every other role depends on (log in to get a session + CSRF token, log out to end it).

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness check. Returns `{ "status": "ok" }`. No auth needed. |
| `POST` | `/api/auth/login` | Log in with email + password. Returns the user's profile (`name`, `role`, `districtId`, `facilityId`) and a `csrfToken`, and sets the session cookie. Rate-limited (10 attempts / 15 min / IP). |
| `POST` | `/api/auth/logout` | Ends the session. Requires an existing session + CSRF token (it's the one "public" route that still needs both, since a session must exist first). Invalidates the session server-side immediately — not just a client-side cookie clear. |

---

## 2. Super Admin

**Scope:** unscoped — `districtId` and `facilityId` are both `null`. The only role that sees the entire system at once.

**Functionality:**
- Onboards the system: creates districts, and creates the one `district_supervisor` per district who then builds out that district themselves.
- Account management authority reaches **every user in the system**, of any role — the only role that can deactivate or reset a password unscoped. `district_supervisor`/`facility_supervisor` have the same actions but only within their own scope.
- Full visibility: every district, every facility, every user, the entire audit log, and the dashboard across every facility at once.
- **Cannot** create a facility, a `facility_supervisor`, or a `facility_worker` directly — account/facility creation only ever cascades one level down, and a super_admin's "one level down" is `district_supervisor`. Also cannot record stock entries or edit thresholds — those belong to facility-level roles only.

| Method | Endpoint | What it does for Super Admin |
|---|---|---|
| `POST` | `/api/districts` | Creates a new district. Super_admin only — no other role can do this. |
| `GET` | `/api/districts` | Lists **every** district in the system. |
| `GET` | `/api/facilities` | Lists **every** facility in the system, across all districts. |
| `GET` | `/api/users` | Lists **every** user account in the system, of every role. |
| `POST` | `/api/users` | Creates a `district_supervisor` account for any district (`districtId` required in the body). This is the only role a super_admin can create directly. |
| `PUT` | `/api/users/:id/deactivate` | Deactivates **any** user account, unscoped. Takes effect immediately — the target's session stops working on their very next request. |
| `PUT` | `/api/users/:id/activate` | Reactivates **any** user account, unscoped — reverses a deactivation. The user must log in again to get a working session. |
| `PUT` | `/api/users/:id/reset-password` | Force-resets **any** user's password, unscoped. Also invalidates their current session immediately. |
| `GET` | `/api/vaccines` | Every vaccine in the system, unscoped. Vaccines are facility-scoped, not one shared list — this row set spans every facility's own independent list. |
| `GET` | `/api/dashboard` | Stock dashboard rows across **every** facility and district, all at once. |
| `GET` | `/api/audit-log` | The entire audit log, unscoped — every mutation any user has ever made. |

---

## 3. District Supervisor

**Scope:** one district — `districtId` is set, `facilityId` is `null`.

**Functionality:**
- Builds out their own district: creates facilities within it, and creates the `facility_supervisor` for each one.
- Account management authority reaches **only** `facility_supervisor`s whose `districtId` matches their own — cannot touch a peer `district_supervisor`, a `facility_supervisor` in another district, or a `facility_worker` two levels down (even one inside their own district).
- Visibility is district-wide but no further: their own district's row, every facility within it, the `facility_supervisor`s they've created, the dashboard for every facility in their district, and the audit log filtered to their own district (including stock entries and threshold changes made by facility-level roles under them).
- **Cannot** create a district, a `district_supervisor`, or a `facility_worker` account (outside their one creatable role: `facility_supervisor`). Cannot record a stock entry or edit a threshold — those require `facilityId`, which this role never has. Cannot see anything outside their own district.

| Method | Endpoint | What it does for District Supervisor |
|---|---|---|
| `GET` | `/api/districts` | Returns a one-item list: just their own district. |
| `POST` | `/api/facilities` | Creates a facility **within their own district** — `districtId` is forced server-side, never taken from the request. Clones a fixed default starter set of vaccines into the new facility (its own independent rows, not shared with any other facility), each immediately paired with a threshold row defaulted to 0, so it's immediately ready for a facility_supervisor to configure. |
| `GET` | `/api/facilities` | Lists every facility within their own district only. |
| `GET` | `/api/users` | Lists the `facility_supervisor`s they've created (filtered by `districtId` — does **not** include `facility_worker`s two levels down). |
| `POST` | `/api/users` | Creates a `facility_supervisor` account — only for a facility that already belongs to their own district (checked server-side, `400` otherwise). |
| `PUT` | `/api/users/:id/deactivate` | Deactivates a `facility_supervisor` **within their own district only**. `403` on a peer, a facility_supervisor elsewhere, or any facility_worker. |
| `PUT` | `/api/users/:id/activate` | Reactivates a `facility_supervisor` within their own district only — same scope rule as deactivate. |
| `PUT` | `/api/users/:id/reset-password` | Force-resets a `facility_supervisor`'s password, same scope rule as deactivate. |
| `GET` | `/api/vaccines` | Vaccines belonging to any facility in their own district. |
| `GET` | `/api/dashboard` | Stock dashboard rows for every facility **within their own district**, all at once. |
| `GET` | `/api/audit-log` | Audit log filtered to their own district — every mutation whose owning district matches theirs. |

---

## 4. Facility Supervisor

**Scope:** one facility within one district — both `districtId` and `facilityId` are set.

**Functionality:**
- Runs day-to-day operations for their one facility: creates the `facility_worker` accounts for it, records stock **received** from the district, manages the facility's own vaccine list, and is the **only role that can edit a vaccine threshold**.
- **Never records "used" stock** — that's the Facility Worker's job. A Facility Supervisor's `POST /api/stock-entries` is always recorded as `received` (adds to the running balance), regardless of what the request body says.
- Manages their own facility's vaccine catalog: can add a new vaccine type or rename an existing one. This is **facility-scoped** — it only ever affects their own facility's list, never another facility's, even if the vaccine name is the same.
- Account management authority reaches **only** `facility_worker`s whose `facilityId` matches their own.
- Visibility is limited to their own facility: the dashboard for it (which also shows the facility's own name and its owning district's name), the `facility_worker`s they've created, and an audit trail covering **their own actions and their workers'** actions at that facility. No visibility into districts, other facilities, or anyone else's audit log.
- **Cannot** create a district, facility, `district_supervisor`, or another `facility_supervisor` account. Cannot deactivate/reset a `facility_worker` from a different facility, or anyone at their own level or above. Cannot view any district or facility list — denied at the role-check layer before any query runs. Cannot edit a threshold or rename a vaccine belonging to a different facility, even knowing its id. Cannot see a district_supervisor's own upstream actions on their facility (e.g. its creation) in the audit log — only facility-level staff's actions.

| Method | Endpoint | What it does for Facility Supervisor |
|---|---|---|
| `GET` | `/api/users` | Lists the `facility_worker`s they've created, filtered to their own `facilityId`. |
| `POST` | `/api/users` | Creates a `facility_worker` account — `facilityId` forced to their own; the new account's `districtId` stays `null` by design. |
| `PUT` | `/api/users/:id/deactivate` | Deactivates a `facility_worker` **within their own facility only**. `403` on a worker from another facility, or anyone at/above their own level. |
| `PUT` | `/api/users/:id/activate` | Reactivates a `facility_worker` within their own facility only — same scope rule as deactivate. |
| `PUT` | `/api/users/:id/reset-password` | Force-resets a `facility_worker`'s password, same scope rule as deactivate. |
| `POST` | `/api/stock-entries` | Records stock **received** from the district, for their own facility. **Append-only** — no update/delete route exists; a mistaken entry is corrected with a new one, never by editing the old one. |
| `PUT` | `/api/thresholds/:id` | Edits the minimum-quantity threshold for a vaccine — but only a threshold row belonging to their own facility (`403` otherwise). **The only role that can do this.** |
| `GET` | `/api/vaccines` | Their own facility's vaccine list. |
| `POST` | `/api/vaccines` | Adds a new vaccine to their own facility (auto-provisions a threshold row). **409** on a duplicate name at the same facility. |
| `PUT` | `/api/vaccines/:id` | Renames a vaccine belonging to their own facility (`403` otherwise). |
| `GET` | `/api/dashboard` | Stock dashboard rows for their **one facility only**, including its own name and its district's name. |
| `GET` | `/api/audit-log` | Rows whose actor is facility-level staff at their own facility — themselves or one of their own `facility_worker`s — never another facility's, and never a district_supervisor's upstream actions on this facility. Rows include the actor's name/role and the owning district's/facility's name, not just raw ids. |

---

## 5. Facility Worker

**Scope:** narrowest role — `facilityId` is set, `districtId` is `null` (not needed at this scope).

**Functionality:**
- Field-level role: on login sees their own facility's name and its current per-vaccine stock, then records how many doses they **used** and checks the dashboard as read-only confirmation. That's the entire job.
- **Every stock entry is recorded as `used`** (subtracts from the facility's running balance) — a Facility Worker never records `received` stock, regardless of what the request body says. The server rejects an entry that would take the balance below zero (`400`, with the amount actually available in the response) — the frontend's vaccine dropdown should show each vaccine's current remaining stock (from `GET /api/dashboard`) so the user can see this before submitting, but the server check is authoritative either way.
- Selects from vaccines their Facility Supervisor has set up for this facility (`GET /api/vaccines`) — cannot add or rename vaccines themselves.
- **Cannot** create any account at all — every `POST /api/users` attempt is rejected regardless of what role is requested. Cannot edit a threshold or manage the vaccine list. Cannot view districts, facilities, other users, or the audit log at all — all denied at the role-check layer, before any scope-filtered query even runs.

| Method | Endpoint | What it does for Facility Worker |
|---|---|---|
| `POST` | `/api/stock-entries` | Records doses **used**, for their own facility. Same append-only rule as Facility Supervisor. `400` (`{ "error": "Insufficient stock", "available": N }`) if the amount exceeds what's currently on hand. |
| `GET` | `/api/vaccines` | Their own facility's vaccine list — read-only for this role. |
| `GET` | `/api/dashboard` | Stock dashboard rows for their **one facility only** — same shape a facility_supervisor sees for that facility, used here as read-only confirmation after submitting a count, and to show current stock per vaccine before submitting. |

---

## Rules that apply to every role, no exceptions

- **Every mutating request (`POST`/`PUT`/`DELETE`) needs a valid session cookie *and* the `x-csrf-token` header.** No role is exempt. `GET` requests only need the session cookie.
- **A request body can never grant more than the caller's own role allows.** Submitting `"role": "super_admin"` in a `POST /api/users` body from a facility_supervisor session just gets rejected — the creatable role and scope (`districtId`/`facilityId`) always come from the caller's own verified session, never from what the client sends. The same rule applies to `POST /api/stock-entries`'s `entryType`: it's derived from the caller's role (`facility_supervisor` → `received`, `facility_worker` → `used`), not read from the body at all.
- **Deactivation and password reset always follow the same one-level-down cascade as account creation** — enforced server-side after loading the target row, never inferred from the request URL alone.
- **Every write, from every role, produces exactly one audit log row.** `super_admin`/`district_supervisor` read it back unscoped/district-scoped via `GET /api/audit-log`; `facility_supervisor` reads back **their own actions plus their own facility_workers'** rows; `facility_worker` still can't read it at all — but every role's writes are logged regardless of who can read them back. Every row also surfaces the actor's name/role and the owning district's/facility's name, not just raw ids.
- **No self-serve anything** — no signup, no "forgot password" flow, no self-deactivation. Every account is created by exactly one role above it in the cascade.
- Common error codes across all endpoints: `400` (validation/bad id), `401` (no/expired/revoked session — re-authenticate, don't retry), `403` (wrong role, wrong scope, or missing/invalid CSRF token), `404` (not found), `409` (duplicate, e.g. email already in use), `429` (rate limited).

---

## Related docs

- `docs/api-reference.md` — the concrete request/response JSON contract for every endpoint above, plus auth code samples.
- `docs/functionality.md` — the same role breakdown as this doc, in more narrative detail.
- `users.md` (ask Ahmed — gitignored, contains real passwords) — one working login per role to test against immediately.
