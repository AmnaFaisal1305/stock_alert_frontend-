# Smart-Stock Alert — System Architecture (Final, Locked)

Reference document for the 20-day build. Every decision below is final for this pilot — items marked **Deferred** are intentionally out of scope and should not be built even if they seem easy.

---

## 1. System overview

Three deployables, one data flow direction:

```
Browser  →  Frontend (Vercel, Vite/React)  →  Backend API (Vercel, Express)  →  Neon Postgres
```

The frontend never talks to Neon directly. The backend is the only client of the database, always via a connection-pooled `pg` client using the service database role. There is no ORM-level or database-level Row-Level-Security layer — every authorization decision happens in Express middleware before a query is issued.

Both the frontend and backend are written to be portable: the backend uses the plain `app.listen()` Express pattern (not Vercel-specific handlers), so the same code runs unmodified in a Docker container on-prem later. A `Dockerfile` for the backend is written on Day 1, even though Vercel is used for the pilot deployment.

---

## 2. Frontend

**Stack:** Vite + React + Tailwind CSS + Recharts, deployed as its own Vercel project.

**Data fetching — TanStack Query (React Query), not manual `fetch`/`setInterval`.**
This is the single most important frontend decision: dashboard "live" updates are polling via `refetchInterval` (15–30s) on the relevant queries. React Query gives request deduplication, caching, automatic retry, and background refetch for free — a hand-rolled polling loop would end up reimplementing all of this, badly, under time pressure.

**Routing & guards:** React Router with role-based route guards. These guards are UX convenience only (hide/show nav items, redirect to login) — they are never the actual security boundary, since the backend re-checks role and scope on every request regardless of what the frontend renders.

**API client:** one `lib/api.js` wrapper — `fetch` with `credentials: 'include'` (to send the httpOnly auth cookie), a shared base URL from `VITE_API_URL`, and centralized error handling that surfaces a toast on failure.

**Forms:** controlled components with basic client-side validation (required fields, non-negative numeric stock counts). Always mirrored server-side — client validation is a UX nicety, never trusted alone.

**Environment:** `.env.local` (untracked) holding `VITE_API_URL` per environment.

**Deferred:** PWA/offline support, i18n, a component library beyond Tailwind utilities, client-side state beyond React Query's cache.

---

## 3. Backend

**Stack:** Node.js + Express, its own standalone Vercel project.

**Middleware pipeline (in order):**
1. `helmet` — standard security headers
2. `cors` — locked to the exact frontend origin, never `*`
3. `express.json()`
4. `express-rate-limit` — a light global limit, plus a strict limit specifically on `/api/auth/login`
5. Auth middleware — verifies the JWT from the httpOnly cookie
6. CSRF middleware — validates a double-submit token on mutating routes only (required because the auth cookie is `SameSite=None`; see Section 4)
7. RBAC middleware — checks role + scope for the specific route
8. Route handler
9. Centralized error-handling middleware — generic messages to the client in production, full detail only in server logs

**Folder structure:**
```
api/
  auth/login.js
  users/index.js
  stock-entries/index.js
  dashboard/index.js
  thresholds/[id].js
  audit-log/index.js
  reports/export.js
  _lib/
    db.js         # pg Pool, created once at module scope, wrapped in Drizzle
    auth.js       # hash, verify, sign, rate-limit — highest-priority file, build and test first
    rbac.js       # role + scope checks, shared by every route
    validate.js   # zod schemas per route
db/
  schema.ts       # Drizzle table definitions — source of truth for the schema
  migrations/     # Drizzle Kit-generated, versioned .sql files — never edited by hand
drizzle.config.ts
Dockerfile
```

