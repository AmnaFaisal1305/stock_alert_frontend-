# Backend Requests: UI/UX Revamp

Merged to `main` 2026-10-18 (UI/UX consistency revamp, session 13)

These are API or data changes that would let the frontend deliver a clearer UX. The revamp does **not** depend on them: each screen ships with a frontend-only fallback. Each entry lists the screen, the problem, the proposed contract and the frontend fallback.

Separate from `BACKEND_FIXES.md`, which tracks backend bugs. Entries here are improvements, not defects.

| # | Screen | Request | Priority | Status |
|---|---|---|---|---|
| 1 | App shell (sidebar scope line, top bar) | Add `facilityName` (and `ucName`) to the session user | Medium | Open |
| 2 | Audit Log (all roles) | Server-side filters and pagination for `GET /api/audit-log` | High | Open |
| 3 | Approvals (facility supervisor + head) | One name for the decision reason field, and `decidedAt` | Low | Open |
| 4 | District / UC detail pages | Document what `statusCounts` counts (facilities or vaccine lines) | Low | Open |

---

## 1. Facility name in the session user
- **Screen(s):** the app shell for every facility-scoped role (facility supervisor, head, worker): the sidebar scope line and the subtitle under the user's name in the top bar.
- **Problem today:** `POST /api/auth/login` and `GET /api/auth/session` return `facilityId`, but no facility name. `GET /api/facilities/:id` returns **403** for facility_supervisor and facility_worker, so the shell can't look the name up. The shell shows "Hyderabad District" where "RHC Latifabad" belongs, which breaks the product principle "scope is always visible".
- **Proposed contract:** add `facilityName: string | null` to the user object in both responses. If cheap, also add `ucName` for facility roles.
- **Frontend fallback until then:** `scopeLabel()` in `src/lib/navigation.js` shows `districtName + " District"`. It already prefers `user.facilityName` once present, so no frontend change is needed.

## 2. Audit log: server-side filters and pagination
- **Screen(s):** Audit Log for every role (one shared view, `src/components/audit/AuditLogView.jsx`).
- **Problem today:** the page calls `GET /api/audit-log` once and filters, sorts, counts and paginates **in the browser**. The tab counts ("Facility supervisors 119") and the whole history are only as complete as that one response. Rows older than the response cap are invisible and the counts are silently wrong. (`limit` is capped at 500, and the Stock Register already hits that cap.) The page also downloads every row to show 15.
- **Proposed contract:** `GET /api/audit-log` accepts `actorRole`, `actorId`, `action`, `facilityId`, `entityId`, `from`, `to` (ISO dates, inclusive, in `Asia/Karachi`), plus `limit` and a cursor (`before=<createdAt|id>`). Response adds `total` for the filtered set and, optionally, `countsByActorRole` for the tab badges.
- **Frontend fallback until then:** current behaviour (fetch once, filter client-side). Moving to server filters later only changes the query function and key in `AuditLogView.jsx`; the table, filters and parsing in `src/lib/auditLog.js` stay as they are.

## 3. Approval decision reason: one field name
- **Screen(s):** facility supervisor "My requests" history and facility head Approvals history.
- **Problem today:** the supervisor page originally read `rejectionReason`, the head page read `decisionReason` (the reject request body also sends `decisionReason`). The UI now reads `decisionReason ?? rejectionReason` on both, so it works either way, but it's a guess about which one `GET /api/approvals` really returns.
- **Proposed contract:** return `decisionReason` (string | null) and `decidedAt` (ISO) for every non-pending approval, and drop `rejectionReason` (or keep it as an alias). Document it in the API reference.
- **Frontend fallback until then:** reads both names (`src/pages/facility-supervisor/Approvals.jsx`, `src/pages/facility-head/Approvals.jsx`).

## 4. `statusCounts` on district and UC detail
- **Screen(s):** super admin District detail and UC detail (KPI cards), district/UC dashboards.
- **Problem today:** it isn't clear whether `statusCounts` on these objects counts facilities or vaccine lines. The KPI cards say "vaccines" or "facilities" depending on the page, and the wording on the district detail page had to be made neutral ("Restock now / Plan a delivery") because the unit is ambiguous.
- **Proposed contract:** state the unit in the API reference, and ideally return both `facilityStatusCounts` and `vaccineStatusCounts`.
- **Frontend fallback until then:** neutral card subtitles; per-facility status is derived from `GET /api/dashboard` `summary.byFacility` via `facilityStatus()`.

---

<!-- Entry template
## N. <short title>
- **Screen(s):**
- **Problem today:**
- **Proposed contract:**
- **Frontend fallback until then:**
-->
