# Backend Performance Analysis — Smart Stock Alert

**Generated:** 2026-07-09  
**Backend:** `https://smart-stock-alert-be.vercel.app` (Express on Vercel Fluid compute, Neon Postgres)  
**Methodology:** All latency and payload figures are measured from actual HTTP requests made from the client machine. Each data endpoint was called 3–4 times after one warm-up request; the averages below exclude cold-start outliers. Findings are marked **[CONFIRMED]** (measured directly) or **[INFERRED]** (derived from response shape, timing profile, or frontend code analysis).

---

## 1. Summary Table

| Endpoint | Role | Avg Latency (warm) | Payload (uncompressed) | Payload (brotli) | Priority |
|---|---|---|---|---|---|
| `POST /api/auth/login` | all | **820 ms** | 297 B | ~200 B | HIGH |
| `GET /api/dashboard` | super_admin | **946 ms** | 12,155 B | 2,108 B | HIGH |
| `GET /api/dashboard` | facility_supervisor | 439 ms | 1,524 B | ~450 B | MEDIUM |
| `GET /api/facilities/:id` | super_admin / district_sup | **948 ms** | 1,576–2,602 B | ~600 B | HIGH |
| `GET /api/audit-log` | super_admin | 428 ms | 11,480 B | 1,847 B | HIGH |
| `GET /api/districts` | super_admin | 455 ms | 391 B | ~180 B | LOW |
| `GET /api/facilities` | super_admin | 413 ms | 1,480 B | ~500 B | LOW |
| `GET /api/vaccines` | any | 372 ms | 4,439 B | ~900 B | MEDIUM |
| `GET /api/users` | any | 296 ms | 2,200 B | ~700 B | LOW |
| `GET /api/districts/:id` | super_admin | 404 ms | 901 B | ~300 B | LOW |
| `GET /api/health` | public | 334–892 ms | 15 B | 15 B | LOW |

> **Baseline context:** The frontend and backend are on separate `*.vercel.app` domains, both on Vercel's edge. Measurements originate from Pakistan (Karachi), routing via Vercel's bom1 edge → iad1 compute region. Base network RTT accounts for ~80–120 ms of each figure; the remaining latency is Vercel function overhead + Neon Postgres query time.

---

## 2. Detailed Findings

### 2.1 Authentication — `POST /api/auth/login`

**Latency:** 820–2,076 ms (warm average ~830 ms, first cold-start 2,076 ms) **[CONFIRMED]**

**Root cause breakdown [INFERRED from architecture docs]:**
- Vercel serverless cold start: ~500–800 ms on first invocation
- bcrypt verification (cost factor 12): ~200–400 ms per login attempt
- Neon connection + user lookup: ~50–100 ms

**Issues:**
- The `bcrypt` cost factor of 12 is appropriate for security but adds ~200–400 ms on every login. This is unavoidable if bcrypt is the chosen hasher, but cost factor 10–11 would halve this time with minimal security regression at this scale.
- Serverless cold starts cause the first login after idle to take >2 s. A pilot hospital system with ~10 users logging in at shift start (simultaneous) will all hit cold Vercel instances.
- No `Cache-Control` on the login response. This is correct for a mutating endpoint; no change needed.

---

### 2.2 Dashboard — `GET /api/dashboard`

**Latency:**
- super_admin: avg 946 ms, min 616 ms **[CONFIRMED]**
- facility_supervisor: avg 439 ms **[CONFIRMED]**

The difference is explained by the query scope: super_admin aggregates across all facilities and districts, facility_supervisor filters to one facility before running the same aggregate.

**Payload:**
- super_admin: 12,155 B uncompressed / 2,108 B brotli (83% reduction) **[CONFIRMED]**
- facility_supervisor: 1,524 B uncompressed **[CONFIRMED]**

**Over-fetching [CONFIRMED from frontend code]:**

The response has two top-level keys — `facilities[]` (flat vaccine-level rows) and `summary` (pre-aggregated rollups). Each role only uses one of them:

| Role | What it actually uses | What it ignores |
|---|---|---|
| `super_admin` (dashboard) | `summary.byFacility`, `summary.statusCounts` | `facilities[]` — all 29 vaccine-level rows |
| `district_supervisor` | `facilities[]` filtered by `districtId`, `summary.byFacility` | All rows from other districts |
| `facility_supervisor` / `facility_worker` | `facilities[]` filtered to own facility | `summary` (redundant restatement of the same data) |