**Database access — Drizzle ORM on top of `pg`, not raw SQL strings.** A `pg` Pool is created once at module scope, wrapped in `attachDatabasePool` from `@vercel/functions` so Vercel's Fluid compute drains idle connections correctly between invocations, then passed into Drizzle (`drizzle(pool, { schema })`). This keeps the exact same connection pattern already locked in this document while adding schema-typed queries — Claude Code gets compile-time errors for a wrong column name or type instead of a runtime bug in a hand-written query string. Drizzle adds no native binary and no cold-start overhead, so it doesn't change anything about the serverless or future self-hosted deployment story: the same `db/schema.ts` and generated SQL migrations run unchanged against Neon now and self-hosted Postgres later.

**Validation:** every mutating route validates its input with a `zod` schema before touching the database; invalid input returns `400` with field-level errors.

**Logging:** structured `console.log`/`console.error`, captured by Vercel's built-in runtime logs. No external logging service needed at this scale.

**Deferred:** message queues, background job runners, GraphQL, generated OpenAPI docs, API versioning prefixes (`/v1/`) — add only if a second consumer of this API actually appears.

---

## 4. Auth

Fully custom, built on hardened libraries — not hand-written cryptography.

- **Hashing:** `bcrypt`, cost factor 12.
- **Tokens:** `jsonwebtoken`, short-lived (~8 hours, matching a workday). No refresh-token rotation — at 10 users, expiry + re-login is simpler and sufficient.
- **Delivery:** **httpOnly, Secure, SameSite=None cookie** — not `localStorage`. Frontend and backend are separate Vercel projects on independent `*.vercel.app` domains (no shared parent domain for the pilot), which makes them cross-site in the browser's eyes: `SameSite=Strict` (or `Lax`) would silently stop the cookie from being sent on API calls at all. `SameSite=None` is required for the cookie to work across those two domains, but it reopens CSRF exposure that `Strict` would otherwise have closed — so a `csrf-csrf` (or equivalent double-submit) token is required on every mutating route as a result, not an optional hardening step. Revisit `SameSite=Strict` if frontend and backend are ever moved under one parent domain (`app.example.com` + `api.example.com`) — the CSRF token layer could then be dropped.
- **Rate limiting:** `express-rate-limit` specifically on `/api/auth/login` (e.g. 10 attempts / 15 minutes / IP), using the default in-memory store. **Known limitation, accepted for the pilot:** this store is per-serverless-instance, so the limit isn't strictly global across concurrent Vercel instances — at 10 known users this is judged low-severity. Revisit with a shared store (Upstash Redis or a Postgres-backed counter) only if the user base grows past a trusted-pilot scale.
- **Revocation:** a `token_version` integer column on `users`. Incrementing it (on forced logout or account deactivation) invalidates every previously issued token instantly, with no separate token-blocklist store needed.
- **Token claims:** `sub` (user id), `role`, `district_id`, `facility_id`, `token_version`, `exp`.
- **Account creation:** admin-cascaded only — there is no self-serve signup route at all. `POST /api/users` infers the creatable role from the caller's own role server-side; a request body can never claim a higher role than the caller is allowed to grant.
- **Password reset:** admin-triggered only, per the proposal — no self-serve email flow needed.

**Deferred:** OAuth/SSO, MFA, magic links, refresh-token rotation, self-serve password reset/email verification.

---

## 5. Database

**Neon Postgres** (free tier for the pilot). Schema — `districts`, `facilities`, `users`, `vaccines`, `thresholds`, `stock_entries`, `audit_log` — as designed in the ERD.

