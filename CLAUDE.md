# CLAUDE.md — Smart Stock Alert Frontend

Read this file fully before making any changes to this project.

---

## Golden Rule

Understand the existing project before changing it. Make the **smallest complete change** that solves the problem. Prioritize correctness, stability, and maintainability over refactoring. Never sacrifice working functionality for cosmetic improvements.

---

## Commands

```bash
npm run dev      # start dev server (port 5173, or 5174 if in use)
npm run build    # production build — run this to catch import errors
npm run preview  # preview the production build locally
```

No test suite or linter is configured. After any change, run `npm run build` to verify there are no broken imports, then check the affected screen(s) in the browser with `npm run dev`.

The dev server calls the live backend. `.env` sets `VITE_API_URL=https://smart-stock-alert-be.vercel.app`. For a local backend, set `VITE_API_URL=http://localhost:3000` in `.env.local`. **Never commit `.env` — it is gitignored and contains dev credentials.**

---

## Skills to Use

### Ponytail — default mode for all code changes
**Activate:** `/ponytail` (full, default) · `/ponytail lite` (smallest option only) · `/ponytail ultra` (questions the request before building)

Ponytail is always active. It means: write the smallest complete change, name what was skipped and why, flag any risk. Use it for every coding task — logic fixes, refactors, new features. When a task is large or risky, use `/ponytail ultra` to push back before writing code.


### Impeccable — for UI quality and design critique
**Activate:** `craft`, `critique`, `polish`, or `live` commands.

Use impeccable for: reviewing UI before shipping, critiquing a layout for clinical clarity, polishing spacing/contrast/hierarchy. The project's design system is stored in `.impeccable/design.json` — impeccable commands load it automatically. Read `PRODUCT.md` first so critiques align with the product's clinical, minimal brand.

**Design source of truth:** `DESIGN.md` (project root) is the normative design system ("The Ward Ledger": tokens, component rules, do's and don'ts), with `.impeccable/design.json` as its sidecar. The HTML mockups in `docs/design_refrences/` (`admin-01`–`admin-08`, `fs-01`–`fs-05`) are visual references only; where they conflict with `DESIGN.md` (e.g. coloured left-stripe cards), `DESIGN.md` wins.

**Design principles for this project (from `PRODUCT.md`):**
- Status at a glance — red/amber/green must be scannable in under a second
- Precision over decoration — numbers and statuses are the product
- Field-entry screens minimize friction — `facility_worker` screens are used one-handed on a phone
- Errors are informative — tell the user exactly what's true, not just that something failed

---

## Working Process

For every task:

1. Read the relevant files. Do not guess imports, data shapes, or component APIs.
2. Identify the smallest set of files that need to change.
3. Make the change. Write no more code than the task requires.
4. Run `npm run build`. Fix any errors before continuing.
5. Test the affected screen(s) in the browser (`npm run dev`).
6. If the change touches shared layout (Sidebar, TopBar, Layout), test all seven roles.
7. Summarize: what changed, which files, what was tested, any remaining risks.

For large or risky changes, explain the approach and wait for approval before proceeding.

---

## Project Rules

### Before making changes
- Read the relevant source files. Never assume how something works.
- Check `src/lib/api.js` before adding an API call — the function may already exist.
- Check `src/lib/status.js` before any status logic — never hardcode status colors or labels.
- Check `src/components/ui/` and `src/components/shared/` before using raw HTML elements.
- Understand where the component fits in the role/routing hierarchy before editing it.

