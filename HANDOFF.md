# Frontend Handoff — Smart Stock Alert System

**Last updated:** 2026-10-15 (session 9 — merged to main)  
**Written for:** Future Claude sessions (or any developer picking this up cold)  
**Project root:** `C:\Users\amnaf\OneDrive\Desktop\stock_alert_frontend`  
**Live backend:** `https://smart-stock-alert-be.vercel.app`

---

## Session Log — 2026-10-15 Session 9 (latest) — Delivery Readiness + Merged to Main

### Goal

Pre-delivery audit: fix every user-facing bug, complete remaining post-rollout tasks, and merge to main.

### What changed

| Fix | File | Change |
|---|---|---|
| 1 | `src/context/AuthContext.jsx` | `sst:session-expired` handler now clears `sst_auth_signal` from localStorage, so the next login correctly re-fires the cross-tab broadcast event |
| 2 | `src/context/AuthContext.jsx` | Added cross-tab session sync via `localStorage` storage events — logout in one tab now logs out all open tabs; opening a new tab while logged in elsewhere auto-restores the session via cookie |
| 3 | `src/components/layout/NotificationPanel.jsx` | `bg-white` → `bg-surface` on panel container — was white in dark mode (Phase 3 miss) |
| 4 | `src/pages/facility-supervisor/RecordStock.jsx` | Added `Toast` import + toast state + `onError` on `createMutation`; added `mutError` state + `onError` on `receiveMutation` and `cancelMutation` in `RequestCard` — all three mutations were previously silent on failure |
| 5 | `src/pages/facility-head/Approvals.jsx` | Added `Toast` import + toast state + `onError` on both `approveMutation` and `rejectMutation` — most consequential actions in the app, were silent on failure |
| 6 | `src/pages/uc-supervisor/StockRequests.jsx` | Added `mutError` state + `onError` on both `sentMutation` and `declineMutation` in `RequestCard` — silent on failure |
| 7 | `src/components/layout/TopBar.jsx` | Added 14 missing `PAGE_TITLES` entries: all `/head/*` routes, all `/*/analytics`, all `/*/guide` — mobile TopBar was showing no title on these pages |
| 8 | `BACKEND_FIXES.md` | Created at project root with 7 items for the backend developer (session restore, CSRF on restore, logout cookie invalidation, session TTL, role auth, push delivery, per-device subscriptions) |

### Cross-tab auth — how it works

`AuthContext.jsx` uses `localStorage` storage events (which fire in every tab **except** the writer):

- **Login / session restore** → `localStorage.setItem('sst_auth_signal', '1')` — other open tabs call `GET /api/auth/session` via cookie to sync
- **Logout** → `localStorage.removeItem('sst_auth_signal')` + `localStorage.setItem('sst_logout_ts', Date.now())` — other open tabs clear state and redirect to `/login`
- **Session expiry (401)** → `localStorage.removeItem('sst_auth_signal')` — clears the key so the next login correctly re-fires a `storage` event in other tabs

Note: if `GET /api/auth/session` itself returns 401 for a valid cookie (see `BACKEND_FIXES.md` item 1), new tabs will still see the login page — that is a backend fix.

### Also completed this session

| Task | Status |
|---|---|
| Re-enable `@media (prefers-color-scheme: dark)` in `src/index.css` | ✅ Done |
| Update `.impeccable/design.json` to Clinical Material tokens | ✅ Done (gitignored — local only) |
| Update `PRODUCT.md` — Visual Language section added | ✅ Done |
| Update `CLAUDE.md` — `reference design/` noted as source of truth | ✅ Done |
| Merge `redesign/ui-clinical-material` → `main` | ✅ Done |

### Commits

| Hash | What |
|---|---|
| `c745da2` | Delivery fixes (cross-tab auth, onError handlers, TopBar titles, dark mode panel, BACKEND_FIXES.md, api.js, sw.js, vite.config.js) |
| `45ded32` | HANDOFF.md update |
| `d6f43ff` | Auto dark mode + design docs (index.css, PRODUCT.md, CLAUDE.md) |
| `e75fa65` | **Merge to `main`** ✅ |
| `c388f88` | HANDOFF.md final update |

`npm run build` passes clean (✓ 2533 modules, no errors). Branch `main` is live on Vercel.

---

## Session Log — 2026-10-15 Session 8 — Phase 3 Rollout Complete

### Goal

Complete the screen-by-screen Clinical Material token rollout (Phase 3) across every remaining role. All screens are now converted. Branch pushed to GitHub; Vercel preview deployment is **Ready**.

