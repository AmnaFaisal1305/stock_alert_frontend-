# Frontend Handoff — Backend Changes

For the frontend repo. This is a focused changelog for backend changes, not a general API doc — read `API_DOCUMENTATION.md` and `docs/api-reference.md` in this backend repo for the full contract; this doc only covers what's *different* from what you may have already built against.

**Status as of this doc: Round 10 (below) is implemented, passing the full backend test suite (110/110), committed, and deployed live** on `https://smart-stock-alert-be.vercel.app`. Everything from earlier rounds is already live and unaffected except where called out below.

---

## Why this changed

The client sent a new batch of requirements after seeing the pilot in action: (1) districts should carry a province and be assignable to district supervisors from a fixed starter list, (2) facility supervisors need to pick vaccines from an official default list and record batch/shipment details when logging stock received, (3) all account creation should route through Super Admin (with the existing per-role screens staying as they are for now), and (4) a facility supervisor needs to log vaccines *returned* to the facility (e.g. by workers at end of day), not just received. Two rounds of backend work (Phase 0 + Phase 1, both shipped together as "Round 8") cover all four.

---

## Round 8 — profile fields, direct role creation, restricted vaccine list, returned stock

### Breaking changes — check these before assuming old code still works

#### 1. `POST /api/vaccines` and `PUT /api/vaccines/:id` — vaccine names are no longer free text

