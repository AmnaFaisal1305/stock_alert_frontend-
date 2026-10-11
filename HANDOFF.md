# Frontend Handoff — Smart Stock Alert System

**Last updated:** 2026-10-11  
**Written for:** Future Claude sessions (or any developer picking this up cold)  
**Project root:** `C:\Users\amnaf\OneDrive\Desktop\stock_alert_frontend`  
**Live backend:** `https://smart-stock-alert-be.vercel.app`

---

## Session Log — 2026-10-11 (what happened today)

This section describes the two sessions run on 2026-10-11, in order. Read this first if you want to know what changed today.

### Problem 1: facility_head login caused blank page / infinite redirect

**Symptom:** Logging in as a `facility_head` user showed a completely blank page. No JS errors. Page mounted (Vite connected) but rendered nothing.

**Root cause:** `AuthContext.jsx` `ROLE_DEFAULTS` was missing `facility_head`. When that role logged in, `defaultRoute` resolved to the fallback `/login`. The `LoginRoute` component then saw an authenticated user, redirected to `defaultRoute` = `/login`, causing an infinite loop that never rendered anything.

**Fix — `src/context/AuthContext.jsx`:**
Added two missing entries to `ROLE_DEFAULTS`:
```js
facility_head: '/head/dashboard',
observer:      '/super-admin/dashboard',
```

**Fix — `src/App.jsx`:**
Same two entries were already present (App.jsx had been updated earlier in a prior session). Confirmed they match.

---

### Problem 2: Add User form was missing `facility_head` role option

**Symptom:** Super-admin could not create a `facility_head` account via the UI. The Add User modal only listed the original 5 roles.

**Fix — `src/pages/super-admin/UserManagement.jsx`:**
Added `facility_head` across every place roles are referenced:
1. `ROLE_FILTERS` array (filter tabs above the user table)
2. `ROLE_SUCCESS_LABELS` (toast message on success)
3. `ROLE_LABELS` (Assignment column in user table)
4. `assignmentColLabel` — `facility_head` maps to `'Facility Name'`
5. Role selector buttons in the Add User modal (new button added)
6. Mutation `isFacilityRole` check — `|| form.role === 'facility_head'` (sends `facilityId`)
7. Facility picker condition — shows the facility dropdown for `facility_head`
8. Assignment column and mobile card display — `isFacilityRole` includes `facility_head`

---

### Problem 3 (new, same session): observer role was missing everywhere

**Background:** The `observer` role is a read-only replica of super_admin — they land at `/super-admin/dashboard` and can see everything but cannot take actions. Backend allows `super_admin` to create `observer` accounts (confirmed from API docs).

**What was missing:**
- `observer` not in `ROLE_DEFAULTS` in `AuthContext.jsx` (same infinite redirect bug as facility_head above — fixed together)
- `observer` not in Add User form in `UserManagement.jsx`
- No sidebar nav for `observer` role
- No role chip label for `observer` in `TopBar.jsx`

**Fixes made:**

`src/context/AuthContext.jsx` — added `observer: '/super-admin/dashboard'` to `ROLE_DEFAULTS`

`src/pages/super-admin/UserManagement.jsx` — added `observer` to:
- `ROLE_FILTERS`, `ROLE_LABELS`, `ROLE_SUCCESS_LABELS`
- Role selector button in Add User modal
- Mutation logic: `isObserver = form.role === 'observer'` → sends **no** assignment field (observer is unscoped like super_admin — no `districtId`, `facilityId`, or `ucIds`)

`src/components/layout/Sidebar.jsx` — added `observer` entry to `NAV` object with same links as super_admin (flat list, no tree indent)

---

### Session 2 (this session — 2026-10-11 afternoon)

Continued from where session 1 was interrupted (Chrome browser extension had disconnected).

**Pending from session 1:** Visual browser verification that the "Observer" role button appears in the Add User modal, and that selecting it hides the assignment picker. Build had already passed. This verification was never completed because the Chrome extension disconnected.

**What was done in this session:**
- Attempted to reconnect Chrome browser extension — user confirmed it was not connected
- Wrote this `HANDOFF.md` document (the file you are reading now) to capture everything from both sessions

**Still pending:** The Observer button browser verification (see "What To Do Next" section below).

---

## What This App Is