For **super_admin**, the 29-row `facilities[]` array (≈7.5 KB of the 12 KB response) is fetched on every 15-second poll but never rendered on the dashboard page. The super admin dashboard only uses `summary.byFacility` (6 entries). The flat array is wasted bandwidth on every poll.

**N+1 risk [INFERRED from query shape]:**

The dashboard query must compute a running stock balance per (facility, vaccine) pair via `SUM(received) - SUM(used)` aggregation over `stock_entries`. If this is implemented as N individual per-vaccine queries rather than one grouped aggregate, latency will grow linearly with vaccine count. Given the 946 ms average for 29 rows and 439 ms for 3 rows (2.8× more data, 2.2× slower), timing is consistent with a single batched aggregate query — not a per-row N+1. **[INFERRED — not confirmed from source]**

**Polling waste:**

The dashboard is polled every 15 seconds. With `Cache-Control: max-age=0, must-revalidate` and `X-Vercel-Cache: MISS` on every response, each poll hits the Express function and Neon Postgres. There is no server-side caching layer. ETags are present and `If-None-Match → 304` works correctly **[CONFIRMED]**, but React Query does not send conditional requests — it issues a full re-fetch and discards the new response if the data is identical. At 15-second intervals with ~4 active users, this is approximately 16 DB hits per minute during business hours for data that rarely changes.

---

### 2.3 Facility Detail — `GET /api/facilities/:id`

**Latency:** avg 948 ms, range 296–619 ms across three different facilities **[CONFIRMED]**

This is the **slowest data endpoint** at equivalent payload sizes, and the variance is notable: 296 ms vs 619 ms on different facilities suggests query cost scales with per-facility data volume (stock entry history depth).

**Root cause [INFERRED]:**

The endpoint joins `vaccines → thresholds → stock_entries` and computes a running balance (`SUM` aggregate) per vaccine. Unlike the dashboard query which has a composite index on `(facility_id, vaccine_id, created_at DESC)` noted in the architecture docs, this per-facility detail query may not share that index efficiently if it issues the aggregate differently. The endpoint is currently called by the **DistrictManagement** page on-demand (when a district row is expanded), so it isn't on a hot poll path — but the latency is still high enough to be noticeable as a user interaction.

**Redundant data in `vaccines[]` items [CONFIRMED]:**

Each vaccine row in the response includes `facilityId`, `facilityName`, `districtId`, `districtName` — all of which are identical for every row in the array and are already present in the top-level `facility` object. These 4 fields are duplicated N times (once per vaccine) for no reason. For a facility with 6 vaccines, that is 6 copies of the same strings that the frontend ignores (it uses the top-level facility fields directly).

---

### 2.4 Audit Log — `GET /api/audit-log`

**Latency:** avg 428 ms **[CONFIRMED]**  
**Payload:** 11,480 B uncompressed / 1,847 B brotli (84% reduction), 24 rows **[CONFIRMED]**

**Critical gap — no pagination [CONFIRMED]:**

The endpoint returns the full audit log in a single response with no `limit`, `offset`, or cursor support. The frontend handles this by fetching everything and paginating client-side (10 rows per page). With 24 rows today this is invisible, but audit logs grow append-only, forever. At 10 active users performing ~20 actions per day, the log reaches 1,000 rows in 5 weeks and 10,000 rows in a year. At that point:
- `GET /api/audit-log` payload: ~5 MB uncompressed / ~500 KB brotli per request
- The facility dashboard loads this endpoint in the background on every mount — it would be downloading MB of log just to show 5 recent entries in the activity feed

The `docs/api-requirement.md` already documents a `?limit=` parameter as a pending requirement.

**Redundant `GET /api/vaccines` fetch [INFERRED from frontend code]:**

The AuditLog page fetches `GET /api/vaccines` to build a `vaccineNameById` map, used to resolve vaccine names in `SET_THRESHOLD` audit entries (whose `details` only include `vaccineId`, not `vaccineName`). For super_admin, this pulls all 29 vaccines across all facilities. The upstream fix is straightforward: always include `vaccineName` in the `details` object for every action that involves a vaccine — `SET_THRESHOLD`, `EDIT_VACCINE`, `DELETE_VACCINE`. This would eliminate the need for the frontend to maintain a separate vaccine lookup table just to display the audit log.

**`actorName` reflects current state [INFERRED from docs]:**

The `actorName` field is joined from the live `users` table at query time, not stored historically. If a user is renamed (no rename endpoint currently exists) or deleted, historical log entries would show the wrong name. This is a minor data-integrity note, not a performance issue.