**Before:** a facility_supervisor could add/rename a vaccine with any non-empty name.
**Now:** `name` must be exactly one of the 13 default vaccine names — anything else is rejected with a `400` (the standard zod `{ "error": "Validation failed", "fields": {...} }` shape, not a custom message). Fetch the valid list from `GET /api/vaccines` (or hardcode it only if you accept it'll go stale) rather than a free-text input.

**If your "add vaccine" screen has a free-text name field, it will start failing for any name outside the list — replace it with a picker/dropdown fed by `GET /api/vaccines`.**

**Also important:** the 13 default names are currently **placeholders** (`"Vaccine 01"` through `"Vaccine 13"`), not real vaccine names — the client hasn't sent their official EPI list yet. When they do, the values will change but nothing about the shape or this restriction will. Don't hardcode the placeholder strings into UI copy anywhere that would be annoying to update later (e.g. don't ship a screenshot-driven design locked to "Vaccine 01").

Every new facility still auto-provisions all 13 at creation (unchanged behavior, just 13 now instead of 5) — so in practice this endpoint is now mainly used to re-add a vaccine after it was deleted, not to introduce a brand-new one.

#### 2. `POST /api/stock-entries` — a `"received"` entry now requires 5 extra fields

**Before:** `{ "vaccineId": "uuid", "quantity": 50 }` was the whole body for a facility_supervisor's stock entry (always recorded as `"received"`).
**Now:** that same call **fails with `400`** unless you also send `batchNo`, `expiryDate`, `dosesPerVial`, `manufacturer`, and `remarks`:
```jsonc
// this now 400s:
{ "vaccineId": "uuid", "quantity": 50 }

// this is required instead:
{
  "vaccineId": "uuid",
  "quantity": 50,
  "batchNo": "B-2026-001",
  "expiryDate": "2027-06-30",     // plain date string (YYYY-MM-DD), not a full timestamp
  "dosesPerVial": 10,
  "manufacturer": "Manufacturer Name",
  "remarks": "outreach"           // or "fixed" — exactly one of these two, nothing else
}
```
**If your "record stock received" form only collects vaccine + quantity, it will start failing on every submission — add the five new fields to that form before this goes live for real users.**

Error response if any are missing:
```json
{ "error": "batchNo, expiryDate, dosesPerVial, manufacturer, and remarks are required for a received entry" }
```
Expiry is reference metadata only — it doesn't affect the balance or expire anything automatically, so just capture and display it; no depletion/FEFO logic to build around it.

### New, non-breaking capability — a facility_supervisor can now log "returned" stock

New optional `entryType` field on the same endpoint, alongside `"received"`:
```jsonc
{ "vaccineId": "uuid", "quantity": 5, "entryType": "returned" }
```
Meaning: vaccines physically returned to the facility (e.g. by a worker at end of day), as opposed to `"received"` (arriving from the district). Both add to the balance the same way. **None of the five batch fields are needed for `"returned"`.** Omitting `entryType` entirely still defaults to `"received"` (with the batch fields required, per above) — so this is purely additive if you don't build a "returned" flow yet, but a good one to add: it's a real, requested workflow (workers hand back unused doses, and that needs its own record, not lumped into a generic correction).

`facility_worker`'s stock entries are completely unaffected by any of this — still always `"used"`, no new fields, no change.

### New, non-breaking capability — Super Admin can create any role directly

**Before:** `POST /api/users` from a super_admin session could only create a `district_supervisor`.
**Now:** it accepts `role: "district_supervisor" | "facility_supervisor" | "facility_worker"` — super_admin can create any of the three directly, given the right `facilityId`/`districtId` in the body (validated as real and active server-side). **The existing district_supervisor-creation screen doesn't need any changes** — this is additive. The other two roles exist for a later phase (bulk-provisioning accounts from client-supplied profiles); no current screen needs to expose them, but the API supports it if you want to build ahead.

### New, non-breaking fields — profile data on districts, facilities, and users

All optional, all additive — no existing response shape lost any field, these just show up alongside what's already there:

| Entity | New field(s) | Where |
|---|---|---|
| District | `province` | `POST /api/districts` (optional, defaults to `"Sindh"`), and every district response |
| Facility | `unionCouncil`, `town` | `POST /api/facilities` (both optional), and every facility response |
| User | `phone`, `cnic` | `POST /api/users` (both optional, any role), and every user response |

None of these are required on any existing form — add input fields for them whenever it's convenient, the backend accepts their absence.

---

## Round 8a — critical-stock alert emails

*Shipped between Round 8 and Round 9, documented here after the fact — numbered "8a" rather than renumbering Round 9 and every doc that already references it by that number.*

### Why this changed

The client asked to be emailed when a vaccine's stock goes critical, instead of only finding out by checking the dashboard.

### New, non-breaking — a backend side effect on `POST /api/stock-entries`, no new endpoint, no response-shape change

When a stock entry (from either `facility_supervisor` or `facility_worker`) drops a facility/vaccine's balance below its configured threshold (status flips to `critical`), the backend automatically emails the facility's own supervisor(s), the owning district's supervisor, and every super_admin. It fires **once per "critical episode"** — not on every subsequent entry while it stays critical, only when it first crosses into critical, and again later if it recovers (back to `low`/`adequate`) and then drops critical again.

**Nothing to build for this** — it's entirely invisible in the `POST /api/stock-entries` response, and it's a real email, not an in-app/dashboard notification (the dashboard badge work, #6 in the original requirements list, was already backend-complete since `computeStatus` already returns everything needed — no separate backend change was needed for that one).

**One observable side effect worth knowing about**: the specific request that first pushes a pair into `critical` will take noticeably longer to respond than normal (it waits on a real outbound email send before returning `201`). Every other stock-entry request — including ones that keep a pair critical, or ones for a pair that's already fine — responds at normal speed. If a "record stock" screen has a short request timeout or an aggressive loading-spinner cutoff, this is the one case that can legitimately take a few seconds longer.

---

## Round 9 — self-serve forgot password

### Why this changed

The client asked for a self-serve "forgot password" flow — previously the only way to reset a password was an admin using `PUT /api/users/:id/reset-password`. Two new public endpoints cover it.

### New, non-breaking — two new endpoints, no changes to anything existing

**`POST /api/auth/forgot-password`** — body `{ "email": "..." }`. **Always** returns the same `200 { "message": "If that email is registered, a reset link has been sent." }`, regardless of whether the email is registered, active, or not — don't build UI that branches on this response; that's the point (no signal either way). If it matches a real active account, an email goes out with a link shaped `{FRONTEND_URL}/reset-password?token=<raw-token>` — **your reset-password page needs to exist at that route and read `token` from the query string.** The token expires in 30 minutes and works once.

**`POST /api/auth/reset-password/:token`** — body `{ "password": "..." }` (min 8 characters). Take the `token` your reset-password page read from its own URL and send it as the `:token` path segment here, not in the body. `200 { "message": "Password reset. Please log in." }` on success — **this does not log the user in**, redirect to the normal login screen afterward. `400 { "error": "Invalid or expired token" }` if the token is wrong, expired, or already used.

Both are public (no cookie/CSRF needed, same as `/login`) and share their own rate limit (10 attempts / 15 min / IP), separate from login's.

**Nothing to change on any existing screen** — this only requires building one new "forgot password" entry point (an email field + the generic-message confirmation) and one new "reset password" page (reads `token` from its own URL, collects a new password, calls the endpoint above).

---

## Small addition — `unionCouncil`/`town` now on `GET /api/dashboard` rows

Additive, no breaking change. Every row in a `GET /api/dashboard` response (any role) now also includes the facility's `unionCouncil`/`town` (`string | null`), same fields already returned by `GET /api/facilities`. For a `facility_supervisor`/`facility_worker` this is just their one facility's own profile info, repeated on every row — useful if a dashboard screen wants to show it without a second request.

Also confirmed (already existed, no code change): a `super_admin` can already create a facility in **any** district via `POST /api/facilities` by supplying `districtId` in the body (validated as real/active, `400` otherwise), including `unionCouncil`/`town` — see `API_DOCUMENTATION.md`'s Super Admin section for the exact shape, now documented there explicitly.

---

## Round 10 — Google Sign-In, plus a breaking change to account creation

### Why this changed

The client now provides a Gmail address, a unique ZMID, first name, and last name for every user, regardless of role — and wants a "Sign in with Google" option on the login screen. Google is used **only to verify the person controls that Gmail inbox** — it doesn't create accounts, doesn't change anyone's role, and nothing from the Google profile (name, photo) is ever trusted for display; the account still has to already exist here, created by an admin as before.

### New, additive — `POST /api/auth/google`, an alternative to `/login`, not a replacement

Password login is completely unchanged and still works. This is a second way to reach the same session:

1. Your frontend uses [Google Identity Services](https://developers.google.com/identity/gsi/web) to render the "Sign in with Google" button and obtain a signed **ID token** (a JWT) — this happens entirely client-side, no backend call needed to get it. You'll need the Google OAuth **Client ID** for this (not secret, safe to embed) — ask Ahmed for it, it's the same value the backend uses for `GOOGLE_CLIENT_ID`.
2. POST that raw token to `POST /api/auth/google` as `{ "idToken": "..." }`.
3. **200** — identical response shape to `/login`'s success case (`{ user, csrfToken }`, same cookies set). Handle it exactly the same way you already handle a successful password login — redirect by role, store `csrfToken` in memory, etc.
4. **403 `{ "error": "Access denied", "code": "NOT_REGISTERED" }`** — the Google token is valid, but that email isn't a registered account here (or it's been deactivated). Show an "Access Denied" screen. Don't retry, don't silently fall back to the password form.
5. **401** — the token itself is invalid/expired, or Google says the email isn't verified. Treat like a failed login attempt.
6. **503 `{ "error": "Google sign-in is not configured" }`** — the backend doesn't have `GOOGLE_CLIENT_ID` set yet. Only relevant if you deploy the frontend's Google button before the backend's env var is in place; fall back to password login.

Rate-limited (10 attempts / 15 min / IP), its own budget separate from `/login`'s.

### Breaking change: `POST /api/users`'s `name` field is gone, replaced by `firstName`/`lastName` — plus a new required `zmid`

**If your "create user" forms (Super Admin's direct-role-creation screen, District Supervisor's facility_supervisor-creation screen, Facility Supervisor's facility_worker-creation screen) send a single `name` field, they will now fail with a `400`.**

```jsonc
// this now 400s:
{ "email": "...", "password": "...", "name": "Jane Doe", "role": "..." }

// this is required instead:
{
  "email": "...",
  "password": "...",
  "firstName": "Jane",
  "lastName": "Doe",
  "zmid": "Z-1001",   // new — required, unique, free-text organization identifier, no format validation beyond non-empty
  "role": "..."
}
```

Every **response** that includes a user is unaffected — `name` still comes back exactly as before (now computed server-side as `` `${firstName} ${lastName}` `` at creation time), so any screen that only *displays* `name` needs no changes. It's only the creation *request* shape that changed. `GET /api/users` and every user-returning response now also include `firstName`/`lastName`/`zmid` directly (`null` for any account created before this round).

A duplicate `zmid` gets `409 { "error": "ZMID already in use" }`, same pattern as the existing duplicate-email `409`.

---

## Related docs

- `API_DOCUMENTATION.md` — the full API grouped by role, updated for everything above.
- `docs/api-reference.md` — the flat, endpoint-first JSON contract, updated for everything above.
- `docs/functionality.md` — the narrative "who can do what" breakdown, also updated.
- `users.md` (ask Ahmed — gitignored, contains real passwords) — the `ds.demo`/`fs.demo`/`fw.demo` trio now has a sample `received` entry (with batch metadata) and a `returned` entry on its `OPV` vaccine, if you want to see the new fields on real data without creating your own.
