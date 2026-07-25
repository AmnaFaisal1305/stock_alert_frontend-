# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (port 5173, or 5174 if in use)
npm run build    # production build
npm run preview  # preview the production build locally
```

No test suite or linter is configured — there are no `test` or `lint` scripts.

The dev server proxies nothing; it talks directly to the backend. `.env.local` sets `VITE_API_URL=https://smart-stock-alert-be.vercel.app` (the live deployed backend). To run against a local backend, set `VITE_API_URL=http://localhost:3000` in `.env.local`.

## Architecture

**Stack:** Vite 6 + React 18 + React Router 7 + TanStack Query v5 + Tailwind 3 + lucide-react.

### Auth model

`src/context/AuthContext.jsx` holds the single auth state. On login, the API returns `{ user, csrfToken }` — `user` is stored in `sessionStorage` (`sst_user`) and re-hydrated on mount; `csrfToken` is stored in `sessionStorage` (`sst_csrf`) and loaded into a module-level variable in `src/lib/api.js` via `setCsrfToken()`. Every mutating fetch includes `credentials: 'include'` (cookie) and `x-csrf-token: <token>` (header). A `401` from any request clears session storage and hard-redirects to `/login`.

### API layer (`src/lib/api.js`)

Single `request(method, path, body)` function wraps all `fetch` calls. All API functions are named exports from this file — import from here, never call `fetch` directly in pages. The CSRF token is a module-level singleton, not passed through React state.

### Role-based routing

Four roles: `super_admin`, `district_supervisor`, `facility_supervisor`, `facility_worker`. Each role has its own route prefix and page directory:

| Role | Prefix | Pages dir |
|---|---|---|
| `super_admin` | `/super-admin/` | `src/pages/super-admin/` |
| `district_supervisor` | `/district/` | `src/pages/district-supervisor/` |
| `facility_supervisor` | `/facility/` | `src/pages/facility-supervisor/` |
| `facility_worker` | `/worker/` | `src/pages/facility-worker/` |

`App.jsx` defines all routes under a single `<AuthLayout>` guard that checks `isAuthenticated`. On login, users land at their role's default route (defined in `ROLE_DEFAULTS` in both `App.jsx` and `AuthContext.jsx`). All pages are lazy-loaded.

`src/components/layout/Sidebar.jsx` drives navigation per role from a `NAV` object — add new links there when adding new pages.

### Data fetching pattern

TanStack Query v5 throughout. Query keys are flat strings matching resource names: `['dashboard']`, `['users']`, `['vaccines']`, `['facilities']`, `['districts']`, `['audit-log']`, `['district', id]`. After any mutation, invalidate the affected query keys — pages do not manage their own cache invalidation differently. Dashboard is the most-fetched endpoint; some pages poll it with `refetchInterval`.

### Status vocabulary (`src/lib/status.js`)

The backend uses `critical | low | adequate | no_data` (not `red | amber | green`). `src/lib/status.js` is the single source of truth for mapping these to Tailwind classes, hex colors, and labels. Always use `statusConfig(status)` or the named exports from this file; never hardcode color strings against status values elsewhere.

`facilityStatus(statusCounts)` and `districtStatus(facilityStatuses[])` are rollup helpers used on dashboard and district pages. `worstStatus()` accepts either a status-string array or a `statusCounts` object.

### Shared pages

`src/pages/shared/FacilityDetail.jsx` is rendered under both `/super-admin/facilities/:id` and `/district/facilities/:id` — it checks `user.role` internally to scope what it shows.

The two audit log components (`src/pages/district-supervisor/AuditLog.jsx` and `src/pages/super-admin/AuditLog.jsx`) both import the same base component from `src/pages/super-admin/AuditLog.jsx`, which accepts `title`/`subtitle` props.

### UI component conventions

- `src/components/ui/` — primitive components (Button, Input, Select, Modal, Toast, Badge). Use these; don't reach for raw HTML inputs/buttons in pages.
- `src/components/shared/` — composite components (Table, StatCard, FacilityCard, DistrictCard, StatusBadge, RingGauge, StepIndicator, SkeletonCard).
- `src/components/layout/` — Layout, Sidebar, TopBar. Layout wraps every authenticated page.

### Backend contract

Backend is deployed at `https://smart-stock-alert-be.vercel.app`. Full endpoint docs are in `docs/api-reference (3).md` and `docs/API_DOCUMENTATION (1).md`. Key points:
- Vaccines are **facility-scoped**, not a shared global list. `POST/PUT /api/vaccines` names must match the 13 backend default names (currently placeholder `"Vaccine 01"`–`"Vaccine 13"`); fetch from `GET /api/vaccines` for pickers.
- `POST /api/stock-entries` for a facility_supervisor with `entryType: "received"` (or omitted) **requires** `batchNo`, `expiryDate`, `dosesPerVial`, `manufacturer`, and `remarks` (`"outreach"` | `"fixed"`). The `"returned"` type needs none of these.
- `GET /api/dashboard` returns `{ facilities: [...], summary: { statusCounts, byFacility, ... } }`. The `summary` key is present on all roles.
- Districts response includes `supervisorName`/`supervisorEmail`. Facilities include `facilitySupervisorName`/`facilitySupervisorEmail`, `unionCouncil`, `town`. Users include `phone`, `cnic`.

## Design Context

This project has `PRODUCT.md` (register: `product` — internal role-based dashboard for AKUH vaccine stock tracking) and `DESIGN.md` (visual system: "The Ward Status Board" — flat surfaces, one clinical-blue accent, red/amber/green status triad, system font stack). Read both before making UI/UX changes; `impeccable` commands (`craft`, `critique`, `polish`, `live`, etc.) load them automatically.