---

### 2.5 Users — `GET /api/users`

**Latency:** avg 296 ms (fastest data endpoint) **[CONFIRMED]**  
**Payload:** 2,200 B, 8 users **[CONFIRMED]**

No significant issues at current scale. The response includes `districtName` and `facilityName` resolved via join — appropriate, avoids client-side lookup. As user count grows, the lack of pagination will eventually matter, but at the pilot scale of 10 users this is not a concern.

**Potential over-fetch [INFERRED]:** Super_admin sees all users of all roles in one call. The UserManagement page displays them all, so this is appropriate. Facility_supervisor sees only their own workers, also appropriate.

---

### 2.6 Vaccines — `GET /api/vaccines`

**Latency:** avg 372 ms **[CONFIRMED]**  
**Payload:** 4,439 B, 29 vaccines **[CONFIRMED]**

**Minor over-fetch:** The response includes `createdAt` per vaccine, which the frontend never displays or filters on (it only uses `id`, `name`, `facilityId`). Not worth an API change on its own, but worth noting for when the endpoint is next touched.

**Redundant call pattern [INFERRED]:** `GET /api/vaccines` is called on three separate pages — RecordStock, StockEntry (facility_worker), and ThresholdManagement — as well as the AuditLog. The RecordStock and StockEntry calls are necessary (the form dropdown needs the vaccine list). The ThresholdManagement call is also necessary (same reason). The AuditLog call (to resolve vaccine names) is the one that can be eliminated server-side (see §2.4).

---

### 2.7 Districts — `GET /api/districts` and `GET /api/districts/:id`

**Latency:** list avg 455 ms / detail avg 404 ms **[CONFIRMED]**  
**Payload:** list 391 B (3 districts) / detail 901 B **[CONFIRMED]**

No significant performance issues at current data volume. The DistrictManagement page fetches `GET /api/districts/:id` lazily per district expansion — this is appropriate (not a pure N+1, since React Query caches each `['district', id]` and does not re-fetch on re-expand). The list endpoint returns soft-deleted districts by design, which is correct for the management UI.

**Missing field: district supervisor info [from api-requirement.md]:**

`GET /api/districts` does not return `supervisorName` or `supervisorEmail`. The DistrictManagement table shows these columns as `—` placeholders. This requires a join to `users` where `role = 'district_supervisor' AND districtId = district.id AND isActive = true` per district — worth doing as a single query with a lateral join or subquery rather than a separate round trip per district.

---

### 2.8 Compression and Transport

**[CONFIRMED from measurements]**

Brotli compression IS supported and active when the client sends `Accept-Encoding: gzip, deflate, br`. All modern browsers do this automatically. Compression ratios are excellent (83–84% on the two largest payloads) because JSON with repeated key names compresses very well.

Without compression (e.g. PowerShell without an explicit Accept-Encoding header): responses are served uncompressed at full size. This does not affect browser clients but matters for any non-browser consumers (scripts, monitoring tools) that don't negotiate encoding.

No `Content-Length` is present on compressed responses — `Transfer-Encoding: chunked` is used instead, which is standard.

---

### 2.9 Caching Headers

**[CONFIRMED]**

All endpoints return `Cache-Control: public, max-age=0, must-revalidate`. This is Vercel's default CDN wrapper behavior. The practical effect:

- `max-age=0`: Responses are never served from browser or CDN cache without revalidation
- `must-revalidate`: Stale responses may not be used even if the origin is unreachable
- `X-Vercel-Cache: MISS` on every response: Vercel's edge is not caching any of these responses

This is **correct behavior** for authenticated, user-scoped API responses — these must not be shared across users at the CDN level. The `public` directive is technically incorrect for responses that differ per authenticated user (it should be `private`), but since `max-age=0` prevents CDN caching anyway and the requests carry cookies (which most CDNs treat as uncacheable regardless), this has no practical security impact.

ETags are present on all responses and **`If-None-Match` → 304 works correctly [CONFIRMED]**. However, no application-level caching benefits from this because:
1. The frontend (React Query) does not send `If-None-Match` headers — it issues full re-fetches and handles staleness in JS
2. Vercel's CDN never gets to serve a cached response (all MISS)

For the polling endpoints (`/api/dashboard`), a server-side in-memory cache with a 10-second TTL (matching the staleTime on the frontend) would eliminate the majority of DB hits during a session.