**Branch:** `redesign/ui-clinical-material`  
**Preview URL:** `https://stock-alert-frontend-4xh9dy7ub-amnas-projects-6f5bf05c.vercel.app`

### Commits added this session

| Commit | What |
|---|---|
| `9404c51` | super-admin screens (8 files) |
| `14ead4a` | district-supervisor screens |
| `d7b9c7c` | uc-supervisor screens |
| `02164a6` | facility-head screens |
| `40f0c10` | facility-supervisor screens (incl. AuditLog Full Write) |
| `a7a98b0` | shared pages + facility-worker pages |
| `86267f7` | login screens |

### Phase 3 — All screens status

| File | Status |
|---|---|
| `src/pages/super-admin/DistrictManagement.jsx` | ✅ Done |
| `src/pages/super-admin/UCManagement.jsx` | ✅ Done |
| `src/pages/super-admin/AuditLog.jsx` | ✅ Done |
| `src/pages/super-admin/FacilityManagement.jsx` | ✅ Done |
| `src/pages/super-admin/UCDetail.jsx` | ✅ Done |
| `src/pages/super-admin/DistrictDetail.jsx` | ✅ Done |
| `src/pages/super-admin/UserManagement.jsx` | ✅ Done |
| `src/pages/super-admin/VaccineManagement.jsx` | ✅ Done |
| `src/pages/district-supervisor/Dashboard.jsx` | ✅ Done |
| `src/pages/district-supervisor/FacilityManagement.jsx` | ✅ Done |
| `src/pages/district-supervisor/DistrictUsers.jsx` | ✅ Done |
| `src/pages/district-supervisor/DistrictAuditLog.jsx` | ✅ Done |
| `src/pages/uc-supervisor/Dashboard.jsx` | ✅ Done |
| `src/pages/uc-supervisor/Facilities.jsx` | ✅ Done |
| `src/pages/uc-supervisor/Users.jsx` | ✅ Done |
| `src/pages/uc-supervisor/StockRequests.jsx` | ✅ Done |
| `src/pages/uc-supervisor/AuditLog.jsx` | ✅ Done |
| `src/pages/facility-head/FacilityHeadDashboard.jsx` | ✅ Done |
| `src/pages/facility-head/FacilityHeadUsers.jsx` | ✅ Done |
| `src/pages/facility-head/FacilityHeadApprovals.jsx` | ✅ Done |
| `src/pages/facility-head/FacilityHeadStockRequests.jsx` | ✅ Done |
| `src/pages/facility-head/FacilityHeadAuditLog.jsx` | ✅ Done |
| `src/pages/facility-supervisor/Dashboard.jsx` | ✅ Done |
| `src/pages/facility-supervisor/Approvals.jsx` | ✅ Done |
| `src/pages/facility-supervisor/RecordStock.jsx` | ✅ Done |
| `src/pages/facility-supervisor/StockRegister.jsx` | ✅ Done |
| `src/pages/facility-supervisor/WorkerManagement.jsx` | ✅ Done |
| `src/pages/facility-supervisor/AssignVials.jsx` | ✅ Done |
| `src/pages/facility-supervisor/DayEnd.jsx` | ✅ Done |
| `src/pages/facility-supervisor/AuditLog.jsx` | ✅ Done (Full Write — dense multi-location changes) |
| `src/pages/shared/FacilityDetail.jsx` | ✅ Done (PageHeader inside conditional data block) |
| `src/pages/shared/Analytics.jsx` | ✅ Done |
| `src/pages/shared/DashboardGuide.jsx` | ✅ Done (apostrophe/delimiter fix on 23 strings) |
| `src/pages/facility-worker/StockEntry.jsx` | ✅ Done |
| `src/pages/facility-worker/StatusView.jsx` | ✅ Done |
| `src/pages/login/LoginPage.jsx` | ✅ Done |
| `src/pages/login/ForgotPassword.jsx` | ✅ Done |
| `src/pages/login/ResetPassword.jsx` | ✅ Done |

### Known gotchas discovered this session