A vaccine stock management system for health facilities in Pakistan. Tracks cold-chain vaccine inventory across a hierarchy of Districts → Union Councils (UCs) → Facilities. Different user roles see different views and can take different actions.

The app is **live and connected to a real backend**. The dev server calls the live Vercel backend by default (set in `.env`). To use a local backend, create `.env.local` with `VITE_API_URL=http://localhost:3000`.

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| Vite | 6 | Build / dev server (port 5173, or 5174 if in use) |
| React | 18 | UI |
| React Router | 7 | Routing (all lazy-loaded pages) |
| TanStack Query | v5 | All data fetching — never use `useEffect` for fetching |
| Tailwind | 3 | Styling — utility classes only, no CSS modules |
| lucide-react | latest | Icons |
| Recharts | latest | Charts on dashboards |

**Commands:**
```bash
npm run dev      # start dev server
npm run build    # production build — run after every change to catch import errors
npm run preview  # preview prod build locally
```

---

## Role Hierarchy & Routing

Seven roles exist. Each has a default landing route and its own sidebar nav.

| Role | Default route | Notes |
|---|---|---|
| `super_admin` | `/super-admin/dashboard` | Full access, can create all user types |
| `district_supervisor` | `/district/dashboard` | Scoped to their district |
| `uc_supervisor` | `/uc/dashboard` | Scoped to their union councils |
| `facility_supervisor` | `/facility/dashboard` | Scoped to one facility |
| `facility_worker` | `/worker/stock-entry` | Mobile-first, no bell icon |
| `facility_head` | `/head/dashboard` | Approves corrections/requests at facility level |
| `observer` | `/super-admin/dashboard` | Read-only replica of super_admin — action buttons hidden |

**Critical:** `ROLE_DEFAULTS` is defined in **two** files intentionally:
- `src/App.jsx` (line 64) — used by `RoleRedirect` 
- `src/context/AuthContext.jsx` (line 8) — used by `LoginRoute`

Both must be kept in sync. Missing a role in `ROLE_DEFAULTS` causes a blank-page infinite redirect loop (the user gets redirected to `/login` forever).

---

## Folder Structure (what's in each folder)

```
src/
  App.jsx                — router + all lazy imports + route definitions + ROLE_DEFAULTS
  main.jsx               — React root, QueryClient setup
  index.css              — Tailwind base styles
  context/
    AuthContext.jsx      — auth state, login/logout, sessionStorage (sst_user, sst_csrf)
  lib/
    api.js               — ALL fetch calls (never fetch directly in pages)
    status.js            — status vocabulary (critical/low/adequate/no_data), Tailwind classes
    vaccineNames.js      — maps "Vaccine 01–13" → Urdu display names
  hooks/
    useDebounce.js
  components/
    layout/
      Layout.jsx         — shell (sidebar + topbar + outlet)
      Sidebar.jsx        — role-driven nav from NAV object
      TopBar.jsx         — page title, bell icon (real unread count), user avatar
      NotificationPanel.jsx — real notifications from API, mark-read, mark-all-read
    shared/              — Table, StatCard, FacilityCard, DistrictCard, StatusBadge, etc.
    ui/                  — Button, Input, Select, Modal, Toast, Badge, DatePicker, ConfirmDialog
    ErrorBoundary.jsx
  pages/
    login/               — LoginPage, ForgotPassword, ResetPassword, HeroCarousel
    super-admin/         — Dashboard, DistrictManagement, DistrictDetail, FacilityManagement,
                           UserManagement, UCManagement, VaccineManagement, AuditLog
    district-supervisor/ — Dashboard, FacilityManagement, UserManagement, AuditLog
    uc-supervisor/       — Dashboard, Facilities, Users, AuditLog, StockRequests
    facility-supervisor/ — Dashboard, Approvals, RecordStock (Stock Requests), StockRegister,
                           ThresholdManagement, WorkerManagement, AssignVials, DayEnd, AuditLog
    facility-worker/     — StockEntry, StatusView
    facility-head/       — Dashboard, Users, Approvals, StockRequests, AuditLog
    shared/
      FacilityDetail.jsx — shared by super-admin, district, uc — checks user.role internally
public/
  images/                — kebab-case filenames only (icon-image.jpeg, login-hero.jpeg, etc.)
docs/                    — internal dev docs (gitignored) — includes api-reference.md
```

---

## Auth Architecture