- **ORM:** Drizzle, not Prisma or raw query strings — chosen specifically for this stack. It has no native binary and near-zero cold-start overhead on Vercel serverless (unlike Prisma, which needs an add-on service like Accelerate to avoid cold-start penalties in serverless/edge environments), and it generates real, readable SQL rather than hiding it behind a query planner.
- **Migrations:** Drizzle Kit generates versioned, plain `.sql` files from `db/schema.ts` — never manual dashboard edits. These files are the same ones that replay identically on self-hosted Postgres later. Each generated migration should be read before committing — Drizzle's schema-diffing is solid for a schema this size, but not blindly trusted on every run.
- **Immutability:** `stock_entries` rows are never updated or deleted. Beyond the app-level convention, revoke `UPDATE`/`DELETE` grants on that table for the application's database role — real defense-in-depth given there's no RLS layer backing it up.
- **Indexes:** `facility_id` and `district_id` on relevant tables; a composite index on `stock_entries(facility_id, vaccine_id, created_at DESC)`, since "latest count per facility per vaccine" is the single most frequent query (dashboard load + every poll).
- **Constraints:** `role` as a Postgres `ENUM` or `CHECK`; `quantity >= 0` check constraints on `stock_entries` and `thresholds` — enforced at both the app and database layer.
- **Pooling:** Neon's built-in pooler, paired with the backend's `attachDatabasePool` pattern — no separate pooling infrastructure to run.
- **Free-tier ceiling vs. polling:** the free plan grants 100 CU-hours/month at a 0.25 CU floor (~400 always-on-equivalent hours); 15–30s dashboard polling prevents compute from scaling to zero while any user has a tab open. Confirm against actual usage hours (expected: business-hours-only across 3–4 facilities) before assuming the free tier covers the full pilot — a dashboard left open overnight is the failure mode to check for. Upgrade to the pay-as-you-go Launch plan if the estimate is tight.

**Deferred:** read replicas, table partitioning, full-text search, a separate analytics warehouse.

---

## 6. API design & security checklist

- REST, resource-based routes — a fixed whitelist of ~10 endpoints, never a generic query passthrough.
- Every mutating endpoint validates input with `zod` before any database call.
- Every response is shaped explicitly — never a raw row dump. `password_hash` and `token_version` never leave the backend.
- CORS locked to the exact frontend origin, with `credentials: true`.
- CSRF token (double-submit) required on every mutating route — the auth cookie is cross-site (`SameSite=None`) since frontend and backend sit on separate `*.vercel.app` domains, so CORS + cookie flags alone don't cover CSRF.
- `helmet` for security headers; HTTPS enforced automatically by Vercel.
- Global light rate limit on all routes; strict rate limit on `/api/auth/login`.
- Every mutation (account creation, threshold change, password reset) writes an `audit_log` row.
- Secrets (`JWT_SECRET`, `DATABASE_URL`) live only in Vercel environment variables — never committed to the repo.

---

## 7. Polling vs. WebSockets — final

**Polling, via TanStack Query's `refetchInterval` (15–30s). Not WebSockets, not Supabase/Postgres Realtime.**
At 10 users and 3–4 facilities this is simpler, has zero extra infrastructure, and comfortably fits the 20-day window. Revisit only if a future phase makes instant push a hard contractual requirement — not before.

---

## 8. Explicitly deferred — do not build any of this now

- Row-Level Security (the backend is the sole database client — RLS has no role to play here)
- OAuth / SSO / MFA / magic links
- Refresh-token rotation
- Multi-tenant abstraction beyond the existing `district_id`/`facility_id` foreign keys
- File storage / uploads
- Realtime / WebSockets
- CI/CD beyond Vercel's built-in git-push deploys
- API versioning prefix
- Read replicas, analytics warehouse, full-text search

---

## 9. Build sequence — ordered by technical dependency, not by the proposal's calendar

This intentionally departs from the day-by-day order in the signed proposal. That order was written for client-facing milestones (demo checkpoints); this one is written for correctness — each phase only starts once the phases it depends on are done, so nothing gets built twice and nothing gets built on a shaky foundation. Total is still 20 days.

**Ordering principle:** foundations → the highest-risk module (auth) → backend primitives → the hardest query (dashboard aggregation) → frontend, built role-by-role in ascending order of complexity, starting with the simplest full vertical slice → hardening → deployment. Building the Facility Worker screen before the Super Admin screen isn't about priority — it's the fastest way to prove the entire stack (login → RBAC → database → response) actually works end to end, before investing in the more complex screens.

