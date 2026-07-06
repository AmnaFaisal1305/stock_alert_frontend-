# Frontend UI Scaffolding — Handoff for Amna

Scope: **UI and screens only.** This work runs in parallel with backend development, so the one rule that matters most is at the bottom of this doc — build components so the eventual data wiring is a drop-in, not a rewrite.

---

## What to build right now

- Project scaffold (Vite + React + Tailwind)
- Every screen listed below, for all four roles, fully styled
- Reusable UI components (forms, tables, cards, modals, nav)
- Static mock data standing in for real data
- Routing between screens
- A temporary role switcher so every screen can be previewed without a real login

## What NOT to build yet — explicit exclusions

- No TanStack Query, no `fetch`, no `axios`, no `lib/api.js`
- No environment variables, no `.env` files
- No cookies, JWT, or any real auth/session logic
- No real form submission — button clicks can just update local state or log to console
- No route guards that actually enforce permissions — routes can exist and be reachable via the role switcher, but "can this role really see this" logic comes later
- No loading/error states tied to real network calls — static/mock states only (e.g. a hardcoded "empty" version of a table is fine, a hardcoded "loading spinner" version is fine, but nothing wired to a real request)

Anything above gets added in the integration phase once backend endpoints exist — building it now would just mean redoing it against real data shapes later.

---

## Setup

- Vite + React + Tailwind CSS (no additional component library needed — Tailwind utilities only, matching the finalized architecture)
- React Router for navigation
- Icons: any lightweight icon set is fine for placeholders (final choice isn't locked yet)

```
src/
  components/       # reusable, presentational — buttons, inputs, tables, cards, modals, nav
  pages/
    Login/
    super-admin/
    district-supervisor/
    facility-supervisor/
    facility-worker/
  mock-data/        # static JSON standing in for real API responses
  context/
    RolePreviewContext.jsx   # temporary — see "Role preview switcher" below
  App.jsx
  main.jsx
```

---

## Screens by role

These map directly to the locked user journeys — build the screens, not the logic behind them.

### Login
- Email + password form
- Error state (e.g. "Invalid credentials") — static, just a visual state you can toggle
- Loading state — static, just a visual state

### Super Admin
- **System-wide dashboard** — every district and facility, color-coded status cards/grid (green/amber/red)
- **District management** — list of districts, "create district" form/modal
- **User management** — table of users with role badges, "create District Supervisor" form/modal, deactivate/reset-password buttons (visual only)
- **Audit log** — table, system-wide, filterable by date/action (filtering can be a static UI control for now)

### District Supervisor
- **District dashboard** — facilities within the district, same color-coded card/grid style as Super Admin's, just scoped
- **Facility management** — list of facilities, "create facility" form/modal
- **User management** — "create Facility Supervisor" form/modal
- **Audit log** — same table component as Super Admin's, reused

### Facility Supervisor
- **Facility dashboard** — single facility's stock levels per vaccine, color-coded status
- **Record received stock** — form: select vaccine, enter quantity, submit
- **Threshold management** — list of vaccines with current thresholds, "edit threshold" modal
- **Worker management** — "create Facility Worker" form/modal

### Facility Worker
- **Stock entry form** — mobile-first, single screen: select vaccine, enter quantity, submit button
- **Confirmation state** — toast or inline message after submit
- **Read-only status view** — a small, simple view of their own facility's current stock, no editing

---

## Shared components to build once, reuse everywhere

- Nav / sidebar — menu items shown depend on the current role (from the role switcher context, see below)
- Table (used by audit log, user lists, facility lists, dashboards)
- Card / status badge (green / amber / red — this color logic will matter a lot later, so keep it as one component, not repeated inline styles)
- Modal (used by every "create X" and "edit X" action)
- Toast / notification
- Form primitives — input, select, button

---

## Mock data — shape it like the real thing

Static JSON files in `mock-data/`, one per entity: `districts.json`, `facilities.json`, `vaccines.json`, `users.json`, `stockEntries.json`, `thresholds.json`.

**Important:** name the fields exactly as they'll be in the real database — `district_id`, `facility_id`, `role`, `quantity`, `created_at`, etc. — not made-up names like `districtName` or `id`. When the real API is ready, the goal is that a page only needs its data *source* swapped, not its field names re-mapped throughout every component.

## Role preview switcher (temporary, dev-only)

Since there's no real login yet, add a simple `RolePreviewContext` with a dropdown (put it somewhere unobtrusive, like the top corner) to switch between Super Admin / District Supervisor / Facility Supervisor / Facility Worker. The nav and routes read from this context to decide what's visible. This entire mechanism gets deleted once real auth exists — it's scaffolding, not a feature.

## Styling

Tailwind, clean and professional default palette for now — brand colors and logo haven't been confirmed by AKUH yet (that request has gone out separately). To make the eventual re-theming trivial: put all colors in `tailwind.config.js` under `theme.colors`, and reference them by name in components (`bg-primary`, not `bg-[#1F3864]`). When real brand colors arrive, it's a one-file change, not a find-and-replace across every screen.

---

## The one rule that makes parallel work merge cleanly

Build every screen as a **presentational component that receives data via props**, with a thin "page" wrapper that currently pulls from `mock-data/` and later gets swapped to pull from a TanStack Query hook. If a component internally imports its own mock JSON instead of receiving it as a prop, that's the thing to avoid — it works fine today but has to be unpicked later. Props in, JSX out — everything else about how the data arrives is not this phase's concern.

**Handoff point:** once backend endpoints are ready, only the "page" wrappers change — the mock import gets replaced by a query hook, and the same presentational components render exactly as they do today.