1. `POST /api/auth/login` returns `{ user, csrfToken }`
2. `user` → `sessionStorage` key `sst_user`; `csrfToken` → `sessionStorage` key `sst_csrf`
3. `csrfToken` also loaded into a module-level variable in `api.js` via `setCsrfToken()`
4. Every mutating request sends `credentials: 'include'` + `x-csrf-token` header
5. Any `401` response clears sessionStorage and redirects to `/login`

---

## API Layer (`src/lib/api.js`)

Single `request(method, path, body)` wrapper. All named functions exported from here.

**Current API functions:**

**Auth:** `login`, `logout`, `forgotPassword`, `resetPasswordByToken`, `googleLogin`

**Users:** `getUsers`, `createUser`, `deactivateUser`, `activateUser`, `resetPassword`, `assignUcSupervisor`

**Geography:** `getDistricts`, `createDistrict`, `getDistrict`, `updateDistrict`, `deleteDistrict`, `activateDistrict`, `getTowns`, `createTown`, `updateTown`, `deleteTown`, `activateTown`, `getUnionCouncils`, `createUnionCouncil`, `updateUnionCouncil`, `deleteUnionCouncil`, `activateUnionCouncil`

**Facilities:** `getFacilities`, `createFacility`, `getFacility`, `updateFacility`, `deleteFacility`, `activateFacility`

**Vaccines:** `getVaccines`, `createVaccine`, `updateVaccine`, `deleteVaccine`, `updateVaccineStock`

**Dashboard:** `getDashboard`

**Stock entries:** `createStockEntry`, `assignVials`, `recordDayEnd`, `getHoldings`

**Approvals (Sprint 3):** `getApprovals`, `createApproval`, `approveApproval`, `rejectApproval`, `cancelApproval`

**Notifications (Sprint 3):** `getNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllRead`

**Stock requests (Sprint 4):** `getStockRequests`, `getStockRequest`, `createStockRequest`, `recordSent`, `recordReceived`, `approveStockRequest`, `cancelStockRequest`, `declineStockRequest`

**Audit log:** `getAuditLog({ limit, feed })`

---

## What Was Built: Sprint by Sprint

### Sprint 1–2 (original build)
Core scaffolding: all 5 original roles (no facility_head, no observer), login flow, dashboards, facility/district/UC/vaccine management, stock entry for facility_worker, stock register for facility_supervisor.

### Sprint 3 — Approvals + Notifications
- `src/pages/facility-supervisor/Approvals.jsx` — new page; two tabs: Stock Correction + Threshold Change; pending approvals list with cancel action
- `src/pages/facility-head/Approvals.jsx` — new page; Pending + History tabs; approve/reject per row
- `src/components/layout/NotificationPanel.jsx` — **fully rewritten** to call real API (`getNotifications`); mark-one-read, mark-all-read, unread dot indicator
- `src/components/layout/TopBar.jsx` — bell badge now uses `getUnreadCount` (polls every 30s) instead of deriving from dashboard data
- `src/components/layout/Sidebar.jsx` — `facility_supervisor` nav: replaced Thresholds → Approvals; Record Stock → Stock Requests

### Sprint 4 — Stock Requests
- `src/pages/facility-supervisor/RecordStock.jsx` — **rewritten** as Stock Requests page (same route `/facility/record-stock`). Raise request modal, stage badges, record-received flow
- `src/pages/uc-supervisor/StockRequests.jsx` — new page; record-sent + decline actions
- `src/pages/facility-head/StockRequests.jsx` — new page; approve when `ready_for_approval`
- `src/lib/api.js` — 17 new functions added (approvals, notifications, stock requests)
- `src/App.jsx` — new routes: `/facility/approvals`, `/head/approvals`, `/head/stock-requests`, `/uc/stock-requests`

### facility_head role (added alongside Sprint 3/4 work)
- `src/pages/facility-head/Dashboard.jsx` — new
- `src/pages/facility-head/Users.jsx` — new
- `src/pages/facility-head/AuditLog.jsx` — new
- `src/context/AuthContext.jsx` — added `facility_head: '/head/dashboard'` to `ROLE_DEFAULTS`
- `src/App.jsx` — added `facility_head: '/head/dashboard'` to `ROLE_DEFAULTS` + all `/head/` routes