| Days | Phase | What happens |
|---|---|---|
| 1–2 | Foundations | Repo scaffold, Neon project, `db/schema.ts` written and migrated via Drizzle Kit, seed script (districts, facilities, vaccines, one Super Admin), Express app skeleton with the full middleware pipeline (helmet, CORS, rate-limit, error handler), `Dockerfile` written |
| 3–4 | Auth & RBAC core | `_lib/auth.js` (bcrypt, JWT, httpOnly cookie, `token_version` revocation), `_lib/rbac.js`, `POST /api/auth/login`, cascade-only `POST /api/users` — and the RBAC test suite (cross-facility, cross-district denial) written *alongside*, not deferred to the end |
| 5–7 | Backend feature endpoints | `POST /api/stock-entries` (append-only), `PUT /api/thresholds/:id`, `POST /api/facilities`, `POST /api/districts`, `GET /api/vaccines` — every mutation wired to write an `audit_log` row |
| 8 | Dashboard aggregation | `GET /api/dashboard` — the single most complex query in the project (latest stock per facility per vaccine, colour status, scoped by role) — built once the simpler endpoints have proven the data model out |
| 9–10 | Frontend foundation | Vite/React/Tailwind scaffold, `lib/api.js` client (cookie-based `credentials: 'include'`), TanStack Query setup, login page, role-based route guards |
| 11 | Facility Worker screen | The simplest full vertical slice — login, RBAC, single entry form, confirmation. Deliberately built first among UI screens to validate the entire stack end to end while it's still cheap to fix anything broken |
| 12–13 | Facility Supervisor screens | Own-facility dashboard (first screen with polling wired in via `refetchInterval`), threshold management, Facility Worker account creation |
| 14–15 | District Supervisor & Super Admin screens | Multi-facility/district dashboards, cascading account creation UI, facility/district creation, audit log views — left for last because they depend on the dashboard aggregation query already being correct |
| 16 | Reports & admin polish | CSV export, remaining admin panel screens |
| 17–18 | Hardening | Expand the RBAC test suite, cross-browser testing, edge-case validation (negative stock, threshold boundaries), bug fixes |
| 19 | Deployment | Both Vercel Pro projects live, environment variables finalized, `Dockerfile` built and run locally once to confirm on-prem portability actually works, not just assumed |
| 20 | Handover | User guide, training material, final walkthrough, buffer for anything left over |

Client demos can still happen whenever makes sense commercially — this table just stops pinning technical work to specific demo dates, so a demo running long or short doesn't ripple into what gets built next.

---

## 10. User journeys by role — with technical mapping

**Governing rule, stated once so it isn't repeated per role:** every scope value (`district_id`, `facility_id`) used to filter a query is read from the caller's JWT, never from a request body or query parameter. A Facility Supervisor cannot submit `{ "facility_id": "someone-else's" }` and have it honored — the backend overwrites or validates it against the token on every write, and filters on it on every read. This single rule is what makes the four journeys below safe without RLS.

### Super Admin (AKUH)

**Journey:**
1. Logs in.
2. Sees a system-wide dashboard — every district, every facility, aggregated.
3. Creates new District profiles.
4. Creates District Supervisor accounts, one per district.
5. Views the full, unscoped audit log.
6. Can deactivate any account or force a password reset.

**Technical approach:**

| Step | Endpoint | Tables touched | RBAC scope |
|---|---|---|---|
| Login | `POST /api/auth/login` | `users` | — |
| System dashboard | `GET /api/dashboard` | `districts`, `facilities`, `stock_entries`, `thresholds` | No scope filter — `role = super_admin` sees all rows |
| Create district | `POST /api/districts` | `districts` | Role-gated only; no district/facility scope to enforce |
| Create District Supervisor | `POST /api/users` | `users`, `audit_log` | Role check restricts the `role` field in the request body to `district_supervisor` only — Super Admin cannot use this same endpoint to directly create a Facility Supervisor or Worker, preserving the cascade |
| Audit log | `GET /api/audit-log` | `audit_log` | Unscoped |
| Deactivate / reset password | `PUT /api/users/:id/reset-password`, `PUT /api/users/:id/deactivate` | `users`, `audit_log` | Unscoped, any user |

