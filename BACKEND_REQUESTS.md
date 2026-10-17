# Backend Requests — Frontend → Backend

Updated 2026-10-18 · Frontend branch `main`

**Our answers to your `FRONTEND_PENDING.md` are at the end of this file.**

One list of everything the frontend needs from the backend. It replaces the earlier `BACKEND_REQUESTS.md` (items 1–4, all answered in Round 35), `BACKEND_FIXES.md` (all 7 answered in Round 34) and `BACKEND_CHANGES.md`.

**Status meanings:** *Blocking*: the screen is built and an action fails until the endpoint exists. *Fallback*: the screen works today in a reduced form. All new parameters should be optional and additive, combined with the caller's role scope (never widening it), like the Round 35 audit-log filters.

| # | Request | Screen | Priority | Status |
|---|---|---|---|---|
| 1 | `PUT /api/facilities/:facilityId/vaccines/:vaccineId`: per-facility vaccine values | Super admin › Vaccines (facility view) | High | Blocking |
| 2 | `GET /api/users`: facility head and worker in supervisor scopes | District and UC › Users | Medium | Fallback |
| 3 | `GET /api/analytics`: `districtId` / `ucId` / `facilityId` filters | Analytics (all roles) | Medium | Fallback |
| 4 | Previous-period counts for KPI trend deltas | Dashboards | Medium | Fallback |
| 5 | Stock expiring soon | Facility / UC / district dashboards | Medium | Fallback |
| 6 | `lastLoginAt` / `lastActivityAt` on users | All user lists | Low | Fallback |
| 7 | Several values for audit-log `action` | Stock Register | Low | Fallback |
| 8 | Free-text `q` on audit-log | Audit Log | Low | Fallback |
| 9 | `GET /api/stock-requests`: `month` filter | Analytics › Stock Requests drill-down | Low | Fallback |
| 10 | `GET /api/union-councils`: `districtId` filter | Super admin › Vaccines cascade | Low | Fallback |
| 11 | Bulk activate / deactivate users (optional) | Super admin › Users | Low | Fallback |

---

## 1. Per-facility vaccine values
- **Screen:** Super admin › Vaccines. A District → UC → Facility filter shows one facility's vaccines (from `GET /api/facilities/:id`, which already exists). Each row has an edit dialog for all five values, and "Reset to Global" in that dialog.
- **Problem today:** the endpoint does not exist, so Save and Reset to Global fail.
- **Proposed contract:** `PUT /api/facilities/:facilityId/vaccines/:vaccineId`, `super_admin` only, CSRF required.
  - Body: any of `{ dosesPerVial, criticalDoses, lowDoses, criticalVials, lowVials }`; an omitted field is unchanged, `null` resets it to the global vaccine value.
  - `200`: `{ "vaccine": { vaccineId, dosesPerVial, criticalDoses, lowDoses, criticalVials, lowVials, thresholdOverridden } }`. `404` facility or vaccine not found. `422` invalid values (`dosesPerVial < 1`, `lowDoses < criticalDoses`, …).
  - `thresholdOverridden` (already on `GET /api/facilities/:id`) drives the "Custom" tag.
  - Please write an audit-log row (e.g. `EDIT_FACILITY_VACCINE` with `{ facilityId, vaccineId, previous, new }`) and say whether the facility head approval flow (`threshold_change`) should also apply.
- **Frontend:** `updateFacilityVaccine(facilityId, vaccineId, payload)` in `src/lib/api.js`.

## 2. Users: facility head and worker in supervisor scopes
- **Screen:** District and UC supervisor › Users (`UserDirectory`).
- **Problem today:** `GET /api/users` returns `uc_supervisor` + `facility_supervisor` for a district supervisor, and `facility_supervisor` + `facility_worker` for a UC supervisor. Facility heads (and, for districts, workers) never appear.
- **Proposed contract:** district supervisor scope `role in (uc_supervisor, facility_supervisor, facility_worker, facility_head)`; UC supervisor scope `role in (facility_supervisor, facility_worker, facility_head)`. Same response shape.
- **Fallback:** those roles are simply missing; no frontend change needed once returned.

## 3. Analytics: location filters
- **Screen:** Analytics, Stock Requests tab, which already has a District → UC → Facility filter.
- **Problem today:** `GET /api/analytics` takes only `from`/`to`, so charts and totals always cover the caller's whole scope; the filter only narrows the client-side request list.
- **Proposed contract:** `GET /api/analytics?from=&to=&districtId=&ucId=&facilityId=` restricting every aggregation (`movement`, `remaining`, `requests`, `pendingApprovals`).
- **Frontend:** `getAnalytics({ from, to })` will pass the extra params once available.

## 4. KPI trend deltas
- **Screen:** KPI cards on every dashboard ("Critical 12, +3 since last week").
- **Problem today:** `GET /api/dashboard` is a snapshot; the frontend can't tell whether things are getting better or worse.
- **Proposed contract:** `GET /api/dashboard?compareTo=YYYY-MM-DD` adds `summary.previous.statusCounts` (same scope, as of the end of that Karachi day). Alternatively `GET /api/dashboard/history?from&to` → `[{ date, statusCounts }]`, which would also allow sparklines.
- **Fallback:** no delta line on KPI cards.