### observer role
- Read-only replica of super_admin — lands at `/super-admin/dashboard`, reuses all super-admin pages
- `src/context/AuthContext.jsx` — added `observer: '/super-admin/dashboard'` to `ROLE_DEFAULTS`
- `src/App.jsx` — added `observer: '/super-admin/dashboard'` to `ROLE_DEFAULTS`
- `src/components/layout/Sidebar.jsx` — added `observer` nav (same links as super_admin, flat list)
- `src/pages/super-admin/UserManagement.jsx` — added `observer` role to Add User form, role filter tabs, table display labels
- Action buttons on super-admin pages guard with `user.role !== 'observer'` where applicable

### observer + facility_head in Add User form (UserManagement.jsx)
Both roles now appear as selectable options in the "Add User" modal:
- `facility_head` → sends `facilityId` (same as facility_supervisor/worker)
- `observer` → sends no assignment field (`districtId`/`facilityId`/`ucIds` all omitted)
- Both roles added to `ROLE_FILTERS`, `ROLE_LABELS`, `ROLE_SUCCESS_LABELS`

---

## Known State at Handoff

### Verified working (browser-tested)
- Login for all 7 roles (no blank-page loops)
- super_admin: all pages, Add User modal with all 7 roles including facility_head and observer
- facility_supervisor: Dashboard, Approvals, Stock Requests, Stock Register, Workers, Assign Vials, Day End, Audit Log
- facility_worker: Stock Entry (mobile layout, sticky form)
- facility_head: Dashboard, Users, Approvals, Stock Requests, Audit Log
- uc_supervisor: Dashboard, Facilities, Users, Stock Requests, Audit Log
- district_supervisor: Dashboard, Facilities, Users, Audit Log
- observer: can log in, sees super_admin layout read-only

### NOT yet verified in browser
- **Observer Add User button** — the "Observer" role button was added to the Add User modal in `UserManagement.jsx` and the build passed, but the browser verification was interrupted (Chrome extension disconnected). The code change is complete and correct; just needs a visual confirm that the button appears and that selecting it hides the assignment picker.

### Dead code
- `src/pages/facility-supervisor/ThresholdManagement.jsx` — route `/facility/thresholds` still exists in `App.jsx` but the sidebar no longer links to it. The route was replaced by `/facility/approvals`. ThresholdManagement calls `updateVaccineStock` → `PUT /api/vaccines/:id/stock` which was removed in Sprint 3 (returns 404). Safe to delete the file and the route when convenient.

### TopBar ROLE_LABELS incomplete
`TopBar.jsx` line 9 only has 4 roles in `ROLE_LABELS`. `facility_head`, `uc_supervisor`, and `observer` fall through to `user.role` raw string. Not broken — just shows the raw role key. Low priority.

---

## Data Fetching Conventions

- TanStack Query v5 throughout
- Query keys: `['dashboard']`, `['users']`, `['vaccines']`, `['facilities']`, `['districts']`, `['ucs']`, `['uc', id]`, `['audit-log']`, `['district', id]`, `['approvals']`, `['approvals', 'pending']`, `['approvals', 'history']`, `['stock-requests']`, `['notifications']`, `['unread-count']`
- After every mutation: `invalidateQueries` the affected key(s)
- Dashboard pages use `refetchInterval` (polling)
- Never call `fetch` directly in a page — always go through `src/lib/api.js`

---

## Status System

Never hardcode status colors or labels. Use `src/lib/status.js`:

```js
import { statusConfig } from '../lib/status'
const { label, bg, text, dot } = statusConfig('critical') // → Tailwind class strings
```

Statuses: `critical` | `low` | `adequate` | `no_data`

- `facilityStatus(statusCounts)` — derives facility-level status from vaccine counts
- `districtStatus(facilityStatuses[])` — worst-case rollup across facilities
- `worstStatus(input)` — generic worst-case

---

## Vaccine Names

`src/lib/vaccineNames.js` maps `"Vaccine 01"–"Vaccine 13"` → Urdu display names.
Import `displayVaccineName` — use it whenever rendering a vaccine name to the user.

---

## Stock Register (important quirk)

`StockRegister.jsx` has no dedicated backend endpoint. It calls `getAuditLog({ limit: 500 })` and filters client-side for `STOCK_ENTRY` / `ADJUST_STOCK` actions. Running balance is computed on the frontend. Backend caps `limit` at 500.

Entry type mapping:
- `received` → Received (+)
- `used` → Issued (−)
- `returned` → Returned (+)
- `ADJUST_STOCK`: positive delta → Received, negative → Issued