**JWT claims:** `role: super_admin`, `district_id: null`, `facility_id: null`.

---

### District Supervisor

**Journey:**
1. Logs in.
2. Sees a dashboard scoped to their own district — every facility within it, colour-coded.
3. Creates Facility profiles within their district.
4. Creates Facility Supervisor accounts, one per facility.
5. Views facility-level stock history and the audit log, scoped to their district.

**Technical approach:**

| Step | Endpoint | Tables touched | RBAC scope |
|---|---|---|---|
| Login | `POST /api/auth/login` | `users` | — |
| District dashboard | `GET /api/dashboard` | `facilities`, `stock_entries`, `thresholds` | `WHERE district_id = token.district_id` |
| Create facility | `POST /api/facilities` | `facilities` | New row's `district_id` forced to `token.district_id`, never taken from the request body |
| Create Facility Supervisor | `POST /api/users` | `users`, `audit_log` | Role restricted to `facility_supervisor`; the new user's `facility_id` must belong to a facility already in `token.district_id`, checked server-side before insert |
| District audit log | `GET /api/audit-log` | `audit_log` | `WHERE district_id = token.district_id` |

**JWT claims:** `role: district_supervisor`, `district_id: X`, `facility_id: null`.

---

### Facility Supervisor

**Journey:**
1. Logs in.
2. Sees a dashboard for their one assigned facility.
3. Creates Facility Worker accounts for that facility.
4. Records stock quantities received from the district store.
5. Sets or edits minimum thresholds, per vaccine, for their facility.
6. Monitors the colour-coded alert status, refreshed by polling.

**Technical approach:**

| Step | Endpoint | Tables touched | RBAC scope |
|---|---|---|---|
| Login | `POST /api/auth/login` | `users` | — |
| Facility dashboard | `GET /api/dashboard` | `stock_entries`, `thresholds` | `WHERE facility_id = token.facility_id` |
| Create Facility Worker | `POST /api/users` | `users`, `audit_log` | Role restricted to `facility_worker`; new user's `facility_id` forced to `token.facility_id` |
| Record received stock | `POST /api/stock-entries` | `stock_entries`, `audit_log` | `facility_id` forced to `token.facility_id`; row is append-only, never updated |
| Set threshold | `PUT /api/thresholds/:id` | `thresholds`, `audit_log` | Target threshold's `facility_id` must equal `token.facility_id`, checked before update |
| Poll for updates | `GET /api/dashboard` (repeated) | `stock_entries`, `thresholds` | Same facility scope, re-checked on every poll — not just at login |

**JWT claims:** `role: facility_supervisor`, `district_id: X`, `facility_id: Y`.

---

### Facility Worker

**Journey:**
1. Logs in from a phone browser.
2. Sees a single, simple entry form — no dashboard, no other facilities visible.
3. Selects a vaccine, enters the exact dose count, submits.
4. Sees their own facility's current stock status as read-only confirmation.

**Technical approach:**

| Step | Endpoint | Tables touched | RBAC scope |
|---|---|---|---|
| Login | `POST /api/auth/login` | `users` | — |
| Load entry form | `GET /api/vaccines`, `GET /api/dashboard` (own facility only) | `vaccines`, `stock_entries`, `thresholds` | `WHERE facility_id = token.facility_id` |
| Submit stock count | `POST /api/stock-entries` | `stock_entries`, `audit_log` | `facility_id` forced to `token.facility_id`; validated non-negative via `zod` before insert |

**JWT claims:** `role: facility_worker`, `district_id: null` (not needed at this scope), `facility_id: Y`.

*Note: a Facility Worker's token carries only `facility_id` — the RBAC middleware denies this role access to `/api/dashboard`'s multi-facility view, `/api/users`, `/api/thresholds`, and `/api/audit-log` entirely, at the role-check layer, before any facility-scope check even runs.*
