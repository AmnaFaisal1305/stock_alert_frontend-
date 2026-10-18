# Frontend Handoff — Smart Stock Alert

**Current state as of 2026-10-19 (Rounds 36–37 adopted).** Read `CLAUDE.md` first: it holds the conventions, architecture, component layers and API constraints. This file covers only what `CLAUDE.md` doesn't: where the project stands, what is open, and what bites. History is in git (`git log`); the older session-by-session handoff was retired in this cleanup.

---

## Where things stand

- **Branch:** `main` holds everything. `a830f41` (Rounds 36–37) is pushed; the follow-up below is committed on top. `feature/ui-enhancements` is merged and can be ignored.
- **Backend docs received 2026-10-19** (`docs/FRONTEND_HANDOFF.md`, `FRONTEND_PENDING.md`, `api-reference.md`, `functionality.md`; gitignored copies). Rounds 36–37 reconciled and adopted, see below.
- **Backend's `FRONTEND_PENDING.md` (2026-10-18):** evaluated against the code and answered at the end of `BACKEND_REQUESTS.md`, then deleted. Everything it listed is now built.
- **Client requirements §1–§9:** all built (dashboards per role, stock requests, approvals, Assign Vials / Day End ledger, analytics with Excel/PDF, dashboard guides, EPI Form B, PWA with push and offline queue).
- **Backend:** latest round adopted is **Round 37**. **`BACKEND_REQUESTS.md` is the single doc for the backend** (it absorbed `STOCK_REGISTER_BACKEND.md` and `BACKEND_OFFLINE_PUSH.md`; done items removed). Open: #1 Stock Register (`GET /api/stock-register`), #2 offline back-dating window and session expiry.
- **Design system:** `DESIGN.md` ("The Ward Ledger"). Since 2026-10-18 it allows a categorical palette (`--cat-1…5`) for non-status colour, KPI icon tiles and the 🔔 emoji bell. Red/amber/green still mean status only.

### Verified against production, bulk status, housekeeping (2026-10-19)
All on the RHC Latifabad demo accounts, and each result was confirmed by a read-only API call. The test data was left in place, as agreed.
- **User create through the District → UC → Facility picker:** created "Test Vaccinator" (`test.vaccinator@example.com`, ZMID `ZM-TEST-01`, a non-deliverable address) at RHC Latifabad. Now active.
- **Per-facility override:** BCG low vials 6 → 7 saved (`thresholdOverridden: true`, plus an `EDIT_FACILITY_VACCINE` row), then Reset to Global (back to 6, `new: null`). Rota's "Custom" tag is its own approved override.
- **Bulk activate/deactivate (new, Super admin › Users, list view):**
  - Checkbox column with select-all for the page; the caller's own row has none.
  - An action bar for Activate / Deactivate / Clear, with Deactivate confirmed in a dialog.
  - `bulkUserStatus()` sends 25 ids per call.
  - Tested on the test vaccinator: deactivated, then activated.
- **Full stock request, 1 BCG vial:** raised (Sadia), sent (Asif), received (batch `TEST-BATCH-1`, expiry 2027-10-15), approved (Zubair).
  - The request is `completed`, and BCG went from 260 to 270 doses.
  - The audit chain is CREATE → SENT → RECEIVED → APPROVE, and each next actor got the notification.
- **Real offline replay:**
  - With no CSRF token in memory and the network blocked, a 1-vial assign to Rukhsana was queued.
  - On reconnect it synced through the generic-403 → refresh → retry path.
  - Her BCG went from 10 to 11, with exactly one `STOCK_ASSIGN` row for its `clientRef`.
  - A true offline cold start (app closed) was verified earlier on the production build.
- **Dependencies:**
  - `xlsx` now comes from SheetJS's own build (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), with the same API. A two-sheet workbook round-trips.
  - `react-router` is patched to 7.18.4.
  - `npm audit --omit=dev` shows 0 vulnerabilities. The remaining advisories are dev-only build tools that need breaking upgrades.
  - **Gotcha:** `npm audit fix --omit=dev` deleted the dev dependencies from `node_modules`; run `npm install` afterwards.
- **Design tooling (impeccable `doctor`):**
  - `.impeccable/design.json` refreshed: category palette, KPI icon tile, filter chip, the bell exception and the rules taken from `DESIGN.md`.
  - `PRODUCT.md` rewritten in the current schema: 7 roles, EPI positioning, operating context and evidence; the retired `## Register` removed.
  - `DESIGN.md`: the worker has no sidebar CTA.