## 5. Stock expiring soon
- **Screen:** an "Expiring soon" card on facility, UC and district dashboards.
- **Problem today:** `expiryDate` is stored on received items as reference only (no batch balances), so the frontend can't tell how many vials of a batch remain before it expires.
- **Proposed contract:** `GET /api/stock-entries/expiring?days=60` (role-scoped) → `[{ facilityId, facilityName, vaccineId, vaccineName, batchNo, expiryDate, vialsOnHand }]`. If per-batch balances are out of scope, return the latest received batch per facility × vaccine with its `expiryDate`, and say so in the docs.
- **Fallback:** card hidden.

## 6. Last activity on users
- **Screen:** user cards and tables (super admin, district, UC, head Users; supervisor Workers).
- **Problem today:** `GET /api/users` has no activity timestamp (facilities already have `lastActivityAt`), so an inactive worker can't be spotted.
- **Proposed contract:** add `lastLoginAt` and `lastActivityAt` (last audit-log row by that actor), both `ISO | null`, to each user.
- **Fallback:** cards show role, scope and active state only.

## 7. Several actions in one audit-log call
- **Screen:** facility supervisor Stock Register.
- **Problem today:** it needs `STOCK_ENTRY`, `ADJUST_STOCK` and `STOCK_DAY_END` rows; `action` takes one value, so it is three calls merged client-side.
- **Proposed contract:** comma-separated `action=STOCK_ENTRY,ADJUST_STOCK,STOCK_DAY_END`.
- **Fallback:** three calls.

## 8. Free-text search on the audit log
- **Screen:** Audit Log (all roles), which now pages on the server.
- **Problem today:** client-side search could only cover the loaded page.
- **Proposed contract:** `q` matching `actorName`, `facilityName`, `details.vaccineName`, `details.name`, `details.email` (case-insensitive), combined with the other filters and counted in `total`.
- **Fallback:** no search box on the Audit Log; filters by tab, action, date and facility/worker only.

## 9. Stock requests: month filter
- **Screen:** Analytics › Stock Requests status drill-down.
- **Problem today:** `GET /api/stock-requests?status=X` returns every request with that status; the panel filters by month client-side (`createdAt.startsWith(month)`), which grows with history.
- **Proposed contract:** `GET /api/stock-requests?status=&month=YYYY-MM` (Karachi month of `createdAt`).
- **Fallback:** client-side filter.

## 10. Union councils: district filter
- **Screen:** Super admin › Vaccines (District → UC cascade); useful anywhere a district narrows UCs.
- **Problem today:** `GET /api/union-councils` filters by `townId` only; the frontend loads all UCs and filters by `districtId` itself.
- **Proposed contract:** optional `?districtId=`.
- **Fallback:** client-side filter (fine at current data sizes).

## 11. Bulk activate / deactivate users (optional)
- **Screen:** super admin › Users, if multi-select is added.
- **Proposed contract:** `PUT /api/users/bulk-status` `{ ids: [uuid], active: boolean }` → `{ updated: [id], failed: [{ id, error }] }`, one audit row per user.
- **Fallback:** one request per user.

---

## Answers to `FRONTEND_PENDING.md` (2026-10-18)

### A. Your questions
- **A1 EPI Form B shape: confirmed, keep it.** We address rows by `key`, read column B as `b` on each row, and render whatever rows the catalog returns (no fixed list of 14).
- **A2 New-tab 401: no repro yet.** A new tab restores the login through `GET /api/auth/session`. If it happens again we'll send the network-tab details you asked for.
- **A3 Breaking rounds: all built.** Round 25 (assign / day-end ledger), 26 (approvals with `decisionReason`, thresholds), 27 (stock requests: raise → sent → received → approve / cancel / decline; the old receive form is gone) and 32 (`partially_fulfilled`, including closing short). You can remove the compatibility paths. Caveat: no full write flow has been run end to end against production yet.

### B. Fixes you listed
| # | Status |
|---|---|
| B1 Push paths, unsubscribe before logout | Done. `503` shows "push not configured"; logout removes the subscription first. Delivery to a real device (including iPhone home-screen) **not tested yet**. |
| B2 Drop `rejectionReason` | Done. Only `decisionReason` / `decidedAt` are used. |
| B3 Audit Log server filters | Done (Round 35): filters, `before` cursor, `counts=true` tab badges. |
| B4 `facilityName` / `ucName` | `facilityName` is in the sidebar scope line; `ucName` not shown yet (frontend follow-up). |
| B5 `statusCounts` unit | Done. Facility status is still derived with `facilityStatus()`. |
| B6 Form B rules | Done: rows by `key`, `b` read-only and printed as returned, digits only up to 9 characters, current and previous month only. |
| B7 `503` retryable, CSRF `403` | Done. Only `401` logs out; a CSRF `403` refreshes `/session` and retries once. |
| B8 Route guards | **Not done yet.** Next on the frontend list. |

### C and D
- Offline queue: a new `clientRef` per submit, dates limited to 3 days back, replay stops on `401` and resumes after re-login. Excel/PDF exports are built in the browser. Units are vials.
- No demo logins or demo data are hard-coded; the go-live wipe needs no frontend change.

---

<!-- Entry template
## N. <short title>
- **Screen:**
- **Problem today:**
- **Proposed contract:**
- **Fallback:**
-->
