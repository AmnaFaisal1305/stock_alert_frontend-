# Test Accounts — Frontend QA

One account per role, created against the real seeded district/facility in the shared dev database (not a separate mock dataset) — so what you see here matches what a real deployment looks like. Passwords are dummy/test-only, not meant to be secure; do not reuse them anywhere real.

**This file is gitignored — it is not, and should not be, committed.** It contains real passwords into the shared dev database. Share it with teammates the same way `.env` values are shared (a secure channel, not a commit).

---

## Accounts

| Role | Email | Password | Scope |
|---|---|---|---|
| `super_admin` | `admin@akuh.pilot` | YZVbffkya-9gkFrI | 
| `district_supervisor` | `ds.demo@akuh.pilot` | `Demo1234!` | Karachi Central (district) |
| `facility_supervisor` | `fs.demo@akuh.pilot` | `Demo1234!` | AKUH Main Campus (facility, in Karachi Central) |
| `facility_worker` | `fw.demo@akuh.pilot` | `Demo1234!` | AKUH Main Campus (same facility as `fs.demo`) |

All four were created through the real cascade (`POST /api/users`), not inserted directly — `ds.demo` was created by `admin@akuh.pilot`, `fs.demo` by `ds.demo`, `fw.demo` by `fs.demo`. Each has been verified to log in and to hit its scoped endpoints correctly (dashboard read, a stock entry submitted and confirmed visible on the dashboard).

For what each of these roles can actually do once logged in, see **`docs/functionality.md`** — this file is just the credentials, not the capability list.

---

## Seed data these accounts sit on top of

- **District:** Karachi Central
- **Facilities:** AKUH Main Campus, AKUH Clifton Clinic (both in Karachi Central — only `fs.demo`/`fw.demo` are tied to Main Campus; there's no dummy account for Clifton Clinic yet, ask if you need one for cross-facility testing)
- **Vaccines:** BCG, OPV, Pentavalent, Measles, PCV — all five now have a threshold row on both facilities (see note below). As of the latest round, a threshold row's `minQuantity` defaults to `null` ("not yet configured"), not `0` — so on a fresh dashboard load, expect these to show `status: "no_data"` until someone explicitly sets a real value via `PUT /api/thresholds/:id`. This is expected, not a bug: `null` and an explicitly-set `0` are now different things (see `docs/api-reference.md`).

## One data-integrity issue found and fixed while setting this up

While verifying these accounts against the dashboard, `AKUH Main Campus` was showing only 1 of the 5 expected vaccines, and `AKUH Clifton Clinic` was **not showing up on the dashboard at all**. Root cause: both facilities were missing most or all of their `thresholds` rows (`GET /api/dashboard`'s main query `innerJoin`s FROM `thresholds`, so a facility/vaccine pair with no threshold row is invisible, not just empty). This predates these test accounts — it looks like `db/seed.ts` was run before all 5 vaccines existed in the seed script, and was never re-run after the vaccine list grew, so the two original facilities never got backfilled the way a facility created *now* via `POST /api/facilities` would be. Backfilled the missing rows directly (`minQuantity: 0` at the time, matching the app's default then in use) — both facilities now correctly show all 5 vaccines. Note: the app's default has since changed to `minQuantity: null` (see the vaccines note above); a later migration converted every then-`0` row, including these backfilled ones, to `null`. This isn't expected to recur: it was a one-time gap in already-existing seed data, not a bug in the current facility-creation code path (which provisions thresholds correctly for anything created from here on, and is covered by `test/dashboard.test.js`/the transaction added around it).

---

## A heads-up on the dev database's current state

`GET /api/districts`, `GET /api/facilities`, and `GET /api/users` currently return **132 districts, 154 facilities, and 386 users** respectively — not because that data is meaningful, but because every automated test run in this repo executes against this same real dev database (no mocked DB, per `docs/repository-guide.md` §9) and creates its own randomly-named fixtures that are never cleaned up afterward. None of it collides with the seed data or these four dummy accounts (test fixtures use randomized `crypto.randomUUID()` names/emails, these use fixed ones), but it does mean any UI you build that lists districts/facilities/users (a picker dropdown, an admin table) will show a lot of test noise if pointed at this same database. Worth a cleanup pass before this goes anywhere near a real demo — flagging it here rather than silently leaving it for you to discover mid-testing.

---

## Quick manual test (curl)

```bash
# Log in and capture the session cookie + CSRF token
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fs.demo@akuh.pilot","password":"Demo1234!"}'
# -> { "user": {...}, "csrfToken": "..." }

# Any GET just needs the cookie
curl -b cookies.txt http://localhost:3000/api/dashboard

# Any mutation also needs the csrfToken from login, as a header
curl -b cookies.txt -X PUT http://localhost:3000/api/thresholds/<thresholdId> \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <csrfToken from login>" \
  -d '{"minQuantity": 10}'
```

Full request/response shapes: `docs/api-reference.md`.