- **Phone checklist:** `docs/phone-test-checklist.md` (gitignored), for push and offline on Android and iPhone.
  - The production build (`e3049c1`) deployed per GitHub.
  - Every `*.vercel.app` URL for this project sits behind Vercel login. `stock-alert-frontend.vercel.app` is someone else's app. Use the public domain the backend has as `FRONTEND_URL`.

### Offline cold start (2026-10-19)
Facility supervisors can open the app with no signal and record Assign Vials and Day End. Requests and approvals stay online-only.
- **Login:** `AuthContext` keeps the signed-in profile in `localStorage` (`sst_offline_user`, the profile only; the cookie is HttpOnly). If `/session` gets no response or a `5xx`, the app reopens as that user without a CSRF token.
- **Signing out with no signal:** sets `sst_logout_pending`, and the next start ends the server session before showing the login page. Before this, the still-valid cookie signed the user straight back in.
- **CSRF after an offline start:** `api.js` refreshes `/session` and retries once on a 403 to a write sent without a token, because the server answers a missing header with a generic 403 (`BACKEND_REQUESTS.md` #3). This is what lets the queue send after an offline start.
- **Saved lists:** `main.jsx` saves `vaccines`, `users`, `holdings` and `dashboard` to `localStorage` (`sst_query_cache`) using TanStack's own `dehydrate` / `hydrate`, so no new package. It keeps a query's data even after a failed refetch. Login, logout and a real `401` clear it.
- **Queued entries count in the holdings:** `lib/queuedHoldings.js` `applyQueued()` (self-check: `node scripts/check-offline-holdings.mjs`), so an offline Day End shows the vials an offline Assign handed out. Holdings come back as worker rows only; no store row is invented.
- **Expiry warning:** the top bar's offline chip says "N expire soon" for pending entries dated 2 or more days back (the server refuses more than 3).
- **Font:** the Figtree font is precached, so the cold start keeps the brand font.
- **Checked on the production build** (preview on port 5173):
  - A cold start offline as the supervisor shows the worker list.
  - A 1-vial assign was queued, and Day End showed 11 held instead of 10. The entry was discarded before going online.
  - Signing out offline, then reopening online, gives the login page and the server session returns 401.
  - Replaying with no token against a mocked 403 then 200 sent the entry.
  - An online switch from supervisor to Head leaked no data.
- **Not checked:** a real phone, and a real replay to production.

### Rounds 36–37 adopted (2026-10-19)
- **Round 37 (breaking, live): user management is Super Admin only.** Facility Supervisor › Workers is a read-only list; District/UC Users were already read-only. Super admin › Users creates workers / supervisors / heads with a District → UC → Facility picker (`union-councils?districtId=`). Deactivate is hidden on your own row. **Client note:** a facility can no longer add its own vaccinators.
- **Per-facility vaccine dialog:** sends the four thresholds only; doses/vial shown read-only (global). Reset sends four `null`s.
- **Analytics:** the District → UC → Facility filter sits above the tabs and goes to the API (`districtId`/`ucId`/`facilityId`), so charts, totals and Excel/PDF narrow too. Fixed a bug where those selects stored the change event instead of the value, so the filter never worked.
- **Facility dashboard KPI tiles** (supervisor and Head): "+N / −N / same vs last week" from `?compareTo=` (7 days back). Other dashboards count facilities, which `previous` can't give.
- **Last login** column on Super admin and District/UC Users (`lastLoginAt`, recorded only from Round 36's deploy on).
- **Push:** a tapped push opens `/?notif=<type>&entityType=…`, and `RoleRedirect` sends it to the role's screen via `linkFor()` (now in `lib/navigation.js`). The notification panel has "Send test" (`POST /api/push/test`) once alerts are on.
- **Offline queue:** `409` (ref used at another facility) is marked failed with that explanation; still not auto-resent with a new ref.
- **Follow-up:**
  - **Audit Log search:** `?q=` sent to the server, debounced, kept in the URL.
  - **Analytics drill-down:** sends `month` to `GET /api/stock-requests` (Pakistan month) instead of filtering client-side by the UTC date prefix.
  - **Analytics location filter:** shown only to super admin, observer and district supervisor; the other roles get `403` on the district/UC lists and are already scoped to one UC or facility.
  - **Housekeeping:** deleted the unused `icon-image.jpeg`.
  - **Checked in the browser:** search 53 → 2 entries for "BCG" as the Head; the drill-down request carries `month=2026-10`; the filter is hidden for the Head and lists only Hyderabad for the district supervisor.
- **Checked in the browser:** super admin (own row has no Deactivate, last login, cascade filled step by step without submitting, facility vaccine dialog opened without saving, analytics `districtId`: Received 1355 → 406 for Thatta); facility supervisor (read-only Workers, KPI delta text); push deep links for supervisor, Head and UC; offline 409/503 with a mocked `fetch`. **Not done:** a real create, Save/Reset of a facility override, Send test (all write to production).

### Built after the review (2026-10-18)
- **Route guards:** `AuthLayout` in `App.jsx` maps each URL prefix to its roles (`PREFIX_ROLES`); another role's URL redirects to the user's own dashboard. Observer keeps `/super-admin/*`. Checked in the browser for every role except super admin.
- **Scope line** shows "Facility · UC" (`scopeLabel()` uses `ucName`).
- **Form B** saves only the cells that differ from the saved sheet; cells typed back to their original value drop out of the save and the review.
- Removed the dead `createStockEntry` (old `POST /api/stock-entries`).

### Offline, push, logo and login (2026-10-18)
- **App shell offline on every URL:** `sw.js` has a `NavigationRoute` to the cached `index.html` (it only worked at `/` before). Skipped in dev, where nothing is precached.
- **Offline queue** (`lib/offlineQueue.js`): entries carry `userId` and each user only sees and replays their own (nothing is cleared at logout). Any `4xx` except 401/408/429 is a final refusal and marks the entry failed with the server's message, so one bad entry no longer blocks the rest. A `409` is **not** resent with a new `clientRef` any more (Round 36: it means the ref was used at another facility).
- **"Online" but no signal:** Assign Vials and Day End queue the entry when the request gets no response at all (`isNetworkError`), not only when `navigator.onLine` is false. The same `clientRef` makes the replay safe.
- **Failed entries are visible:** the top bar shows "N not sent"; the dialog lists each with the server's reason and a Discard button.
- **PWA icons:** 192/512 PNG (`public/images/icon-*.png`, rendered from `icon.svg`) in the manifest, an `apple-touch-icon`, and as the push notification icon and badge.
- **Login redesign** (`pages/login/LoginPage.jsx`, shared by Forgot and Reset password): follows `docs/design_refrences/login.html` (5/7 split, brand mark, 36px title, shield footer line; right panel with a partner-logo card showing `login-hero.jpeg`, "Digital intervention" message and the contact line). `DESIGN.md` wins over the mockup, so: Figtree instead of Fraunces / Plus Jakarta, 10 / 18px radii, no radial gradients, type sizes from the ramp. Not built: the "Keep me signed in" checkbox (no backend behaviour behind it) and the mockup's "Continue as …" chip (Google's own button is used when `VITE_GOOGLE_CLIENT_ID` is set). The logo card is always white because the JPEG has a white background.
- **Logo:** the browser favicon and the sidebar brand use the circular `public/images/logo-circle-192.png` (transparent corners, cut from `icon-192.png`; a 512 copy sits beside it).
- Verified: production build loads the shell offline on `/`, `/login` and deep URLs; queue outcomes (201, 422, 409, 500, network error, other user's entries) with a mocked `fetch`; Assign Vials end to end with the network failing (queued once, "Saved offline"). Nothing was sent to production.

### Recently built (2026-10-19, Amna)
- **Stock Register overhaul:** entry types consolidated to three labels (Received / Record / Stock Correction); new Balance column (per-vaccine running balance, red when negative); new Stock Correction column (signed +N / −N, green/red) for `ADJUST_STOCK` rows only; `ADJUST_STOCK` rows no longer bleed into the Received/Used columns. FilterChips and CSV export updated to match.
- **Stock Register endpoint spec:** now `BACKEND_REQUESTS.md` #1.

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
| Per-facility vaccine Save / Reset untested | Super admin › Vaccines (facility view) | Endpoint exists (Round 36) and the dialog matches it; not saved yet because it writes to production and notifies the Head |
| Stock Register balance excludes request receipts | Facility supervisor › Stock Register | Still built from the old `STOCK_ENTRY`/`ADJUST_STOCK` + `STOCK_DAY_END` rows; the first two are no longer written. **Checked live:** the supervisor's audit log returns no `STOCK_REQUEST_APPROVE` / `APPROVAL_APPROVE` rows (the Head's actions), so Round 36's suggestion can't work for this screen, and the approve rows carry no batch fields. Evidence and the ask are in `BACKEND_REQUESTS.md` #1. |
| Offline: back-dating and session expiry | Assign Vials, Day End | The server refuses entries dated more than 3 days back, and a session idle for 8 h needs a sign-in before the queue sends. Asked in `BACKEND_REQUESTS.md` #2. |
| Push delivery to a real device unverified | Notifications | Backend side is answered and "Send test" exists. Needs a real phone (Android, and iPhone with the app on the home screen). |
| New-tab 401 (backend A2) | Auth | Backend can't reproduce. If it recurs, capture the `/api/auth/session` request: status, `Cookie` header sent, browser, third-party cookie setting. |
| Audit Log: cancelled-request rows may lack vaccines | Audit Log | With server paging, the matching "request raised" row is often on another page. "Request #" still shows the full chain. |
| Real-phone push and offline unverified | PWA | Run `docs/phone-test-checklist.md` on Android and an iPhone (home-screen app). Needs the public production URL. |

### Not yet tested
- After the merge with Amna: her Stock Register and the Cancelled / Declined / Partially fulfilled tabs were checked only by `npm run build`, not in a browser.
- The redesigned login: layout checked in light, dark and phone width, but no sign-in was submitted and Google's button was not seen (no `VITE_GOOGLE_CLIENT_ID` in dev).
- Mobile Safari (sticky submit bars), Form B print preview, real file downloads (the headless browser cancels all downloads; CSV content was checked in-page).
- Push delivery to a real device, including an iPhone with the app added to the home screen (backend has never tested it either; production does return a push key). Subscribing from a test browser would save a fake subscription to the production database.
- The offline queue on a real phone with a flaky connection (replay to production is verified on desktop).

---

## Gotchas

- **Port 5173 only.** The backend CORS allowlist rejects other ports; kill stale node processes if Vite falls back to 5174.
- **Restart the dev server after editing `tailwind.config.js`,** or new colour classes silently don't appear.
- **Shared database.** Local and deployed backends use the production database; anything you create is real. Test logins and cautions: `docs/test-accounts.md` (gitignored, ask Ahmed if missing).
- **Login limit:** 10 per 15 minutes per IP. Reuse browser sessions while testing.
- **Recharts can't read CSS variables;** take hex values from `useChartTheme()`.
- **Dates:** never `toISOString()` for "today" (UTC is a day behind in Pakistan until 05:00); use `localDateStr()` / `toLocalDateStr()`.
- **`npm run preview` (port 4173) can't sign in:** the backend CORS allowlist rejects it. To test the production build signed in, run `npx vite preview --port 5173 --strictPort` instead (stop the dev server first; `TaskStop` can leave the preview's child process on the port).
- **After a rebuild the service worker keeps serving the old bundle** until it updates. When testing, unregister it and clear caches (`navigator.serviceWorker.getRegistrations()` → `unregister()`, `caches.delete`) before trusting a result.
- **agent-browser `set offline on`** blocks the network but leaves `navigator.onLine` true after a reload. That tests the "online but no signal" path; a real phone in airplane mode reports offline.
- **Favicons are cached hard:** hard-refresh (Ctrl+Shift+R) or use a fresh tab to see a changed one.
- **Several URL filter keys in one event:** use one `useUrlFilters` `set({...})` call; two calls in the same tick overwrite each other.

---

## Next steps

1. **Send `BACKEND_REQUESTS.md`** to the backend developer (Stock Register endpoint, offline window questions).
2. **Stock Register:** once #1 is answered, switch `StockRegister.jsx` to the confirmed source (one audit-log call with the action list, or `getStockRegister()`).
3. **Run `docs/phone-test-checklist.md`** on Android and an iPhone: push ("Send test") and offline (airplane-mode cold start, Assign + Day End, reconnect).
4. **QA the merged app** across all 7 roles, light and dark: the redesigned login (a real sign-in, the Google button), Amna's Stock Register and request tabs, route-guard redirects, and the "N not sent" dialog. (One full write flow is already verified on the demo accounts.)
5. **Dev-only advisories** (postcss, nanoid … in build tools): only with a planned Vite/tooling upgrade, as the fix is breaking.