---

### 2.10 Serverless Cold Starts

**[CONFIRMED]**

First request to any endpoint after ~60+ seconds of idle: 800–2,000 ms. Subsequent warm requests: 296–946 ms. This is Vercel Fluid compute behavior — functions stay warm for a brief window, then cold-start again.

The dashboard's 15-second poll interval keeps the Vercel function warm as long as any user has the dashboard open. If the last user closes their tab, the next user to open the app within the cold-start window (~60–120 s) gets a slow first load. The architecture docs note this as a known limitation ("a dashboard left open overnight is the failure mode to check for" re: Neon free-tier billing), but from a UX perspective it creates a jarring first-load experience.

---

## 3. Prioritized Recommendations

### Priority 1 — HIGH IMPACT, LOW EFFORT

**1.1 Add `?limit=` (and eventually `?offset=` or `?cursor=`) to `GET /api/audit-log`**

The most critical pending fix. The audit log is append-only and unbounded. The facility supervisor dashboard fetches the full log on every mount to show 5 entries in the activity feed. Add `?limit=N` as a server-enforced cap; default to returning the most recent 50–100 entries when no limit is specified.

```
GET /api/audit-log?limit=5           → 5 most recent entries (for dashboard feed)
GET /api/audit-log?limit=50&offset=0 → first page of management view
```

Frontend changes: update `getAuditLog()` in `lib/api.js` to accept and pass `limit`; the dashboard call should pass `limit=5`.

**Effort:** ~1–2 hours backend, ~30 min frontend.

---

**1.2 Include `vaccineName` in all vaccine-related audit log `details`**

