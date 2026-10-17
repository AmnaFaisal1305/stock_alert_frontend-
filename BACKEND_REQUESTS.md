# Backend Requests: UI Enhancements (session 14)

Started 2026-10-18. Previous round (`BACKEND_REQUESTS.md`, items 1–4) is closed: all answered in Round 35.

These are API additions that would let the frontend ship the UI enhancements in `PLAN_UI_ENHANCEMENTS.md`. None block the release: each entry has a frontend fallback, and features without data are hidden rather than faked.

Separate from `BACKEND_FIXES.md`, which tracks bugs.

| # | Screen | Request | Priority | Status |
|---|---|---|---|---|
| B1 | Dashboards (all supervisory roles) | Previous-period counts for KPI trend deltas | Medium | Open |
| B2 | Facility / UC / district dashboards | Stock expiring soon (batch expiry) | Medium | Open |
| B3 | Users grid cards (super admin, district, UC, head, workers) | `lastLoginAt` / `lastActivityAt` on users | Low | Open |
| B4 | Users list (super admin) | Bulk activate / deactivate | Low | Open (optional) |
| B5 | Stock Register | Multiple values for audit-log `action` | Low | Open |
| B6 | Audit Log (all roles) | Free-text `q` search on audit-log | Low | Open |

---

## B1. KPI trend deltas
- **Screen(s):** KPI cards on every dashboard ("Critical 12, +3 since last week").
- **Problem today:** `GET /api/dashboard` is a snapshot. The frontend can't tell whether things are getting better or worse.
- **Proposed contract:** `GET /api/dashboard?compareTo=YYYY-MM-DD` adds `summary.previous.statusCounts` (same scope, as of the end of that Karachi day). Alternatively a daily snapshot endpoint `GET /api/dashboard/history?from&to` returning `[{ date, statusCounts }]` (also enables sparklines).
- **Frontend fallback until then:** no delta line on KPI cards.

## B2. Stock expiring soon
- **Screen(s):** new "Expiring soon" card on the facility, UC and district dashboards.
- **Problem today:** `expiryDate` is stored on received items as reference metadata only (no batch balances, no FEFO), so the frontend can't say how many vials of a batch are left before it expires.
- **Proposed contract:** `GET /api/stock-entries/expiring?days=60` (role-scoped) → `[{ facilityId, facilityName, vaccineId, vaccineName, batchNo, expiryDate, vialsOnHand }]`. If per-batch balances are out of scope, return the latest received batch per facility × vaccine with its `expiryDate` and say so in the docs.
- **Frontend fallback until then:** widget hidden.

## B3. Last activity on users
- **Screen(s):** user cards in Grid view and the user tables (super admin Users, district/UC Users, head Users, supervisor Workers).
- **Problem today:** `GET /api/users` has no activity timestamp. Facilities already have `lastActivityAt`; users don't, so an inactive worker can't be spotted.
- **Proposed contract:** add `lastLoginAt: ISO | null` and `lastActivityAt: ISO | null` (last audit-log row by that actor) to each user in `GET /api/users`.
- **Frontend fallback until then:** cards show role, scope and active state only.

## B4. Bulk activate / deactivate users (optional)
- **Screen(s):** super admin Users, multi-select in Grid and List view.
- **Problem today:** one request per user. A frontend loop works but partial failures are awkward to report.
- **Proposed contract:** `PUT /api/users/bulk-status` `{ ids: [uuid], active: boolean }` → `{ updated: [id], failed: [{ id, error }] }`; one audit row per user as today.
- **Frontend fallback until then:** sequential calls with a per-row result summary.

## B5. Several actions in one audit-log call
- **Screen(s):** facility supervisor Stock Register.
- **Problem today:** the register needs `STOCK_ENTRY`, `ADJUST_STOCK` and `STOCK_DAY_END` rows. `action` takes one exact value, so it is three calls merged client-side. (The old `limit: 500` call silently dropped older history; Round 35 lets us remove that.)
- **Proposed contract:** accept a comma-separated list, `action=STOCK_ENTRY,ADJUST_STOCK,STOCK_DAY_END`.
- **Frontend fallback until then:** three calls, merged and sorted client-side.

## B6. Free-text search on the audit log
- **Screen(s):** Audit Log search box (all roles).
- **Problem today:** with server-side paging (Round 35), client-side search only covers the loaded page.
- **Proposed contract:** `q` matches `actorName`, `facilityName`, `details.vaccineName`, `details.name`, `details.email` (case-insensitive), combined with the other filters, and counted in `total`.
- **Frontend fallback until then:** search narrows the current page, with a hint "Searching this page only".

---

<!-- Entry template
## BN. <short title>
- **Screen(s):**
- **Problem today:**
- **Proposed contract:**
- **Frontend fallback until then:**
-->