- **Apostrophes in JS string literals** — `DashboardGuide.jsx` data object had possessives/contractions (`system's`, `facility's`, `don't`, etc.) in single-quoted strings. The straight apostrophe `'` ends the string literal mid-word. Fix: change outer delimiter to `"` for affected strings.
- **PageHeader inside conditional block** — `FacilityDetail.jsx` only has `facility.name` after data loads, so `<PageHeader>` lives inside `{!isLoading && !isError && facility && ...}` rather than at the top of the JSX tree like every other page.
- **Full Write vs targeted Edit threshold** — files with 10+ non-unique `bg-white` occurrences (AuditLog, DashboardGuide, FacilityDetail, Analytics) require Full Write. Fewer than 8 unique locations → targeted Edits.
- **`Building2` import** in `FacilityDetail.jsx` is now unused (was only in the old banner). Minor lint warning; not a build error.

---

## Session Log — 2026-10-14 Session 7 — UI/UX Redesign

### Goal

Adopt a "clinical Material" design language from `reference design/` (11 HTML mockups: `admin-01` through `admin-08`, `fs-01` through `fs-05`). Kill the saturated AI-generated look (green `#006241` banners, white surfaces, per-screen bespoke headers). Replace with: warm paper background, forest-green sidebar, Figtree webfont, thin large greeting headers, breadcrumbs, 18 px rounded cards, muted pastel status pills, and dark mode.

**Branch:** `redesign/ui-clinical-material`  
**Commit with Phases 1 + 2:** `069d8ad`  
**Pre-existing uncommitted files** (from before this session, intentionally left unstaged): `AuthContext.jsx`, `api.js`, `sw.js`, `vite.config.js`

---

### Architecture: CSS-variable design tokens

All semantic color tokens are routed through CSS custom properties in `src/index.css` as **RGB channel triplets** (e.g. `--pri: 47 66 52`). Tailwind maps them via `rgb(var(--token) / <alpha-value>)` so opacity modifiers (`bg-primary/5`, `ring-danger/20`) keep working.

`tailwind.config.js` maps: `primary`, `secondary`, `success`, `warning`, `danger`, `surface`, `text`, `epi-dark` — all to CSS variables.

New tokens added: `borderRadius.card = '1.125rem'` (18 px), `fontFamily.sans` → Figtree Variable.

Dark mode is **manual-only** (toggled via TopBar Sun/Moon button, stored as `sst_theme` in `localStorage`, applied via `data-theme="dark"` on `<html>`). Auto `prefers-color-scheme` is intentionally NOT enabled yet — screens are being converted one by one and unconverted screens would look broken in auto-dark.

---

### Phase 1 — Foundation (DONE, committed in `069d8ad`)

| File | What changed |
|---|---|
| `tailwind.config.js` | Full rewrite — CSS-var token map, Figtree font, `card` radius |
| `src/index.css` | CSS variable token sets for light + dark; Tailwind base styles on tokens |
| `src/main.jsx` | Added `import '@fontsource-variable/figtree'` |
| `index.html` | Removed Google Fonts Inter CDN; added `theme-color` meta; added no-flash inline script for dark mode |
| `src/hooks/useTheme.js` | New — manual-only dark/light toggle via `useSyncExternalStore` |
| `src/components/shared/PageHeader.jsx` | New — reference-design page header: breadcrumb + thin 34–38 px title + subtitle + actions slot |
| `src/components/layout/TopBar.jsx` | Added dark mode toggle (Sun/Moon), token colors throughout |
| `src/components/layout/Layout.jsx` | PWA prompt card on tokens |
| `src/lib/status.js` | Updated `gaugeHex` values to reference palette; `no_data.bg` → `bg-surface-chip` |
| `src/components/shared/StatCard.jsx` | Rewritten to reference KPI style (corner icon tile, thin value, eyebrow label) |
| `src/components/shared/RingGauge.jsx` | Track circle now CSS-var driven |
| `src/components/ui/Input.jsx` | `bg-white` → `bg-surface`, `rounded-lg` → `rounded-xl` |
| `src/components/ui/Select.jsx` | All surfaces and borders on tokens |
| `src/components/ui/Modal.jsx` | `bg-white` → `bg-surface` |
| `src/components/shared/Table.jsx` | All surfaces/borders on tokens (note: mobile fallback row at line 74 still has one `hover:bg-slate-50/50` — harmless, fix later) |

---

### Phase 2 — Flagship: Super Admin Dashboard (DONE, committed in `069d8ad`)