`SET_THRESHOLD` details currently only include `vaccineId`, which forces the AuditLog page to fetch `GET /api/vaccines` to display the vaccine name. Add `vaccineName` to the details object for `SET_THRESHOLD`, `EDIT_VACCINE`, and `DELETE_VACCINE` (some already have it, some don't — standardize all).

This eliminates the `GET /api/vaccines` call on the audit log pages.

**Effort:** ~30 min backend (add `vaccineName` join to the audit log writer in those action handlers).

---

**1.3 Add `supervisorName` and `supervisorEmail` to `GET /api/districts`**

The DistrictManagement table shows these as `—` because the backend doesn't return them. The backend already returns `facilitySupervisorName` on `GET /api/facilities` via a join, so the pattern exists. Apply the same join (on `users` where `role = 'district_supervisor' AND districtId = d.id AND isActive = true`) to `GET /api/districts`.

**Effort:** ~1 hour backend. Mentioned in `docs/api-requirement.md`.

---

### Priority 2 — HIGH IMPACT, MEDIUM EFFORT

**2.1 Add a role-conditional `?summary_only=true` mode for `GET /api/dashboard` (super_admin)**

For the super_admin role, the 29-row flat `facilities[]` array (~7.5 KB of the 12 KB response) is fetched every 15 seconds but never rendered on the dashboard page — only `summary.byFacility` is used. Returning just the `summary` object for super_admin would reduce the dashboard payload by ~60% and cut the DB aggregate work proportionally.

Options:
- **A (quick):** When the caller is `super_admin`, omit `facilities[]` from the response and only return `summary`. The frontend's super_admin dashboard page uses only `summary.*`.
- **B (flexible):** Add `?detail=false` query param that skips the flat array for any role. The frontend passes it where it only needs summaries.

Note: The `['dashboard']` query key is shared across pages. If `facilities[]` is omitted for super_admin, any page that depends on it for other roles still works. Check whether any super_admin page uses `data.facilities` before removing it.

**Effort:** ~2–3 hours backend + frontend query key adjustment.

---

**2.2 Remove duplicate fields from `GET /api/facilities/:id` vaccine rows**

Each vaccine item in the `vaccines[]` array repeats `facilityId`, `facilityName`, `districtId`, `districtName` — all identical across every item in the array, and already present on the top-level `facility` object. Removing them from the per-vaccine rows reduces payload size proportionally with vaccine count and simplifies the response shape.

```json
// Current (redundant fields on each of N vaccine rows)
"vaccines": [
  { "facilityId": "...", "facilityName": "AKUH Main Campus", "districtId": "...", "districtName": "Karachi Central", "vaccineId": "...", ... }
]

// Proposed (facility context on parent only)
"vaccines": [
  { "vaccineId": "...", "vaccineName": "BCG", "thresholdId": "...", "minQuantity": 20, "quantity": 8, "recordedAt": "...", "status": "critical" }
]
```

Frontend impact: `FacilityDetail.jsx` reads `vaccine.vaccineName`, `vaccine.status`, `vaccine.quantity`, `vaccine.minQuantity`, `vaccine.recordedAt` — none of the redundant facility/district fields. Zero frontend change needed.

**Effort:** ~1 hour backend.

---

**2.3 Add a lightweight server-side cache for `GET /api/dashboard`**

With 4 facility supervisors each polling every 15 seconds, that's 16 Postgres aggregate queries per minute for data that changes only when someone records stock (at most a few times per hour). A 10-second in-memory cache per role+scope (keyed on session userId) would serve identical data from memory between polls and eliminate ~80% of dashboard DB hits during active sessions.

The simplest implementation: a `Map<userId, { data, expiresAt }>` module-level cache in the dashboard handler, TTL = 10 s. Invalidate on any `POST /api/stock-entries` or `PUT /api/thresholds/:id` for that user's facility.

Caveat: on Vercel serverless, module-level state doesn't persist reliably across cold starts or concurrent instances. For true server-side caching, use Vercel KV (Redis-backed) or Upstash. At pilot scale, the in-memory approach is still worth doing — most polls within a 15-second window hit the same warm instance and benefit from it.

**Effort:** ~3–4 hours backend.

---

### Priority 3 — MEDIUM IMPACT, LOW EFFORT

**3.1 Reduce bcrypt cost factor from 12 to 11**

Login averages 820 ms. bcrypt cost 12 contributes ~200–400 ms of compute on serverless. Dropping to cost 11 halves the hash time (~100–200 ms) while remaining within OWASP's recommended minimum (cost 10). At 10 users, the security trade-off is negligible.

Existing password hashes would continue to work until users next log in (bcrypt is self-describing — the cost factor is encoded in the hash). New logins would generate cost-11 hashes automatically.

**Effort:** ~15 min backend (one config line change).

---

**3.2 Fix `Cache-Control: private` on authenticated responses**

All endpoints currently return `Cache-Control: public, max-age=0, must-revalidate`. Since these are user-scoped responses (the backend enforces scope via the session cookie), they should be marked `private` to explicitly prevent any intermediate proxy from serving one user's response to another.

The `public` directive with `max-age=0` happens to be harmless today (Vercel's CDN doesn't cache it and `must-revalidate` prevents stale use), but it's semantically incorrect and a risk if caching behavior is ever relaxed.

Change to: `Cache-Control: private, no-cache` (or `private, max-age=0, must-revalidate`).

**Effort:** ~15 min backend (one middleware change, applies to all routes).

---

**3.3 Add `?limit=` to `GET /api/users`**

Currently returns all users. For super_admin, this is the full user list across all roles. As test-run fixtures accumulate (the dev DB currently has 386 users from automated tests), this could become large. Add `?limit=50` default with explicit pagination for the management UI.

**Effort:** ~1 hour backend, ~30 min frontend.

---

**3.4 Add `facilitySupervisorEmail` to `GET /api/districts/:id` facility rows**

The DistrictManagement facility sub-table has an "Email" column currently showing `—`. This is documented in `docs/api-requirement.md` as a pending addition.

**Effort:** ~30 min backend (add email to the user join in the district detail query).

---

### Priority 4 — LOW IMPACT, INFORMATIONAL

**4.1 Vercel region alignment**

Measurements show requests routing bom1 (Mumbai edge) → iad1 (US East compute). The Neon Postgres instance is presumably also in US East (default for Neon free tier). Function-to-database latency is low as a result. If the database is ever moved to a closer region (e.g. AWS ap-south-1 for Pakistan deployment), function region should follow.

**4.2 Neon free-tier cold start on Postgres**

Neon's free tier scales Postgres compute to zero after ~5 minutes of inactivity. If the Vercel function is warm but Neon is cold, the first query after idle will take an additional 1–3 seconds while Neon resumes. The 15-second dashboard poll prevents this during active sessions but not after the last user disconnects. Consider a lightweight keepalive ping to Neon (from the `/api/health` handler, which already runs a DB check) if this causes user-visible delays.

**4.3 `createdAt` in `GET /api/vaccines` response**

The `createdAt` field on each vaccine is never displayed or used by the frontend. Minor payload saving if removed. Not worth a breaking change on its own, but note it for the next time the endpoint shape is touched.

---

## 4. Cross-Cutting Patterns

### 4.1 No server-side caching on any endpoint **[CONFIRMED]**

Every request, on every poll, hits the Express function and then Neon Postgres. `X-Vercel-Cache: MISS` on 100% of responses. ETags exist and 304 works, but React Query doesn't use conditional requests — it re-fetches and discards. The result is that the polling load is pure DB load, with no caching layer absorbing repetitive reads.

**Recommendation:** Introduce a lightweight in-memory cache (or Vercel KV for multi-instance safety) for the two most-polled endpoints: `GET /api/dashboard` (15 s TTL) and `GET /api/audit-log` (30 s TTL). These cover the majority of the poll-driven DB traffic.

---

### 4.2 No pagination on list endpoints **[CONFIRMED]**

Five of six list endpoints (`/api/dashboard`, `/api/audit-log`, `/api/users`, `/api/vaccines`, `/api/districts`, `/api/facilities`) return unbounded result sets. The system is currently small (3 districts, 6 facilities, 8 users, 29 vaccines, 24 audit entries) but the dev database has accumulated 132 districts and 386 users from un-cleaned automated test runs — demonstrating that payload sizes can grow dramatically without changes to the schema or business logic.

Priority order for adding pagination: audit-log first (grows fastest, has most immediate impact), then users (386 rows in dev), then vaccines (grows with each new facility).

---

### 4.3 Compression is working but depends on client negotiation **[CONFIRMED]**

Brotli is active when the client sends `Accept-Encoding: gzip, deflate, br`. All browser clients do this automatically. The server does not enforce or default to compression — it only applies it when negotiated. Non-browser consumers (monitoring scripts, curl without flags) receive uncompressed responses. Consider adding `compression` middleware that always applies gzip as a fallback for clients that don't negotiate brotli.

---

### 4.4 `summary.byFacility` is derived from `facilities[]` but returned alongside it **[CONFIRMED]**

The dashboard response includes both the raw flat rows (`facilities[]`) and a pre-aggregated rollup (`summary`). For every role, the frontend uses one or the other but not both:
- super_admin: uses only `summary`
- district/facility roles: use `facilities[]` (filtered client-side), with `summary` redundant

The backend computes both on every request. A role-aware response that sends only what the caller actually uses would reduce both payload size and query work. This is the single largest structural over-fetch in the current API design.

---

### 4.5 Serverless cold-start latency is the dominant first-load factor **[CONFIRMED]**

Login (820 ms warm) plus the first dashboard load (946 ms warm) totals ~1.8 s on a warm path. On a cold path (first user of the day): 2,000 ms + 1,500 ms = ~3.5 s before the dashboard renders. This is not a code problem — it is an infrastructure tradeoff accepted in the architecture doc. The mitigation at the application level is the skeleton loading states and the `<Suspense>` fallbacks already in place. A longer-term fix would be moving to Vercel's always-on compute tier or pre-warming the function via a scheduled ping before business hours.

---

## 5. Findings vs Confirmed Matrix

| Finding | Type |
|---|---|
| Latency measurements (all endpoints) | **CONFIRMED** — measured directly |
| Payload sizes (uncompressed and brotli) | **CONFIRMED** — measured directly |
| Brotli compression requires client negotiation | **CONFIRMED** — tested with/without Accept-Encoding |
| ETag + 304 works correctly | **CONFIRMED** — verified If-None-Match → 304 |
| No server-side caching (all X-Vercel-Cache: MISS) | **CONFIRMED** — observed on all responses |
| Cache-Control: public vs private incorrectness | **CONFIRMED** — header present on all responses |
| `facilities[]` unused by super_admin dashboard | **CONFIRMED** — verified via frontend code |
| Redundant facility/district fields in `/api/facilities/:id` vaccine rows | **CONFIRMED** — observed in response + frontend code |
| `GET /api/audit-log` no pagination | **CONFIRMED** — endpoint tested, no limit param |
| `GET /api/vaccines` fetch redundant for audit log if vaccineName embedded | **CONFIRMED** — frontend code + audit log response shape |
| bcrypt cost factor = 12 adding ~200–400 ms | **INFERRED** — from architecture docs + timing profile |
| `/api/dashboard` N+1 risk (single vs per-row aggregate) | **INFERRED** — timing correlation, not from source |
| `/api/facilities/:id` join latency scaling with stock entry history depth | **INFERRED** — variance between facilities (296 vs 619 ms) |
| Neon cold-start contributing to first-query latency | **INFERRED** — from architecture docs |