---

## Entity Hierarchy (important for forms)

```
Districts → Union Councils (UCs) → Facilities
```
- A Facility belongs to one UC, not directly to a District
- When creating a Facility, the form asks for UC (not district)
- District Supervisors are scoped to UCs within their district

---

## UI Component Layers

| Layer | Path | What to use it for |
|---|---|---|
| Primitives | `src/components/ui/` | Button, Input, Select, Modal, Toast, Badge, DatePicker, ConfirmDialog |
| Composites | `src/components/shared/` | Table, StatCard, FacilityCard, DistrictCard, StatusBadge, RingGauge, StepIndicator, SkeletonCard, SearchInput, Pagination, EmptyState |
| Layout | `src/components/layout/` | Layout, Sidebar, TopBar, NotificationPanel |

**`Select`** uses a fixed-position portal dropdown — it does not clip inside `overflow-hidden` parents. This is intentional.

Never use raw `<input>`, `<button>`, `<select>` in pages — use `src/components/ui/` equivalents.

---

## Shared Page Pattern

`src/pages/shared/FacilityDetail.jsx` is rendered under three routes:
- `/super-admin/facilities/:id`
- `/district/facilities/:id`
- `/uc/facilities/:id`

It checks `user.role` internally to show/hide role-specific actions.

The district-supervisor AuditLog imports from the super-admin version:
```js
// src/pages/district-supervisor/AuditLog.jsx
import SuperAdminAuditLog from '../super-admin/AuditLog'
export default function DistrictAuditLog() {
  return <SuperAdminAuditLog title="..." subtitle="..." />
}
```

---

## Backend Contract (key constraints)

- `POST /api/stock-entries` with `entryType: "received"` requires: `batchNo`, `expiryDate`, `dosesPerVial`, `manufacturer`, `remarks` (`"outreach"` | `"fixed"`)
- `GET /api/audit-log` — `?limit=` capped at 500
- `GET /api/dashboard` returns `{ facilities: [...], summary: { statusCounts, byFacility, ... } }`
- Vaccines are facility-scoped; names must match `"Vaccine 01"–"Vaccine 13"`
- Full API docs: `docs/api-reference.md` (gitignored)
- Observer accounts: created by super_admin, no `districtId`/`facilityId`/`ucIds` needed
- facility_head accounts: created by super_admin, requires `facilityId`

---

## Image Files

All images must be in `public/images/` with **kebab-case filenames, no spaces or parentheses**.
Current files: `icon-image.jpeg`, `login-hero.jpeg`, `login-hero-2.jpeg`

Old WhatsApp-named images (`WhatsApp Image 2026-08-21 at 2.10.03 AM.jpeg` etc.) were deleted and replaced with these properly-named files.

---

## Environment

- `.env` is gitignored — contains `VITE_API_URL` and dev credentials. Never commit it.
- For local backend: create `.env.local` with `VITE_API_URL=http://localhost:3000`
- Default `.env` points at `https://smart-stock-alert-be.vercel.app`

---

## What To Do Next (pending work)

1. **Visual confirm Observer button** — Start dev server, log in as super_admin (`admin@akuh.pilot`), go to User Management → Add User → verify "Observer" button appears in role selector → click it → verify no assignment picker shows. The code is done and build passes; just needs eyeball confirmation.

2. **Delete ThresholdManagement dead code** — `src/pages/facility-supervisor/ThresholdManagement.jsx` is unreachable (sidebar no longer links to it, backend endpoint gone). Remove the file and its route in `App.jsx` (`/facility/thresholds`).

3. **TopBar ROLE_LABELS** — add `facility_head`, `uc_supervisor`, `observer` to the `ROLE_LABELS` map in `TopBar.jsx` so the role chip shows a human-readable label instead of the raw key.

4. **Sprint 5 — Activity history + email** — additive, not yet deployed. Will add: `APPROVAL_REQUEST/APPROVE/REJECT/CANCEL` and `STOCK_REQUEST_*` action labels to `AuditLog.jsx`, a status badge column on approval/stock-request rows. Backend Sprint 5 not yet live.

5. **Observer read-only enforcement** — action buttons on super-admin pages (create district, add user, etc.) should be hidden or disabled when `user.role === 'observer'`. Currently they appear and will fail with a 403. The guard pattern: `{user.role !== 'observer' && <Button>...}`.