### Folder structure
```
src/
  App.jsx              — router, all lazy imports, route definitions
  main.jsx             — React root, QueryClient setup
  index.css            — global Tailwind base styles
  context/
    AuthContext.jsx    — single auth state, login/logout, sessionStorage
  lib/
    api.js             — ALL fetch calls; never call fetch directly in pages
    status.js          — stock + workflow status vocabulary, Tailwind classes, rollup helpers
    format.js          — formatDate/formatTime/timeAgo/plural, local-date helpers (never toISOString for dates)
    navigation.js      — NAV per role, ROLE_LABELS, scopeLabel(), role section routes
    stockRequests.js   — request stages, filters, pipeline helpers
    auditLog.js        — action labels, entry parser, filters for the shared Audit Log
    vaccineNames.js    — displayVaccineName(): legacy "Vaccine 01–13" → display names; real names pass through
    csv.js             — CSV export (toCsv, downloadCsv)
  hooks/
    useDebounce.js, useTheme.js (follows the OS), useChartTheme.js (hex values per theme for Recharts),
    useFocusTrap.js (Modal), useOfflineSync.js, useViewMode.js (grid/list per page), useUrlState.js (useUrlFilters)
  components/
    layout/            — Layout, Sidebar, TopBar, NotificationPanel
    shared/            — composites: Table, Card, StatCard, StatusBadge, FilterChips, PageHeader, EmptyState, ErrorState, ...
    facilities/        — facility table/board/directory shared by the UC and district pages
    stock-requests/    — RequestList shared by the facility, UC and head Stock Requests pages
    audit/             — AuditLogView: the one Audit Log for every role
    ui/                — primitives: Button, Input, Textarea, Select, Tabs, Modal, Toast, Badge
    ErrorBoundary.jsx
  pages/
    login/             — LoginPage, ForgotPassword, ResetPassword, HeroCarousel
    super-admin/       — super_admin role pages
    district-supervisor/ — district_supervisor role pages
    uc-supervisor/     — uc_supervisor role pages
    facility-supervisor/ — facility_supervisor role pages
    facility-worker/   — facility_worker role pages
    facility-head/     — facility_head role pages
    shared/            — FacilityDetail, Analytics, DashboardGuide, FormBSheet (role-aware, several routes)
public/
  images/              — static assets; kebab-case filenames only, no spaces
docs/                  — local only (gitignored): design_refrences/ mockups, screenshots/, test-accounts.md
scripts/               — standalone doc-generation scripts (not part of the build)
```

### Naming conventions
- **Page directories:** kebab-case — `login/`, `super-admin/`, `facility-worker/`
- **Component files:** PascalCase — `LoginPage.jsx`, `StatCard.jsx`
- **Hook files:** camelCase, `use` prefix — `useDebounce.js`
- **Lib files:** camelCase — `api.js`, `status.js`
- **Image files:** kebab-case, no spaces — `logo-circle-192.png`, `login-hero.jpeg`
- **CSS:** Tailwind utility classes only; no CSS modules, no styled-components

### Coding conventions
- All pages are lazy-loaded in `App.jsx` — keep this pattern for every new page
- Data fetching is TanStack Query v5 throughout — do not use `useEffect` for fetching
- After any mutation, invalidate the affected query key — do not manually update the cache
- Never call `fetch` directly in a page — use named exports from `src/lib/api.js`
- Never hardcode status colors — use `statusConfig(status)` from `src/lib/status.js`
- Co-locate sub-panels in the same file as their parent page (see `DistrictManagement.jsx`)
- Do not create new shared components unless two or more pages need the same UI
- Default to writing no comments — only add one when the WHY is non-obvious

### Avoid these patterns
- Raw `<input>`, `<button>`, `<select>` in pages — use `src/components/ui/`
  - Documented exceptions (compact numeric cells inside tables/steppers, where `Input`'s label and 36px height don't fit): the Assign Vials steppers, Day End row cells, the Raise-request and Record-sent quantity fields. Everything else uses the primitives.
- `<textarea>` in pages — use `ui/Textarea`
- Hand-built tab bars, filter pills, empty/error/loading boxes — use `Tabs`, `FilterChips`, `EmptyState`, `ErrorState`, `SkeletonRows`
- Overriding a Button's colour with `className` (it loses to the variant) — use `variant="ghost-danger"` for Reject/Decline/Deactivate
- `new Date().toISOString().split('T')[0]` for "today" — it is the UTC date, a day behind in Pakistan until 05:00; use `localDateStr()` / `toLocalDateStr()` from `lib/format`
- Hardcoded API base URLs — route through `src/lib/api.js`
- Duplicate `ROLE_DEFAULTS` — defined in `App.jsx` and `AuthContext.jsx` intentionally
- Image files with spaces or parentheses in `public/images/`
- Importing `docx` in application code — it belongs only in `scripts/`

### Protecting existing functionality
- Never delete files, environment configs, or dependencies without verifying they are unused.
- Never overwrite a working implementation without a clear reason.
- Never modify `.env` or expose secrets in any file.
- Do not move or rename files without updating every import and reference first.

### Dependency management
- Check the existing stack before adding a package: Tailwind (styling), lucide-react (icons), recharts (charts), TanStack Query (data), react-router-dom v7 (routing).
- Do not upgrade, downgrade, or remove packages without a clear reason.
- Keep `package-lock.json` consistent — do not delete it.

---

## Architecture

**Stack:** Vite 6 · React 18 · React Router 7 · TanStack Query v5 · Tailwind 3 · lucide-react · Recharts

### Auth model

