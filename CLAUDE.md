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

### ui-ux-pro-max — for all UI/UX design work
**Activate:** invoke the `ui-ux-pro-max` skill before any UI design task.

Use this for: designing new screens, improving layouts, choosing color/typography, building components, responsive design, accessibility, dark mode, hover states. It knows this project's stack (React + Tailwind) and the clinical/minimal design language in `PRODUCT.md`. Always check `tailwind.config.js` for existing tokens before proposing new ones.

### Impeccable — for UI quality and design critique
**Activate:** `craft`, `critique`, `polish`, or `live` commands.

Use impeccable for: reviewing UI before shipping, critiquing a layout for clinical clarity, polishing spacing/contrast/hierarchy. The project's design system is stored in `.impeccable/design.json` — impeccable commands load it automatically. Read `PRODUCT.md` first so critiques align with the product's clinical, minimal brand.

**Design source of truth:** `reference design/` (HTML mockups `admin-01`–`admin-08`, `fs-01`–`fs-05`) is the canonical visual reference. `.impeccable/design.json` has been updated to reflect the Clinical Material token system (forest green, warm paper, Figtree, dark mode) as of 2026-10-15.

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
6. If the change touches shared layout (Sidebar, TopBar, Layout), test all five roles.
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
    status.js          — status vocabulary, Tailwind classes, rollup helpers
    vaccineNames.js    — maps "Vaccine 01–13" → Urdu display names
  hooks/
    useDebounce.js
  components/
    layout/            — Layout, Sidebar, TopBar, NotificationPanel
    shared/            — composite reusable: Table, StatCard, FacilityCard, etc.
    ui/                — primitives: Button, Input, Select, Modal, Toast, Badge
    ErrorBoundary.jsx
  pages/
    login/             — LoginPage, ForgotPassword, ResetPassword, HeroCarousel
    super-admin/       — super_admin role pages
    district-supervisor/ — district_supervisor role pages
    uc-supervisor/     — uc_supervisor role pages
    facility-supervisor/ — facility_supervisor role pages
    facility-worker/   — facility_worker role pages
    shared/            — FacilityDetail (shared by super-admin, district, uc)
public/
  images/              — static assets; kebab-case filenames only, no spaces
docs/                  — internal dev docs (gitignored)
scripts/               — standalone doc-generation scripts (not part of the build)
```

### Naming conventions
- **Page directories:** kebab-case — `login/`, `super-admin/`, `facility-worker/`
- **Component files:** PascalCase — `LoginPage.jsx`, `StatCard.jsx`
- **Hook files:** camelCase, `use` prefix — `useDebounce.js`
- **Lib files:** camelCase — `api.js`, `status.js`
- **Image files:** kebab-case, no spaces — `icon-image.jpeg`, `login-hero.jpeg`
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

`AuthContext.jsx` holds auth state. Login returns `{ user, csrfToken }`. `user` is stored in `sessionStorage` (`sst_user`); `csrfToken` in `sessionStorage` (`sst_csrf`) and loaded into a module-level variable in `api.js` via `setCsrfToken()`. Every mutating request includes `credentials: 'include'` + `x-csrf-token` header. Any `401` clears session storage and redirects to `/login`.

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

Routes are defined in `App.jsx` under a single `<AuthLayout>` guard. `Sidebar.jsx` drives navigation from a `NAV` object — add new links there when adding new pages.

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
- `FILTERS` — shared filter pills array for list pages (`All / Critical / Low / Normal`)

### Data fetching

TanStack Query v5. Query keys: `['dashboard']`, `['users']`, `['vaccines']`, `['facilities']`, `['districts']`, `['ucs']`, `['uc', id]`, `['audit-log']`, `['district', id]`. Invalidate after mutations. Dashboard pages poll with `refetchInterval`.

### Shared pages

`src/pages/shared/FacilityDetail.jsx` is rendered under both `/super-admin/facilities/:id` and `/district/facilities/:id` — it checks `user.role` internally.

The district-supervisor `AuditLog.jsx` imports from `src/pages/super-admin/AuditLog.jsx`, which accepts `title`/`subtitle` props.

### Expandable sub-panel pattern

Sub-panels (e.g. `DistrictExpandedPanel`) are co-located in the same file as the parent list page, fetch their own data via `useQuery` keyed on the expanded row's id, and do not rely on the parent's data. Follow this pattern for all new expandable rows.

### Stock Register

`StockRegister.jsx` has no dedicated endpoint — it calls `getAuditLog({ limit: 500 })` and filters for `STOCK_ENTRY` / `ADJUST_STOCK` actions. Running balance is computed client-side. Backend caps `limit` at 500.

Entry type mapping: `received` → Received (+), `used` → Issued (−), `returned` → Returned (+). `ADJUST_STOCK`: positive delta → Received, negative → Issued.

### UI component layers

| Layer | Path | Contents |
|---|---|---|
| Primitives | `src/components/ui/` | Button, Input, Select, Modal, Toast, Badge, DatePicker, ConfirmDialog |
| Composites | `src/components/shared/` | Table, StatCard, FacilityCard, DistrictCard, StatusBadge, RingGauge, StepIndicator, SkeletonCard, SearchInput, Pagination, EmptyState |
| Layout | `src/components/layout/` | Layout, Sidebar, TopBar, NotificationPanel |

`Select` uses a fixed-position portal dropdown — it does not clip inside `overflow-hidden` parents. This is intentional.

### Backend contract

Backend: `https://smart-stock-alert-be.vercel.app`. Full API docs in `docs/api-reference.md`.

Key constraints:
- `POST /api/stock-entries` with `entryType: "received"` requires `batchNo`, `expiryDate`, `dosesPerVial`, `manufacturer`, `remarks` (`"outreach"` | `"fixed"`)
- `GET /api/audit-log` — `?limit=` capped at 500
- `GET /api/dashboard` returns `{ facilities: [...], summary: { statusCounts, byFacility, ... } }`
- Vaccines are facility-scoped; names must match `"Vaccine 01"–"Vaccine 13"`

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