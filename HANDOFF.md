# Frontend Handoff — Smart Stock Alert

**Current state as of 2026-10-18.** Read `CLAUDE.md` first: it holds the conventions, architecture, component layers and API constraints. This file covers only what `CLAUDE.md` doesn't: where the project stands, what is open, and what bites. History is in git (`git log`); the older session-by-session handoff was retired in this cleanup.

---

## Where things stand

- **Branch:** `main` holds everything; `feature/ui-enhancements` (with Amna's per-facility thresholds, Analytics overhaul, district Network page) is merged and pushed.
- **Backend's `FRONTEND_PENDING.md` (2026-10-18):** evaluated against the code and answered at the end of `BACKEND_REQUESTS.md`, then deleted. Everything it listed is now built.

### Built after the review (2026-10-18)
- **Route guards:** `AuthLayout` in `App.jsx` maps each URL prefix to its roles (`PREFIX_ROLES`); another role's URL redirects to the user's own dashboard. Observer keeps `/super-admin/*`. Checked in the browser for every role except super admin.
- **Scope line** shows "Facility · UC" (`scopeLabel()` uses `ucName`).
- **Form B** saves only the cells that differ from the saved sheet; cells typed back to their original value drop out of the save and the review.
- Removed the dead `createStockEntry` (old `POST /api/stock-entries`).

### Offline and push fixes (2026-10-18)
- **App shell offline on every URL:** `sw.js` has a `NavigationRoute` to the cached `index.html` (it only worked at `/` before). Skipped in dev, where nothing is precached.
- **Offline queue** (`lib/offlineQueue.js`): entries carry `userId` and each user only sees and replays their own (nothing is cleared at logout). Any `4xx` except 401/408/429 is a final refusal and marks the entry failed with the server's message, so one bad entry no longer blocks the rest. A `409` is **not** resent with a new `clientRef` any more (could double-count; see `BACKEND_OFFLINE_PUSH.md` Q1).
- **"Online" but no signal:** Assign Vials and Day End queue the entry when the request gets no response at all (`isNetworkError`), not only when `navigator.onLine` is false. The same `clientRef` makes the replay safe.
- **Failed entries are visible:** the top bar shows "N not sent"; the dialog lists each with the server's reason and a Discard button.
- **PWA icons:** 192/512 PNG (`public/images/icon-*.png`, rendered from `icon.svg`) in the manifest, an `apple-touch-icon`, and as the push notification icon and badge.
- **Logo:** the browser favicon and the sidebar brand use the circular `public/images/logo-circle-192.png` (transparent corners, cut from `icon-192.png`; a 512 copy sits beside it). The old `icon-image.jpeg` is unused.
- Verified: production build loads the shell offline on `/`, `/login` and deep URLs; queue outcomes (201, 422, 409, 500, network error, other user's entries) with a mocked `fetch`; Assign Vials end to end with the network failing (queued once, "Saved offline"). Nothing was sent to production.
- **Client requirements §1–§9:** all built (dashboards per role, stock requests, approvals, Assign Vials / Day End ledger, analytics with Excel/PDF, dashboard guides, EPI Form B, PWA with push and offline queue).
- **Backend:** latest round adopted is **Round 35** (audit-log server filters and paging, `facilityName` on the session user, approval `decisionReason`/`decidedAt`, `statusCounts` unit). Everything still needed from the backend is in the root **`BACKEND_REQUESTS.md`** (11 items; #1 is blocking).
- **Design system:** `DESIGN.md` ("The Ward Ledger"). Since 2026-10-18 it allows a categorical palette (`--cat-1…5`) for non-status colour, KPI icon tiles and the 🔔 emoji bell. Red/amber/green still mean status only.

### Recently built (2026-10-18)
- **Shell:** ☰ menu button toggles the sidebar rail on desktop (remembered) and the drawer on phones; emoji bell; notification panel with type icons, Today/Earlier groups and click-through.
- **Every entity list:** Grid/List toggle (Grid default, remembered per page), icon row actions filtered by role, CSV export, filters kept in the URL.
- **Dashboards:** KPI icon tiles, "Needs attention" strip, categorical chart colours.
- **Confirmation:** review-before-submit on Assign Vials, Day End, raise / receive / send stock, approvals and Form B save; summary dialogs after creates and stock moves; custom calendar popover.
- **Vaccines (Amna + merge):** District → UC → Facility filter shows a facility's own thresholds with a "Custom" tag and an edit dialog with Reset to Global.
- **District Network page (Amna):** town → UC → facility hierarchy.
- **Analytics (Amna):** Stock Summary tab (movement + remaining), Stock Requests tab with a location filter and status drill-down, Approvals tab.

---

## Open issues

| Issue | Where | Notes |
|---|---|---|
| Per-facility vaccine Save / Reset fails | Super admin › Vaccines (facility view) | Endpoint missing: `BACKEND_REQUESTS.md` #1 |
| Stock Register shows negative balances | Facility supervisor › Stock Register | The balance ignores `STOCK_REQUEST_RECEIVED` and `STOCK_ASSIGN`, so stock that arrives through requests is never added. Frontend fix needed (decide how request receipts and worker assignments enter the ledger). |
| Offline only works if the app is already open | Auth, Assign Vials, Day End | A cold start offline lands on login (the session restore needs the network), and the forms' vaccine / worker / holdings lists live in memory only, so a reload offline leaves them empty. Fixing it needs a persisted query cache (new dependency) and a stored session; decide whether the pilot needs it. |
| Push delivery unverified; waiting on the backend | Notifications | Payload shape, `url` values and dead-subscription handling: `BACKEND_OFFLINE_PUSH.md` Q3–Q4 and R1 (test push). |
| New-tab 401 (backend A2) | Auth | Backend can't reproduce. If it recurs, capture the `/api/auth/session` request: status, `Cookie` header sent, browser, third-party cookie setting. |
| Analytics location filter only narrows the request list | Analytics › Stock Requests | Charts and totals need `BACKEND_REQUESTS.md` #3 |
| Audit Log: cancelled-request rows may lack vaccines | Audit Log | With server paging, the matching "request raised" row is often on another page. "Request #" still shows the full chain. |
| `.impeccable/design.json` is stale | Design tooling | Run `/impeccable document` so critiques know about the category palette and KPI tiles. `design-system-font-size 18px` is ignored for `TopBar.jsx` only (emoji bell). |
| `PRODUCT.md` uses the legacy impeccable schema | Design tooling | Run `/impeccable init` to refresh. |
| `xlsx` (SheetJS) npm advisories | Analytics Excel export | Long-standing prototype-pollution / ReDoS advisories; consider SheetJS's own CDN build or CSV only. |

### Not yet tested
- Any submit against the live backend (dialogs were opened and dismissed only: the demo inboxes belong to real people).
- Super admin write actions (the admin password in older notes is wrong; admin pages were checked as the read-only observer).
- Mobile Safari (sticky submit bars), Form B print preview, real file downloads (the headless browser cancels all downloads; CSV content was checked in-page).
- Push delivery to a real device, including an iPhone with the app added to the home screen (backend has never tested it either; production does return a push key). Subscribing from a test browser would save a fake subscription to the production database.
- The offline queue on a real phone with a flaky connection, and the auto-replay on the `online` event (checked only with a simulated `navigator.onLine` and a mocked `fetch`).

---

## Gotchas

- **Port 5173 only.** The backend CORS allowlist rejects other ports; kill stale node processes if Vite falls back to 5174.
- **Restart the dev server after editing `tailwind.config.js`,** or new colour classes silently don't appear.
- **Shared database.** Local and deployed backends use the production database; anything you create is real. Test logins and cautions: `docs/test-accounts.md` (gitignored, ask Ahmed if missing).
- **Login limit:** 10 per 15 minutes per IP. Reuse browser sessions while testing.
- **Recharts can't read CSS variables;** take hex values from `useChartTheme()`.
- **Dates:** never `toISOString()` for "today" (UTC is a day behind in Pakistan until 05:00); use `localDateStr()` / `toLocalDateStr()`.
- **Several URL filter keys in one event:** use one `useUrlFilters` `set({...})` call; two calls in the same tick overwrite each other.

---

## Next steps

1. Send `BACKEND_REQUESTS.md` (requests + answers to `FRONTEND_PENDING.md`) to the backend developer.
2. Fix the Stock Register balance (Amna).
3. QA the merged app in production across all 7 roles, light and dark, with a test account you own for one full write flow (request → sent → received → approved).