`AuthContext.jsx` holds auth state. Login returns `{ user, csrfToken }`. `user` is stored in `sessionStorage` (`sst_user`); `csrfToken` in `sessionStorage` (`sst_csrf`) and loaded into a module-level variable in `api.js` via `setCsrfToken()`. Every mutating request includes `credentials: 'include'` + `x-csrf-token` header. A `403` with `code: 'CSRF_INVALID'` (missing or stale token) refreshes `/session` and retries once. Any `401` clears session storage and redirects to `/login`.

### API layer

`src/lib/api.js` exports one `request(method, path, body)` wrapper and all named API functions. Import from here exclusively — never `fetch` in pages.

### Role-based routing

| Role | Default route | Pages directory |
|---|---|---|
| `super_admin` | `/super-admin/dashboard` | `src/pages/super-admin/` |
| `district_supervisor` | `/district/dashboard` | `src/pages/district-supervisor/` |
| `uc_supervisor` | `/uc/dashboard` | `src/pages/uc-supervisor/` |
| `facility_supervisor` | `/facility/dashboard` | `src/pages/facility-supervisor/` |
| `facility_worker` | `/worker/stock-entry` | `src/pages/facility-worker/` |
| `facility_head` | `/head/dashboard` | `src/pages/facility-head/` (dashboard reuses the facility-supervisor one) |
| `observer` | `/super-admin/dashboard` | reuses `src/pages/super-admin/`, read-only (`role === 'observer'` hides actions) |

`ROLE_DEFAULTS` exists in both `App.jsx` and `AuthContext.jsx`; a role missing from either loops forever between `/login` and its default route.