`src/pages/super-admin/Dashboard.jsx` — fully rebuilt:
- `PageHeader` with greeting (Good morning/afternoon/evening), breadcrumb, Live pill
- Local `C` and `STATUS_CFG` constants deleted — now uses `gaugeHex()` + `statusConfig()` from `status.js`
- `useTheme` for Recharts chart neutrals (axisColor, gridColor, tickStrong resolve to concrete hex at render time — SVG attributes can't read CSS vars)
- All district/facility cards use token classes, no hardcoded colors
- Filter chips: `bg-surface-chip text-text` pattern
- Skeletons on `bg-surface-alt` / `bg-surface border-surface-border`
- Verified in browser (agent-browser, live backend): light mode ✓, dark mode ✓, 0 console errors

---

### Phase 3 — Screen-by-screen rollout (IN PROGRESS)

**Conversion pattern (proven on DistrictManagement):**
1. Add `import PageHeader from '../../components/shared/PageHeader'`
2. Replace `<div className="bg-primary rounded-2xl ...">` banner with `<PageHeader breadcrumb="Super Admin › ..." title="..." subtitle={...} actions={...} />`
3. Batch-replace hardcoded neutrals:
   - `bg-white` → `bg-surface`
   - `bg-slate-50` → `bg-surface-alt`
   - `bg-slate-100` → `bg-surface-chip`
   - `border-slate-200` / `border-slate-100` → `border-surface-border`
   - `hover:bg-slate-50` → `hover:bg-surface-alt`
   - `hover:bg-slate-100` → `hover:bg-surface-alt`
   - `hover:bg-slate-50/60` → `hover:bg-surface-alt/60`
   - `bg-slate-50/80` → `bg-surface-alt/80`
   - `bg-slate-200/50` → `bg-surface-alt/50`
   - `border-slate-200/80` → `border-surface-border/80`
4. Run `npm run build` — must be clean
5. Browser-verify in both light and dark

**Screens completed:**
| File | Status |
|---|---|
| `src/pages/super-admin/DistrictManagement.jsx` | ✅ Done — **uncommitted** |
| `src/pages/super-admin/UCManagement.jsx` | ✅ Done — **uncommitted** |
| `src/pages/super-admin/AuditLog.jsx` | ✅ Done — **uncommitted** |
| `src/pages/super-admin/FacilityManagement.jsx` | ✅ Done — **uncommitted** |
| `src/pages/super-admin/UCDetail.jsx` | ✅ Done — **uncommitted** |
| `src/pages/super-admin/DistrictDetail.jsx` | ✅ Done — **uncommitted** |
| `src/pages/super-admin/UserManagement.jsx` | ✅ Done — **uncommitted** |
| `src/pages/super-admin/VaccineManagement.jsx` | ✅ Done — **uncommitted** |

**All 8 super-admin screens done. Ready to commit this batch, then continue with other roles.**

**Screens remaining — super-admin:** None.

**Screens remaining — other roles (after super-admin batch):**
- `src/pages/district-supervisor/` — Dashboard, FacilityManagement, DistrictUsers, DistrictAuditLog
- `src/pages/uc-supervisor/` — Dashboard, Facilities, Users, StockRequests, AuditLog
- `src/pages/facility-head/` — Dashboard, Users, Approvals, StockRequests, AuditLog
- `src/pages/facility-supervisor/` — Dashboard, Approvals, RecordStock, StockRegister, WorkerManagement, AssignVials, DayEnd, AuditLog
- `src/pages/shared/` — FacilityDetail, Analytics, DashboardGuide
- `src/pages/facility-worker/` — StockEntry, StatusView (design fresh — phone-first, not in reference)
- `src/pages/login/` — LoginPage, ForgotPassword, ResetPassword (align to new language)

**After full rollout:**
- Re-enable `@media (prefers-color-scheme: dark)` block in `src/index.css` (auto dark mode for OS users)
- Update `.impeccable/design.json` to reflect new tokens (currently stale — describes old blue `#1F6FEB` system)
- Update `PRODUCT.md` — the "no webfont" and "no gradient" rules are now superseded by Figtree + dark mode decision
- Update `CLAUDE.md` — note `reference design/` as source of truth; flag `.impeccable/design.json` as stale

---

### Important notes for next session

1. **Dev server must be on port 5173** — backend CORS allowlist rejects 5174
2. **Login credentials for browser testing:** `admin@akuh.pilot` / `alwasya` (super admin)
3. **Branch is `redesign/ui-clinical-material`** — do not merge to main until full rollout is done and dark mode is QA'd across all roles
4. **The `DistrictManagement.jsx` conversion is uncommitted** — it should go into the first super-admin batch commit along with the other super-admin screens
5. **`reference design/` folder** is the source of truth for visual language, not `.impeccable/design.json` (which is stale)
6. **Do NOT add `@media (prefers-color-scheme: dark)` yet** — it's intentionally absent until all screens are converted
7. **Recharts SVG attributes** cannot read CSS variables — always use `useTheme()` to get concrete hex values for chart colors: `const { resolved } = useTheme()` then `const axisColor = resolved === 'dark' ? '#9AA39C' : '#9CA3AF'`

---

## Session Log — 2026-10-11 Session 5

### What changed in session 5

Implemented all remaining Client Requirements §7, §8, and §9 (PWA).

**§9 — PWA: installable app, push notifications, session restore, offline queue, connectivity indicators**

1. **Deps installed:** `vite-plugin-pwa`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`
2. **`vite.config.js`** — added `VitePWA({ strategies:'injectManifest', srcDir:'src', filename:'sw.js' })` with full manifest (name, short_name, theme_color `#006241`, display `standalone`, start_url `/`).
3. **`public/icon.svg`** — new maskable app icon (brand-green syringe + cross mark).
4. **`src/sw.js`** — custom service worker: `precacheAndRoute(self.__WB_MANIFEST)` for app shell; `NetworkFirst` runtime cache for `GET /api/*`; `push` event shows notification from JSON payload; `notificationclick` focuses existing tab or opens `data.url`.
5. **`src/lib/api.js`** — added `getSession`, `getPushPublicKey`, `subscribePush`, `unsubscribePush`.
6. **`src/lib/push.js`** (new) — `isPushSupported`, `enablePush` (permission → VAPID subscribe → backend POST), `disablePushForLogout` (best-effort DELETE + local unsubscribe).
7. **`src/context/AuthContext.jsx`** — session restore: on mount, if no sessionStorage, calls `getSession()` (cookie-only) to restore user silently; `bootstrapping` flag prevents login flash on PWA relaunch; `logout` now calls `disablePushForLogout()` first.
8. **`src/App.jsx`** — `AuthLayout` and `LoginRoute` show `<PageLoader />` while `bootstrapping` is true.
9. **`src/components/layout/NotificationPanel.jsx`** — "Enable notifications" footer row (idle state → shows Enable button; granted → hidden; denied → shows "allow in browser settings"). Uses `enablePush()` on tap (satisfies iOS requirement for user-gesture).
10. **`src/lib/offlineQueue.js`** (new) — localStorage-backed queue (`sst_offline_queue`), `enqueue/getQueue/replayQueue`; per-item status-code handling (`400`→error, `409`→regen clientRef+retry, `401`/5xx/network→stop); pub/sub for UI.
11. **`src/hooks/useOfflineSync.js`** (new) — mounts in Layout; listens to `online` event + mount; runs `replayQueue()`; invalidates `['holdings','dashboard','audit-log']` on drain.
12. **`src/components/layout/Layout.jsx`** — mounts `useOfflineSync`.
13. **`src/components/layout/TopBar.jsx`** — connectivity dot (`WifiOff` icon when offline), pending-count badge, "Synced HH:MM" timestamp (via `useSyncExternalStore` on `subscribe`/`getQueue`/`getLastSynced`).
14. **`src/pages/facility-supervisor/AssignVials.jsx`** + **`DayEnd.jsx`** — if `!navigator.onLine` on submit, enqueues with existing `clientRef` and shows "Saved Offline" confirmation screen instead of server round-trip.

Build: `npm run build` clean. PWA plugin emits `dist/sw.js` (74 precached entries) + `dist/manifest.webmanifest`.

**Risks:**
- Cross-origin credentialed API caching in the SW is best-effort (may fail with CORS restrictions); app-shell precache + TanStack in-memory data is the real offline story.
- iOS push requires Safari 16.4+ and app added to Home Screen.
- Full push delivery requires a backend-triggered event; subscribe flow can be verified but delivery requires backend action.

---

## Session Log — 2026-10-11 Session 4

### What changed in session 4

Read updated docs: `docs/api-reference (3).md`, `docs/FRONTEND_HANDOFF (4).md`, `docs/functionality (5).md`. Compared against built codebase. Implemented Sprint 8 items and display gap fixes.

**Sprint 8 — `opening` entryType (go-live opening balance)**

1. **`src/pages/facility-supervisor/StockRegister.jsx`** — added `opening` entryType to:
   - Balance calc (adds to balance like `received`)
   - `ENTRY_TYPE_PILLS` (sky blue "Opening" pill)
   - `pillCounts` init
   - Display switch (`case 'opening': 'Opening Balance'`)
2. **`src/pages/super-admin/AuditLog.jsx`** (reused by district + facility-head) — added `opening` case in STOCK_ENTRY verb ternary → shows "opening balance"
3. **`src/pages/uc-supervisor/AuditLog.jsx`** — same one-line addition
4. **`src/pages/shared/Analytics.jsx`** — accumulated `opening` field from movement rows; included in Received stat card total; added Opening column to movement table

**Display gaps**

5. **`src/pages/super-admin/DistrictManagement.jsx`** — added `province` as sub-line under district name (both desktop and mobile)
6. **`src/pages/shared/FacilityDetail.jsx`** — added amber "Custom" badge next to Min. Threshold label when `thresholdOverridden === true`
7. **`src/pages/super-admin/FacilityManagement.jsx`** — added `lastActivityAt` / `deactivatedAt` sub-line in Status column

`facility-supervisor/AuditLog.jsx` — no change needed (non-`used` already maps to `qtyType: 'in'`).

Build: `npm run build` passed clean.

**Browser-tested (agent-browser, live backend):**
- **DistrictManagement** — province renders as "Sindh · <date>" sub-line under each district ✓
- **FacilityManagement** — Status column shows "Last active <date>" (active) and "Since <date>" (inactive) ✓
- **FacilityDetail** — page renders cleanly; "Custom" badge not observable (no facility in current dataset has a Head-approved override — correct, stays hidden)
- **`opening` entryType** (StockRegister/AuditLog/Analytics) — NOT browser-verifiable yet: `opening` rows only exist after the Sprint 8 go-live seeding script runs on the backend. Logic is in place and build-clean; no live data to render against.
- Note: dev server must run on **port 5173** — the backend CORS allowlist rejects other ports (5174 fallback got blocked).

Committed as `feat: Sprint 8 opening entryType + district/facility display gaps` (8 files). Pushed to `origin/main`. `CLAUDE.md` left uncommitted (unrelated pre-existing edit).

### Requirement gap review (vs `Client Requirements.md` §1–§9)

Reviewed `docs/Client Requirements.md`, `docs/QuestAnswer.md`, `docs/users.md` against the built app. §1–§6 and the §7 analytics screen were already built. **Three gaps found** (all frontend; none blocked on backend except PWA's push/offline):
- **§8 — Dashboard demonstration/info screens** — was missing.
- **§7 — downloadable Excel/PDF reports** — the analytics screen existed but the file export did not.
- **§9 — PWA** (install, push, offline, sync indicators) — entirely missing.

### §8 built — Dashboard Guide screens (frontend-only)

- **New `src/pages/shared/DashboardGuide.jsx`** — one shared, role-keyed component (purpose, responsibilities, numbered workflow, dashboard sections). Matches existing design (primary header + white rounded-2xl cards + lucide icons, existing tokens).
- **`src/App.jsx`** — lazy import + 6 routes: `/super-admin/guide`, `/district/guide`, `/uc/guide`, `/facility/guide`, `/head/guide`, `/worker/guide` (observer uses `/super-admin/guide`).
- **`src/components/layout/Sidebar.jsx`** — `Compass` icon imported; "Guide" link added to all 7 role NAV configs.
- Browser-verified: Super Admin guide renders correctly; content is role-specific.

### §7 built — downloadable Excel/PDF reports (frontend-only)

- **New `src/lib/reports.js`** — pivots analytics `movement` into **Monthly** and **Vaccinator-wise** reports; builds `.xlsx` (2 sheets) and `.pdf` (jsPDF + autotable). Pivot math self-checked (grouping, sums, store-row exclusion, net adjustment).
- **`src/pages/shared/Analytics.jsx`** — Excel + PDF export buttons in the date-range card; disabled when no data; "Preparing…" state; inline error on failure.
- **Deps added:** `xlsx`, `jspdf`, `jspdf-autotable` — **dynamically imported** inside the export handlers so they stay out of the initial bundle (confirmed as separate build chunks).
- Browser-verified end-to-end with live backend data: Excel (Monthly 38 rows + Vaccinator-wise 15 rows, correct headers/values) and PDF (valid, 3 pages) both downloaded with zero console errors.
- ⚠️ **Security note:** `npm audit` flags advisories coming mainly from the `xlsx` (SheetJS) npm package (known long-standing prototype-pollution / ReDoS). Still the standard community Excel lib; SheetJS now recommends their own CDN registry over npm, or switch to a CSV path if the advisory matters.

### §9 PWA — still NOT implemented (status updated)

- Confirmed absent from the codebase: no manifest, no service worker, no `vite-plugin-pwa`, no push/session API functions, no offline queue, no online/offline or "last synced" indicator.
- **Backend Sprint 7 (push public-key, subscriptions, `GET /api/auth/session`) is now deployed** (per the product owner), so the frontend PWA work is **unblocked** — previously it was waiting on backend deploy.
- Frontend scope remaining: installable manifest + icons + service worker; push subscribe/unsubscribe lifecycle; session restore; offline queue for `/assign` + `/day-end` with `clientRef` replay; online/offline + last-synced indicators; add `getSession`/`getPushPublicKey`/`subscribePush`/`unsubscribePush` to `api.js`.

**Status at end of this entry:** §8 and §7 are built and browser-verified but **uncommitted** (awaiting commit permission). Next planned phase: manual role/workflow testing, then (separately) PWA.

---

## Session Log — 2026-10-11 Session 3

### What changed in session 3

Read the updated API reference (`docs/api-reference (2).md`), functionality doc, and frontend handoff. Then implemented Sprint 5 + Sprint 6.

**Sprint 5 (AuditLog + Notifications) — confirmed already done, no changes needed:**
- `AuditLog.jsx` already had all `STOCK_REQUEST_*` and `APPROVAL_*` action labels + the `status` badge for `entityType === 'stock_request' || 'approval'` rows.
- `NotificationPanel.jsx` renders `n.message` which is display-ready text from the backend — new notification types (`stock_assigned`, `stock_day_end`, `approval_cancelled`) work automatically.

**Sprint 6 — Analytics page (backend live, verified working):**

1. **`src/lib/api.js`** — added `getAnalytics({ from, to })` calling `GET /api/analytics`
2. **`src/pages/shared/Analytics.jsx`** — new shared page:
   - Date range filter (defaults to last 12 months ending today)
   - 3 stat cards on Movement tab: Received (vials), Used (doses), Wasted (vials)
   - 4 tabs: Movement (aggregated by vaccine), Remaining Stock (facility × vaccine), Requests (by month), Pending Approvals
   - All data from single `getAnalytics` call; query key `['analytics', from, to]`
3. **`src/App.jsx`** — 5 new routes all pointing to the shared Analytics component:
   - `/super-admin/analytics`, `/district/analytics`, `/uc/analytics`, `/facility/analytics`, `/head/analytics`
4. **`src/components/layout/Sidebar.jsx`** — `BarChart2` icon added to imports; Analytics link added to all 6 applicable roles: `super_admin`, `observer`, `district_supervisor`, `uc_supervisor`, `facility_supervisor`, `facility_head`

**Browser tested with agent-browser:** All 4 tabs loaded with live backend data. Movement showed 841 vials received / 6280 doses used / 64 wasted. Remaining Stock showed per-facility/vaccine breakdown. Requests showed 2026-10 month row. Pending Approvals showed 2 items.

**What was already completed in session 2 (prior session):**
- TopBar ROLE_LABELS: added `uc_supervisor`, `facility_head`, `observer` (item 3 from old pending list)
- ThresholdManagement deleted: `src/pages/facility-supervisor/ThresholdManagement.jsx` + its route in `App.jsx` removed (item 2)
- Observer button in Add User modal: visually confirmed working in browser (item 1)
- Observer read-only enforcement: confirmed already guarded on all super-admin pages (item 5)

---

## Session Log — 2026-10-11 Session 6

### What changed in session 6

**Dead code removal (frontend cleanup gap from HANDOFF)**

- **`src/lib/api.js`** — removed `updateVaccineStock(id, quantity)`. Called `PUT /api/vaccines/:id/stock` which was removed in Sprint 3. No page called it after `ThresholdManagement.jsx` was deleted.
- **`src/pages/facility-supervisor/VaccinesList.jsx`** — deleted. Page was never routed in `App.jsx`; only caller of `updateVaccineStock`.

Build: `npm run build` clean. Committed as `bedef79` and pushed to `origin/main`.

**All client requirements §1–§9 remain complete. No regressions.**

---

## Session Log — 2026-10-11 (Sessions 1 & 2)

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
      Analytics.jsx      — shared by all roles except facility_worker (6 routes, 1 component)
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

**Analytics (Sprint 6):** `getAnalytics({ from, to })` — optional date strings `YYYY-MM-DD`, defaults to last 12 months server-side

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

### Sprint 5 — AuditLog status field + new notification types
All Sprint 5 changes were **already present** in the codebase when the API reference was reviewed — no code changes were needed:
- `AuditLog.jsx`: already had `STOCK_REQUEST_*` action labels (lines 52–57), `APPROVAL_*` labels (lines 47–50), and `status` badge rendering for `entityType === 'stock_request' || 'approval'` rows (lines 271–285)
- `NotificationPanel.jsx`: renders `n.message` as display-ready text from the backend — new types (`stock_assigned`, `stock_day_end`, `approval_cancelled`) display automatically

### Sprint 6 — Analytics page
- `src/pages/shared/Analytics.jsx` — new shared page; date range picker + 3 stat cards (movement tab only) + 4 tabs: Movement, Remaining Stock, Requests, Pending Approvals
- `src/lib/api.js` — added `getAnalytics({ from, to })`
- `src/App.jsx` — 5 new routes: `/super-admin/analytics`, `/district/analytics`, `/uc/analytics`, `/facility/analytics`, `/head/analytics`
- `src/components/layout/Sidebar.jsx` — Analytics link (`BarChart2` icon) added to `super_admin`, `observer`, `district_supervisor`, `uc_supervisor`, `facility_supervisor`, `facility_head` NAV configs

### observer + facility_head in Add User form (UserManagement.jsx)
Both roles now appear as selectable options in the "Add User" modal:
- `facility_head` → sends `facilityId` (same as facility_supervisor/worker)
- `observer` → sends no assignment field (`districtId`/`facilityId`/`ucIds` all omitted)
- Both roles added to `ROLE_FILTERS`, `ROLE_LABELS`, `ROLE_SUCCESS_LABELS`

---

## Known State at Handoff

### Verified working (browser-tested)
- Login for all 7 roles (no blank-page loops)
- super_admin: all pages, Add User modal with all 7 roles, Analytics page (all 4 tabs)
- facility_supervisor: Dashboard, Approvals, Stock Requests, Stock Register, Workers, Assign Vials, Day End, Audit Log, Analytics
- facility_worker: Stock Entry (mobile layout, sticky form), Status View
- facility_head: Dashboard, Users, Approvals, Stock Requests, Audit Log
- uc_supervisor: Dashboard, Facilities, Users, Stock Requests, Audit Log
- district_supervisor: Dashboard, Facilities, Users, Audit Log
- observer: can log in, sees super_admin layout read-only
- TopBar role chip shows correct human-readable label for all 7 roles

### Dead code
None remaining.

---

## Data Fetching Conventions

- TanStack Query v5 throughout
- Query keys: `['dashboard']`, `['users']`, `['vaccines']`, `['facilities']`, `['districts']`, `['ucs']`, `['uc', id]`, `['audit-log']`, `['district', id]`, `['approvals']`, `['approvals', 'pending']`, `['approvals', 'history']`, `['stock-requests']`, `['notifications']`, `['unread-count']`, `['analytics', from, to]`
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

## What To Do Next

### ① Send `BACKEND_FIXES.md` to the backend developer

`BACKEND_FIXES.md` at the project root lists 7 items. Items 1, 2, 4, and 5 are **High** priority and should be resolved before final delivery:

| # | Issue | Priority |
|---|---|---|
| 1 | `GET /api/auth/session` — returns 401 for valid cookies in new tabs | High |
| 2 | `GET /api/auth/session` — response missing `csrfToken` field | High |
| 3 | `POST /api/auth/logout` — session cookie not invalidated server-side | Medium |
| 4 | Session TTL too short / not rolling — causes unexpected mid-session logout | High |
| 5 | No role-based route authorization — cross-role data not blocked | High |
| 6 | Push delivery — backend never calls Web Push API | High |
| 7 | Per-device push subscriptions — unsubscribe on one device affects all | Medium |

### ② QA in production

The redesign branch is now merged to `main`. Test the live Vercel deployment in both light and dark mode across all 7 roles. Key things to verify:
- Dark mode auto-triggers on a device with OS dark mode set
- No surface falls back to white in dark mode
- TopBar shows page titles on all routes (Analytics, Guide, head/* pages)
- Mutation errors show toast/inline messages (RecordStock, Approvals, StockRequests)

### ③ Remaining functional work

All client requirements §1–§9 were completed in sessions 1–6. No known frontend functional gaps remain. Outstanding issues are backend-side (see `BACKEND_FIXES.md`).
