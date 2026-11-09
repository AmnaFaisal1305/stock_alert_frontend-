# Frontend Handoff — Smart Stock Alert

**Current state as of 2026-11-09 (backend Round 48 adopted; nothing open; production serves the Kemari pilot).** Read `CLAUDE.md` first: it holds the conventions, architecture, component layers and API constraints. This file covers only what `CLAUDE.md` doesn't: where the project stands, how the less obvious pieces work, what is open, and what bites. The round-by-round history is in git (`git log -- HANDOFF.md`).

---

## Where things stand

- **Backend:** every round through **48** is adopted. `BACKEND_REQUESTS.md` is the one doc for the backend (delivered requests are removed from it). Nothing is open: the `dosesPerVial` request was closed on 2026-11-09 (pilot catalog set to the client's values). The backend's pending list of 2026-11-09 (Rounds 44–48 to-dos, hidden offline mode and Form B, pilot catalog) was checked against the code that day: all done. The backend's docs (`api-reference.md`, `FRONTEND_HANDOFF.md`, `FRONTEND_PENDING.md`) are dropped into `docs/` when a round arrives and deleted once adopted; ask the backend developer for current copies.
- **Client requirements §1–§9:** all built (dashboards per role, stock requests, approvals, Assign Vials / Day End ledger, analytics with Excel/PDF, dashboard guides, EPI Form B, PWA with push and offline queue).
- **EPI Form B is hidden** (2026-10-20, client request): no sidebar link, and `/…/sheet` redirects to the dashboard. `FormBSheet.jsx` and its API calls are kept; restore the import and the four routes in `App.jsx` and the links in `lib/navigation.js` to bring it back.
- **Guides** (`DashboardGuide.jsx`) come in English and Urdu (toggle saved in `localStorage` as `sst_guide_lang`). The Urdu was machine-written and needs a native speaker's review. Keep both languages in step with `NAV`.
- **Guided tour** (`lib/tour.js`, driver.js, 2026-10-30): on a user's first sign-in on a device, a short welcome tour of the shell, then each page's tour the first time it's opened. Page intros come from the Guide's `modules` text; extra steps for Dashboard, Assign Vials, Day End and Analytics, plus generic ones (search, filters, tabs, view, export) found by selector. Missing or off-screen targets are skipped (phones, Observer). Seen-state: `localStorage` `sst_tour_v1:<userId>` (per device, client's choice). Language follows `sst_guide_lang`, switchable inside the popover. Guide → "Take the tour" resets it. Its Urdu needs the same review. `lib/tourBridge.js` (2026-11-04): a thin callback bridge so `AuthContext` can stop the tour on logout without statically importing driver.js (which is lazy-only). `tour.js` registers its `stopTour` via `registerStop()` when it loads; `AuthContext` imports `stopTour` from `tourBridge` and calls it at the top of `logout`, the `sst:session-expired` handler, and the cross-tab logout storage event — this fixes the driver.js SVG overlay persisting on the `/login` page after sign-out. `Layout.jsx` also calls `stopTour()` then `maybeRunTour()` on every route change.
- **Analytics** (2026-10-30, Round 44 on 2026-11-02): filters in rows with "All …" options and a Vaccine filter (URL `?vaccine=`; location filters only for roles that have the selects). The main query stays unfiltered so the charts compare every vaccine and highlight the selected one; a second query with `vaccineId` feeds the Requests and Approvals tabs. Five cards: Vials Received (from the UC only: the pilot starts from zero stock, no opening balance), Stock Correction (+add / −delete vials), Used, Wasted, Available, with a balance line. Table: Received Vials / Vials Used / Vials Wasted / Wasted % / Stock Correction (vials) Add·Delete. Wasted % = wasted ÷ (stock carried in + received), "—" when waste came only from carried-in stock. "Share of wasted vials" pie beside the waste-rate bars (top 4 + Other). Click a vaccine anywhere to filter, legend toggles, card drill-downs. `balances` (Round 44) gives the stock at the start and end of any period, so the balance line reconciles for every period; Excel/PDF exports start with a "Stock balance" sheet/table (`buildBalanceRows` in `lib/reports.js`).
- **Production:** https://smart-stock-alert.vercel.app (public, no Vercel login). Every push to `main` deploys it. `main` is the only branch.
- **Stock requests and approvals follow the backend workflow** (2026-10-30). Open = `closedAt === null` (`isOpenRequest` in `lib/stockRequests.js`), never the stage alone. Either side can correct its figures in any open stage (forms prefill the current round, batch included); the FS can cancel at any open stage, including `ready_for_approval` (the no-Head escape); Decline only on a `submitted` request with no figures. A `partially_fulfilled` request always shows that badge, plus its stage while open or "Closed short" once closed; `closeReason`, sent/received notes and a figures-differ hint show in the row. The raise form lists only the facility's stocked vaccines (dashboard rows). Approvals: a cancelled approval with a `decisionReason` (Super Admin supersede) reads "Cancelled", without one "Withdrawn".
- **Batches** (Round 47, breaking, adopted 2026-11-02): stock is tracked per batch. Assign Vials shows each vaccine's store batches (`getStoreBatches()`, key `['store-batches']`): one batch is preselected, several need a pick from a dropdown before the stepper unlocks; one batch per vaccine per submission (a second batch is another assignment, the client's choice of UI). Day End lists one row per held batch (`batchId: null` = "No batch (older stock)"; pre-batch stock, gone since the 2026-11-09 wipe). A stock correction picks the batch and sets that batch's store total; its list uses `store-batches?includeEmpty=true` (Round 48, key `['store-batches', 'all']`), so a batch at 0 (expired ones marked) can be corrected upward; the assign picker keeps the plain list. My Holdings groups per vaccine with a line per batch; correction rows show the batch on both Approvals screens. `applyQueued()` keys rows by worker × vaccine × batch. `batchLabel()` (`lib/format.js`) renders "B123 · exp 31 Mar 2027".
- **Vials near expiry** (Round 47 `expiry`, client request): a sixth Stock Summary card (near expiry = batches expiring within two months; expired vials in its subtitle), a drill-down by facility, a "Vials Near Expiry by Vaccine" chart, and a "Vials near expiry" sheet/table in Excel/PDF (`buildExpiryRows`). Current figures: the date range doesn't apply; the vaccine filter does.
- **Unsent typing is guarded** (2026-11-02): Assign Vials and Day End call `useUnsavedGuard(dirty)` (`hooks/useUnsavedGuard.js`). With figures typed but not sent, the top bar's Refresh asks "Refresh and lose what you typed?", and a browser reload or tab close gets the browser's own prompt (not shown by iOS Safari).
- **Observer breadcrumbs:** `PageHeader` swaps a leading "Super Admin" for "Observer" when the Observer views the shared Super Admin pages.
- **`blockedBy`** (Round 46): an open request or pending approval nobody can move shows a "No Facility Head" / "No UC Supervisor" badge and a "Waiting: …" message (`blockedByMessage()` in `lib/status.js`) in `RequestList` and the Facility Supervisor's Approvals.
- **Users** (Round 45): Super Admin › Users has "Edit details" (first/last name, email, ZMID, phone, CNIC; `updateUser()`); only changed fields are sent, blanks clear the optional ones. Last name is optional on every create form.
- **Offline mode is hidden** (2026-11-02, backend: deferred to a later phase). `OFFLINE_ENABLED = false` in `lib/offlineQueue.js`: Assign Vials and Day End show "No connection. Nothing was saved…" instead of queueing. Entries queued before the switch still show in the top bar and replay. Set it to `true` to bring it back (and restore the guide's offline note).
- **Per-item links:** `/stock-requests/:id` and `/approvals/:id` (`ItemRedirect` in `App.jsx`) open the item on the role's own screen as `?open=<id>` (row expanded, highlighted, scrolled to; a decided approval opens History). Pushes pass `entityId` the same way, and since Round 48 the email buttons link to these routes too.
- **Threshold-change guard** (2026-11-04): `Approvals.jsx` (FS tab) now blocks submitting a threshold-change request whose four values are identical to the current vaccine thresholds. When identical, the submit button is disabled and an inline warning reads "These values match the current thresholds — change at least one before sending."
- **Install link and phone set-up** (2026-11-09, for the first user training): **share `https://smart-stock-alert.vercel.app/install`**. It is public (no sign-in, route outside `AuthLayout`) and shows the right way to install for the device: Chrome's own install dialog when it offers one, the three iPhone Safari steps (Share → Add to Home Screen → Add), the Android ⋮-menu steps, or, when the link was opened inside WhatsApp/Facebook/Instagram (`inAppBrowser()`), a warning to open it in Chrome/Safari with a Copy link button. English/Urdu toggle (same `sst_guide_lang` key; Urdu needs review). Every role's Guide starts with "Set up on your phone": the same install block plus **Turn on alerts** (and Send test once on). On an iPhone, alerts only work from the installed app, and the card says so. Code: `lib/pwa.js` (`isStandalone`, `platform`, `inAppBrowser`, `promptInstall`; `main.jsx` fires `sst:installable` when Chrome's prompt arrives or the app is installed), `components/shared/AppSetup.jsx` (`InstallApp`, `TurnOnAlerts`), `pages/login/InstallPage.jsx`, `hooks/usePushState.js` (push opt-in shared with `NotificationPanel`).
- **Pilot catalog on Assign Vials** (2026-11-09): `VACCINE_GROUPS` / `VACCINE_SUBTITLES` in `AssignVials.jsx` follow the backend's pilot catalog: Birth & Oral (BCG, HBV (Birth Dose), OPV (Polio), Rota), Injectables (Pentavalent, IPV, Pneumococcal, MR, TCV), Older children & women (TD, HPV). A name not listed still falls into "Other". Checked with those 11 names mocked; not yet against the live catalog.
- **Push works on a real phone** (confirmed by Ahmed, 2026-11-09). Since then the backend sends `critical_stock` pushes at high urgency, so they should arrive in battery saver too.
- **Phone fixes** (2026-11-09): on touch devices every input/select/textarea is 16px (`index.css`, `pointer: coarse`), because iOS zooms the page into any focused field under 16px; that was the cropped login seen on an iPhone. The shell, sidebar, login and error screen use `h-dvh`/`min-h-dvh` (with `h-screen` as fallback) instead of `100vh`, which on phones runs behind the browser's toolbar and hid the drawer's Sign out. Below `lg` the drawer has no height class at all: `fixed inset-y-0` fits the visible screen even in browsers without `dvh` (older Chrome, Samsung Internet, in-app browsers), where Sign out was still hidden in the browser but not in the installed app. The drawer footer pads for the home-bar safe area. `sw.js` now calls `skipWaiting()` + `clients.claim()`, so a new deploy takes over on the next visit instead of waiting for every tab and the installed app to close (no forced reload). The top-of-page alerts/install banner is hidden on the Guide, which has its own section, and it installs through `promptInstall()`.
- **Facility Head › Team** (2026-11-04) reuses the shared `UserDirectory` (`scope="facility"`), like the UC and district Users pages.
- **Performance pass** (2026-11-04, commit `6691806`): polling slowed and paused in background tabs (`refetchIntervalInBackground: false`; dashboards 15 s, vaccinator Status View 20 s, requests / worker stock entry / top bar 30 s, Audit Log widget 120 s). The export-only chunks (`xlsx`, `jspdf`, `html2canvas`) are left out of the service-worker precache (`globIgnores` in `vite.config.js`) and cached on first use by a `CacheFirst` route (`export-chunks` cache in `sw.js`), so an export works offline only after one online export. Vendor chunks split (`react`+`react-dom`, router, query, icons). Login carousel: first slide `fetchpriority="high"`, the others lazy. `index.html` preconnects to the backend origin, which only helps dev: production calls its own `/api` proxy.
- **Tests:** `npm test` runs 54 Vitest tests (`auditLog.js`, `api.js`, `push.js`, `stockRequests.js`, `reports.js`). `npm run build` is clean.
- **Design system:** `DESIGN.md` ("The Ward Ledger"). It allows a categorical palette (`--cat-1…5`) for non-status colour, KPI icon tiles and the 🔔 emoji bell. Red/amber/green mean status only.

### Phone-width check (2026-11-09, dev server, mocked session)
- The wipe removed the demo logins, so the signed-in screens were checked with the session and every API answer mocked in the browser (empty data): every sidebar page of the Facility Supervisor, Head, Vaccinator, UC, District and Super Admin at 360 px has no sideways scroll, no "undefined"/"NaN" and no error state. The drawer at 360×600 keeps Guide and Sign out on screen while the page list scrolls. The Guide's set-up section in English and Urdu, `/install` in the Chrome-prompt, iPhone (English/Urdu, RTL) and WhatsApp states, and login at 360 px also fit.
- Assign Vials and Day End with sample rows (two vaccinators, batches, a no-batch row) and the 16px rule forced on: fit at 360 px, steppers and cells 16px, sticky submit bar visible.
- Not checked: request/approval rows and other full tables with real data; the 16px rule and `dvh` on a real phone (headless Chrome has no toolbar or touch pointer); a real install. Check `/install` and the drawer on one iPhone and one Android, opening the link from WhatsApp too.

### Code check (2026-11-09, no browser)
- This file and `CLAUDE.md` checked against the source: tour bridge, threshold guard, `OFFLINE_ENABLED = false`, `useUnsavedGuard` on Assign Vials and Day End, Form B redirects, `store-batches` keys, `VACCINE_GROUPS` still split, perf settings. `npm test` (54 passing) and `npm run build` are clean; the built `sw.js` precache has no `xlsx`/`jspdf`/`html2canvas` entries.
- Doc fixes: test count 53 → 54; `BACKEND_REQUESTS.md` said "Nothing is open" but still carried the `dosesPerVial` request (since closed, see below); `CLAUDE.md` suggested port 5174 (CORS rejects it), missed `tourBridge.js`, the `store-batches` keys, the polling intervals and the Head's `UserDirectory`.
- Not checked: the screens themselves; the perf commit wasn't covered by the 2026-11-04 QA, which ran before it.

### Last verified (2026-11-04, full QA — all 7 roles, production)

Full automated QA run (all roles, all pages, all major flows) against https://smart-stock-alert.vercel.app. 0 critical issues found. Two bugs fixed in this session (see above).

- **All 7 roles loaded cleanly:** Super Admin, District Supervisor, UC Supervisor, Facility Supervisor, Facility Head, Facility Worker, Observer.
- **Cross-role data consistency verified:** Hib stock correction (+7 vials) approved via FH → immediately reflected in FH Stock Register (+1 entry), FH Audit Log, DS Audit Log, DS Network (Normal 4→5), FW Status View (Normal 4→5).
- **Remaining known data issues (not code bugs):** pre-Round-47 holdings show "No batch (older stock)" for Day End rows (expected); `dosesPerVial` discrepancy for BCG/OPV/Pneumococcal tracked in `BACKEND_REQUESTS.md` Round 44; three seed-data cosmetic issues (trailing space in "South Facility 2 ", lowercase district names, one typo email).
- **Tour SVG on /login (ISSUE-001) fixed:** driver.js overlay no longer persists after logout.
- **Identical threshold submission (ISSUE-002) fixed:** submit disabled when new values match current.
- **Not covered this session:** SA writes (district/UC/vaccine edits, user deactivate/reset/create end-to-end), push notifications on a real device, Raise Request and Record Sent end-to-end submissions, Export CSV content verification, password reset flow, Urdu tour text, super admin signed-in role.

### Previously last verified (2026-11-02, dev server against production, read-only)
- **Round 48:** production answers `includeEmpty=maybe` with `400`, so it is live; the correction form loads its batches with `includeEmpty=true` (RHC Latifabad has no batch at 0, so the list matched the plain one). Email links weren't checked (no email was triggered).
- **Small fixes:** the Observer's breadcrumbs read "Observer › Dashboard" / "Observer › Manage"; the request items table fits its card at 390 px with the Fulfilled column (FS Stock Requests); Refresh with typed figures on Assign Vials and Day End shows the warning, Cancel keeps the figures, "Refresh anyway" reloads clean.
- **Round 47 screens (FS Sadia Abbasi, RHC Latifabad):** Assign Vials batch line / dropdown (BCG has two batches) / "None in store" / disabled stepper / review with batch and over-batch warning, also at 390 px; Day End rows per batch (older stock labelled); correction form batch select. Analytics near-expiry card, chart and drill-down (production is all 0, so rows were injected in the page); empty state. Vaccinator My Holdings at 390 px. **No write was sent:** a real assign, day end and correction with `batchId` are still untested.
- **Rounds 44–46:** Analytics with a vaccine selected (Requests 12 vs 33, Approvals 0 vs 6, matching the API); balance line and Excel/PDF balance rows reconcile (29/29 rows; Sept 2026 checked via the API). `blockedBy` badge and message on requests and FS approvals (production has no blocked item, so the field was injected in the page). Edit user modal prefill and Save enabling (opened with the role faked in the browser, nothing sent). Offline Assign Vials shows the no-connection error and queues nothing. Per-item links for the FS (request + decided approval → History) and the Head (pending approval), including through sign-in.
- **Analytics request drill-down:** every status list now matches its count (all-time and 30 days + BCG): "Open" uses `?status=submitted`, and the list is limited to the period and to the facilities in the analytics rows (so District/UC filters apply).
- **Tours:** District and UC supervisors: welcome + every page's tour, no missing steps.
- **Dark mode at 390 px:** every sidebar page for the Observer, District, UC, Facility Supervisor (Thatta) and Head: no error state, no "undefined"/"NaN", no horizontal page scroll. The request items table now fits inside its card at 390 px, Fulfilled column included (2026-11-02).
- **Request tabs (UC Thatta):** Partially fulfilled (with "Closed short", shortfall note and close reason), Cancelled and Declined, each with its reason.
- **Offline chips (seeded entries):** "1 not sent" dialog with the server's reason, Discard clears it; "Offline · 1 pending · 1 expire soon" with a 6-day-old entry (seeded offline with an invalid payload, removed before reconnecting).

### Verified earlier (2026-10-21, production)
- **Stock Register (Round 43 + layout):** entry-type badges now show distinct **Used / Wasted / Returned / Received / Stock Correction** labels (was a single "Record" badge for day-end rows). Returned filter chip and Returned column are live and show real Round 43 `kind: returned` rows. Table fits the viewport without horizontal scroll at normal zoom; the Stock Register heading stays pinned under the top bar while scrolling. "Doses per vial" column sits after Expiry with a non-wrapping header.
- Not covered: column-header behaviour below `min-w-[760px]` (sub-phone widths), Stock Register on the Facility Head role.

### Previously verified (2026-10-20, dev server against production, read-only)
- **Minor changes (Form B hidden, phone login, bilingual guides, refresh button):** no Form B link in the observer, district, UC, facility supervisor, Head and vaccinator sidebars; `/…/sheet` redirects to the dashboard for each of them that had it. Login at 340 px dark and 390 px light has no horizontal scroll; the Google button sizes to the column (`renderButton` width = container, 200–400) and uses `filled_black` in dark mode. Every role's guide renders in English and Urdu (RTL) and lists exactly its sidebar pages. The top bar's Refresh icon (below `lg` only) reloads the page; the guide language survives it.
- **Round 41:** without `limit` the audit log returns 100 rows (the observer's log has 326). `getAllAuditLog()` returns all 326, and the Audit Log CSV export now covers every page (148-entry tab → 213 rows, one per vaccine item). A mocked `500` with `requestId` shows "Internal server error. Reference: …".
- **Smoke pass, light desktop:** every sidebar route for the observer, district, UC and facility supervisors, the Head and the vaccinator loaded with no error state, no "undefined"/"NaN" and no horizontal overflow. The vaccinator screen was also checked dark at phone width.
- Not covered: the super admin login itself, dark mode and phone width on the other roles, writes.

---

## How the less obvious pieces work

### Same-site API proxy
- `vercel.json` proxies `/api/*` to the backend, and `api.js` defaults `BASE_URL` to `''`. `VITE_API_URL` is **unset in Vercel Production** and set only in `.env.local` for dev. This fixed the new-tab `401` in browsers that block third-party cookies.
- Both cookies (`sst.token`, `__Host-sst.csrf`) are host-only on the app's domain. The backend keeps `SameSite=None`, trusts one proxy hop, and the client IP passes through (each user keeps their own login limit).
- **Rollback:** Instant Rollback in Vercel to the previous deployment, then re-add `VITE_API_URL=https://smart-stock-alert-be.vercel.app` and redeploy.
- **Reproducing the blocked-cookie case:** Chrome's `--block-third-party-cookies` flag does nothing. A profile whose `Default/Preferences` has `{"profile":{"cookie_controls_mode":1,"block_third_party_cookies":true}}` (agent-browser `--profile <dir>`) does.

### Sessions, CSRF and errors
- A `403` with `code: 'CSRF_INVALID'` refreshes `/session` and retries once (Round 39); no other `403` retries.
- A `500` body carries `requestId`; `request()` appends ". Reference: <id>" to the message so testers can quote it.
- `lib/push.js` races `navigator.serviceWorker.ready` against `READY_TIMEOUT_MS` (2 s). Without it, sign-out hung forever in browsers with no service worker.
- `buildQs` in `api.js` keeps primitives only, so TanStack's `queryFn` context never leaks into URLs.

### Offline (facility supervisor)
- **Cold start:** `AuthContext` keeps the profile in `localStorage` (`sst_offline_user`). If `/session` gets no response or a `5xx`, the app reopens as that user without a CSRF token; the first write then goes through the `CSRF_INVALID` refresh.
- **Signing out offline** sets `sst_logout_pending`; the next start ends the server session before showing the login page.
- **Saved lists:** `main.jsx` persists `vaccines`, `users`, `holdings` and `dashboard` to `localStorage` (`sst_query_cache`) with TanStack's `dehydrate`/`hydrate`. Login, logout and a real `401` clear it.
- **Queue** (`lib/offlineQueue.js`): entries carry `userId`; each user sees and replays only their own. Assign Vials and Day End queue on no response at all, not only when `navigator.onLine` is false. The same `clientRef` makes a replay safe. `401/408/429/5xx` retry; any other `4xx` (including `409`, "ref used at another facility") marks the entry failed with the server's message, shown in the top bar's "N not sent" dialog.
- `applyQueued()` (`lib/queuedHoldings.js`, self-check `node scripts/check-offline-holdings.mjs`) counts queued entries in the holdings.
- Entries may be dated up to 7 days back; the top bar's "N expire soon" counts entries 5+ days old. A supervisor's session lasts 7 days idle (other roles 8 h).
- `sw.js` serves the cached `index.html` for every navigation (production build only) and precaches the Figtree font.

### Push
- A tapped push opens `/?notif=<type>&entityType=…`; `RoleRedirect` sends it to the role's screen via `linkFor()` (`lib/navigation.js`). The notification panel has "Send test" (`POST /api/push/test`) once alerts are on.

### Route guards
- `AuthLayout` in `App.jsx` maps each URL prefix to its roles (`PREFIX_ROLES`); another role's URL redirects to the user's own dashboard. The observer keeps `/super-admin/*`.

### Audit Log rich view
- **Trigger:** `isRichView = isHeadTab || activeTab.params?.actorRole === 'facility_supervisor'`, i.e. the Facility Supervisor and Facility Head tabs on every role's Audit Log. The Vaccinators tab is plain.
- Summaries, flags, store impact and the request thread are computed client-side in `lib/auditLog.js` (`buildContext`, `formatAuditEntry`, `computeFlags`) from up to 150 rows loaded by `useAllAuditPages`. Flags whose related rows aren't in that set are skipped, never guessed. The CSV export loads every page (`getAllAuditLog`).
- **Flags:** `short_delivery`, `expiry_soon`, `pending_stale` (>24 h amber, >72 h red), `awaiting_received`, `backdated`, `post_dayend_assign`; for the Head, `open_shortfall`, `resolved_shortfall`, `threshold_lowered`.
- **Known limits:** `entry.status` is the entity's *current* status, not its status at the time of the row. Closing rows (cancel / decline / close-short) written before Round 40 have no `details.items`; they fall back to the create row when it is loaded. There are no LOGIN rows, only LOGOUT.

### Dependencies
- `xlsx` comes from SheetJS's own build (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`). `npm audit --omit=dev` shows 0 vulnerabilities; the remaining advisories are dev-only build tools that need a breaking Vite upgrade.

---

## Production data

Local and deployed backends share the **production database**, which has served the **real Kemari pilot since 2026-11-06**; pilot users started recording stock on 2026-11-09. The demo data, demo logins and QA leftovers are gone, and figures in the "verified" sections above describe the demo data, not today's. The pilot started from zero stock (no opening balance; stock enters only through stock requests) with the client's doses per vial: BCG 20, OPV (Polio) 20, Rota 1, IPV 10, Pneumococcal 4, Pentavalent 10, MR 5, TCV 5, TD 20, HPV 1, HBV (Birth Dose) 1. **Every write is real pilot data**: test only with the client's agreement. Pilot user emails end in `demo` (e.g. `asmauc06demo@gmail.com`) until the client confirms the real ones; those inboxes aren't ours, so never use forgot-password with them.

Logins: the pilot logins are at the end of the backend's `docs/users.md` (ask Ahmed). `docs/test-accounts.md` (gitignored) lists the old demo accounts, which no longer work.

---

## Open issues

| Issue | Where | Notes |
|---|---|---|
| New-tab `401` | Session | Fixed by the same-site proxy, but if it happens again, send the backend the `/session` request and response from the network tab. |
| Urdu guide text unreviewed | `DashboardGuide.jsx` | Written by the developer's assistant, not a native speaker. Have it reviewed and correct the `ur` entries. |

### Not yet tested
- **Round 47 writes:** a real Assign Vials, Day End and stock correction with `batchId` against production, and an approved correction's effect on that batch. Each is real data.
- A real Edit user save, and the Round 44–46 screens on the deployed build.
- Stock-request and approval writes after the 2026-11-02 workflow fixes: correcting sent/received, cancelling a `ready_for_approval` request, closing short, and a Super Admin-superseded approval's "Cancelled" label (screens and prefilled forms were checked read-only for the FS, UC Supervisor and Head).
- Tour: the super admin; the Urdu tour text on any role.
- Super admin signed in (the observer covered the same screens read-only).
- Dark mode and phone width for the super admin (the Observer covers the same screens).
- The redesigned login: a real sign-in was done. Google's button was rendered in dev (production client ID passed as an env var, not saved), but not the personalised "Sign in as …" variant or a Google sign-in itself.
- The Refresh button and Urdu guide inside the installed PWA on a real phone.
- A new Round 40 closing row (cancel / decline / close-short) showing its own vaccines.
- Mobile Safari (sticky submit bars), Form B print preview, real file downloads (the headless browser cancels downloads; CSV content is checked in-page).

---

## Gotchas

- **Port 5173 only.** The backend CORS allowlist rejects other ports.
- **Stopping the dev server can leave Vite's child `node` process on 5173,** and the next `--strictPort` start fails. Free it with `Get-NetTCPConnection -LocalPort 5173 -State Listen` → `Stop-Process`.
- **`npm run preview` (port 4173) can't sign in.** To test the production build signed in, run `npx vite preview --port 5173 --strictPort` with the dev server stopped.
- **Restart the dev server after editing `tailwind.config.js`,** or new colour classes silently don't appear.
- **Login limit:** 10 per 15 minutes per IP. Reuse browser sessions while testing.
- **Recharts can't read CSS variables;** take hex values from `useChartTheme()`.
- **Dates:** never `toISOString()` for "today"; use `localDateStr()` / `toLocalDateStr()`.
- **Calling `api.js` from the browser in dev:** `await import('/src/lib/api.js')` gives the app's own module (e.g. `setCsrfToken('wrong')` to test the CSRF retry).
- **After a rebuild the service worker keeps serving the old bundle.** Unregister it and clear caches before trusting a result.
- **agent-browser `set offline on`** leaves `navigator.onLine` true after a reload; it tests the "online but no signal" path.
- **Favicons are cached hard:** hard-refresh or use a fresh tab.
- **Several URL filter keys in one event:** use one `useUrlFilters` `set({...})` call; two calls in the same tick overwrite each other.
- **`npm audit fix --omit=dev` deletes the dev dependencies from `node_modules`;** run `npm install` afterwards.

---

## Next steps

1. **Run the Round 47 writes once** (assign from a chosen batch, the day end for it, a correction, ideally one on a batch at 0 to try Round 48's `includeEmpty`), then delete `docs/FRONTEND_HANDOFF.md` and `docs/api-reference.md`. A safe first call: assign more vials than a batch holds; the server refuses it and nothing is saved.
2. **Check the deployed build** (https://smart-stock-alert.vercel.app) for Rounds 44–48 and the three small fixes, read-only. Include the 2026-11-04 perf commit: an Excel/PDF export still works (its chunks now load on demand), and dashboards still refresh.
3. **Push works on a phone** (2026-11-09). Still worth a look: a tapped push opening its item, push on an iPhone home-screen app if only Android was tried, and the Refresh warning in the installed PWA.
4. **Finish the QA pass:** super admin signed in (password from Ahmed), a real Edit user save, the stock-request/approval writes listed above (each is real production data), a Google sign-in, and a real email button opening its item (Round 48).
5. **Pilot:** sign in as a pilot Facility Supervisor and confirm Assign Vials shows no "Other" group (the vaccine names match `VACCINE_GROUPS`). Offline mode and EPI Form B stay hidden until a later phase (backend, 2026-11-09).
6. **Watch for the first new closing row** in the Audit Log; it should show its vaccines without the create row on the page.
7. **Backend status (2026-11-09):** the backend's pending list was answered (all adopted, push works, no approval-by-id endpoint needed, install link shared). Nothing is waiting on either side.
8. **When the backend's next round arrives:** drop its docs into `docs/`, adopt them, update `BACKEND_REQUESTS.md` and this file, then delete the docs.
9. **Dev-only advisories:** only with a planned Vite/tooling upgrade.