Routes are defined in `App.jsx` under a single `<AuthLayout>` guard. The sidebar is driven by the `NAV` object in `src/lib/navigation.js` (grouped per role, with the role's primary button and scope line) — add new links there when adding new pages.

### Entity hierarchy

**Districts → Union Councils (UCs) → Facilities**
- A Facility belongs to one UC, not directly to a District
- When creating a Facility, the form asks for UC
- District Supervisors are scoped to UCs within their district

### Status vocabulary (`src/lib/status.js`)

Backend statuses: `critical | low | adequate | no_data`. This file is the single source of truth for Tailwind classes, hex colors, and labels. Always use `statusConfig(status)` — never hardcode color strings.

- `facilityStatus(statusCounts)` — derives facility status from its vaccine counts
- `districtStatus(facilityStatuses[])` — worst-case rollup; ignores `no_data` if real data exists
- `worstStatus(input)` — generic worst-case from array or counts object
- `FILTERS` — legacy pill definitions (`All / Critical / Low / Normal`); new lists use `FilterChips` with `STATUS_FILTERS` from `components/facilities/facilityTable.jsx`
- `workflowStatusConfig(status)` / `<StatusBadge kind="workflow">` — request stages and approval statuses (awaiting_*, figures_differ, completed, pending, approved, rejected, …)

### Data fetching

TanStack Query v5. Query keys: `['dashboard']`, `['users']`, `['vaccines']`, `['facilities']`, `['districts']`, `['ucs']`, `['uc', id]`, `['audit-log', …]` (prefix-invalidate `['audit-log']`), `['district', id]`, `['facility', id]`, `['stock-requests']`, `['approvals', 'pending' | 'history']`, `['holdings']`, `['notifications']`, `['unread-count']`, `['analytics', from, to]`. Invalidate after mutations. Dashboard pages poll with `refetchInterval`.

### Shared pages

`src/pages/shared/FacilityDetail.jsx` is rendered under `/super-admin/facilities/:id`, `/district/facilities/:id` and `/uc/facilities/:id`; it checks `user.role` internally.

Every role's `AuditLog.jsx` re-exports `src/components/audit/AuditLogView.jsx`. Role differences (tabs, the facility/worker scope filter, columns) live in its `ROLE_CONFIG`; labels and entry parsing live in `src/lib/auditLog.js`. Filtering and paging run on the server (see Stock Register below).

`UserDirectory` (UC and district Users), `FacilityDirectory`/`FacilityBoard` (UC and district Dashboard/Facilities) and `RequestList` are shared the same way: the page file is a thin wrapper that passes role-specific props.

### Expandable sub-panel pattern

Sub-panels (e.g. `DistrictExpandedPanel`) are co-located in the same file as the parent list page, fetch their own data via `useQuery` keyed on the expanded row's id, and do not rely on the parent's data. Follow this pattern for all new expandable rows.

### Stock Register

`StockRegister.jsx` (routes `/facility/stock-register` and `/head/stock-register`) reads `GET /api/stock-register` via `getStockRegister()` (Round 38). The balance is the server's `balanceVials`, which matches the dashboard; never recompute it. The API answers in vials, and the screen shows doses (`vials × dosesPerVial`). Vaccine and date filters go to the API and live in the URL. Pages use `nextCursor` → `before` (no `total`, so the page count grows as pages are reached), and the CSV export loops every page. The query key sits under `['audit-log', 'register', …]` so the existing stock-mutation invalidations refresh it. Assign/return rows are not listed, and there is no `kind` filter on the server.

The Audit Log (`AuditLogView`) filters and pages on the server (Round 35): tab/action/date/scope go to the API, pages use `nextCursor` → `before`, tab badges come from `counts=true` (`countsByActorRole`).

### UI component layers

| Layer | Path | Contents |
|---|---|---|
| Primitives | `src/components/ui/` | Button (variants: primary, secondary, danger, ghost, ghost-danger; `buttonClasses()` for links), Input, Textarea, Select, Tabs, Modal, Toast, Badge, DatePicker (calendar popover; native on touch), ConfirmDialog, ReviewDialog (+ `ReviewPanel`, `SummaryDialog`), ViewToggle, RowActions |
| Composites | `src/components/shared/` | Card, PageHeader, Table (`view="grid"` + `gridCard`), EntityCard, StatCard (`icon` + `accent`), StatusBadge, RoleTag, AttentionStrip, FilterChips, SearchInput, Pagination, EmptyState, ErrorState, SkeletonCard/SkeletonRows, WorkerPicker, ResultPanel, UserDirectory |
| Layout | `src/components/layout/` | Layout, Sidebar, TopBar, NotificationPanel |

Entity lists use `useViewMode(pageKey)` + `ViewToggle` + `Table view/gridCard` with `EntityCard` (Grid by default), list filters live in the URL via `useUrlFilters` (`hooks/useUrlState.js`; facility lists use `?status=`), and an `ExportButton` (CSV via `lib/csv.js`). Row actions are `RowActions` icons, filtered by role. Submits on field-entry screens go through `ReviewDialog`/`ReviewPanel`; creates end in `SummaryDialog`. Non-status colour comes from the category palette (`--cat-1…5`, `ACCENT` in `StatCard.jsx`), never from status red/amber/green.

`Select` uses a fixed-position portal dropdown — it does not clip inside `overflow-hidden` parents. This is intentional.

### Backend contract

Backend: `https://smart-stock-alert-be.vercel.app`. The API contract lives in the backend repo (`docs/api/api-reference.md`, changelog `docs/FRONTEND_HANDOFF.md`); ask the backend developer for the current copy rather than keeping one here.
Everything the frontend needs from the backend (new endpoints, filters, fixes) is in the one root file `BACKEND_REQUESTS.md`. Test logins: `docs/test-accounts.md` (gitignored).

Key constraints:
- Stock moves through stock requests (raise → sent → received → head approval), `POST /api/stock-entries/assign` and `/day-end`; the old `POST /api/stock-entries` is gone. Received items need `batchNo`, `expiryDate`, `manufacturer` when vials > 0.
- `/assign` and `/day-end` accept `occurredOn` up to 7 days back (Round 38); a `facility_supervisor`'s session survives 7 days idle (other roles 8 h)
- `GET /api/stock-register` — `facility_supervisor` / `facility_head` only, own facility; `vaccineId, from, to, limit (≤ 500, default 100), before`
- `GET /api/audit-log` — `?limit=` capped at 500 (omit it for the whole log); filters `actorRole, actorId, action, facilityId, entityId, from, to`, cursor `before`, `counts=true`
- `GET /api/dashboard` returns `{ facilities: [...], summary: { statusCounts, byFacility, ... } }`
- `statusCounts` counts facility × vaccine lines, never facilities; derive facility status with `facilityStatus()`
- Vaccines are one global catalog (real names like "BCG") with optional per-facility threshold overrides (`thresholdOverridden` on `GET /api/facilities/:id`), written by `PUT /api/facilities/:facilityId/vaccines/:vaccineId` (super admin, the four thresholds only; `null`s reset). `dosesPerVial` is global only
- User create / activate / deactivate / reset are `super_admin` only (Round 37); other roles' user screens are read-only lists

Use the `agent-browser` skill for browser automation tasks in this project.

First, read the skill instructions and run `agent-browser --help` to understand the available commands.

Whenever I ask you to interact with a website or test my web application, prefer `agent-browser` instead of guessing or relying only on code inspection.

Use it to:
- Open the website in a browser.
- Inspect the page and identify interactive elements.
- Click buttons, fill forms, and navigate pages.
- Take screenshots when useful.
- Test complete user flows and report actual results.

After every navigation or significant page change, inspect the page again before interacting with elements. Do not claim that something works unless you have actually tested it.

Ask me before submitting important forms, making purchases, deleting data, or performing other consequential actions.