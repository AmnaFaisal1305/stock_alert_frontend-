# Frontend Handoff — Smart Stock Alert

**Current state as of 2026-10-19 (Rounds 36–40 adopted).** Read `CLAUDE.md` first: it holds the conventions, architecture, component layers and API constraints. This file covers only what `CLAUDE.md` doesn't: where the project stands, what is open, and what bites. History is in git (`git log`); the older session-by-session handoff was retired in this cleanup.

---

## Where things stand

### Round 40 adopted (2026-10-19)
- **Stock Register:** the API takes `?kind=` (`received`, `used`, `wasted`, `correction`; `received` also matches `opening`) and returns `total`. The entry-type chips (All / Received / Record / Stock Correction) are always on, "Record" sends `kind=used,wasted`, and the page count is `ceil(total / 100)`, so it no longer shrinks going back. The count sits beside Export.
- **Audit Log:** `STOCK_REQUEST_CANCEL`, `_DECLINE` and `_CLOSE_SHORT` rows written from Round 40 carry `details.items`. One merged case in `auditLog.js` reads them and falls back to the create row for older rows. All 6 existing closing rows resolve through the fallback.
- **Wording:** the backend's 409 text now names the role ("…already has an active Facility Head"). `UserManagement` and `FacilityManagement` match `/already has an active/i` and show the server's text plus "Deactivate them first." The old `includes('active supervisor')` match had stopped working.
- **Vaccine names:** the backend confirmed the DB stores real names ("BCG", "OPV (Polio)"), so `vaccineNames.js` and all 56 `displayVaccineName()` calls are gone. The English groups in `AssignVials.jsx` are the live ones and stay.
- **Checked live** as Sadia and the observer: `total` is 95; `kind=used,wasted` gives 56 rows, all used or wasted; `kind=bogus` is `400`; the Record chip shows 56 entries and All returns to 95.
  - **Not checked:** the "of N" paging on real data (95 rows is one page; it was checked with a faked `total`), and a new Round 40 cancel row (this needs a write).
- **Proxy:** the backend kept `SameSite=None` on purpose and trusts one proxy hop. The IP check passed (the rewrite passes the real client IP), the backend **approved going live**, and `ip` is gone from `/api/health` again. Going live is on our side: see the Open issues row.

### Audit Log — rich facility supervisor view (2026-10-18, session 17)

Every tab whose `actorRole` is `facility_supervisor` now shows an enriched view with category chips, one-sentence summaries, worker name, store impact, flags, day grouping, expandable rows, a request thread modal, an attention strip, category filter chips, and a hide-session toggle. The enrichment is entirely client-side; no new API calls.

**What was added / changed:**

| File | Change |
|---|---|
| `src/lib/auditLog.js` | `getCategory(action)` → `'Stock movement' \| 'Request' \| 'Approval' \| 'Day end' \| 'Forms' \| 'Session'`; `computeFlags(entry, ctx)` → flag array; `formatAuditEntry(entry, ctx)` → rich display object; `buildContext()` extended with `entriesByEntityId` (Map) and `dayEndsByWorkerDate` (Set) for cross-page flag logic |
| `src/hooks/useAllAuditPages.js` | New hook — follows `nextCursor` up to `cap` pages (default 10 × 15 = 150 rows); cached under `['audit-log-all', params]`; used for flags, the attention strip, the thread modal, and CSV export |
| `src/components/shared/Table.jsx` | New `groups` prop (day-grouped `<tbody>` sections with sticky headers); new `expandedRow(row)` + `isExpanded(row)` props (chevron + expanded panel row) |
| `src/components/audit/AuditLogView.jsx` | Rich columns when `activeTab.params?.actorRole === 'facility_supervisor'`; day groups; expandable `ExpandedPanel`; `RequestThreadModal` (co-located, uses `useAllAuditPages({ entityId })`); `AuditAttentionStrip` (inline, uses `onClick` not route links); category `FilterChips`; hide-session toggle; enhanced CSV (one row per vaccine item, all pages); rich mobile cards |
| `src/components/audit/AuditLogWidget.jsx` | New — compact dashboard widget: last 5 non-session events as one-line summaries, top 3 flag items as clickable bullets; uses its own `getAuditLog` query |
| `src/pages/facility-supervisor/Dashboard.jsx` | `<AuditLogWidget>` appended below the stock table; `isSupervisor` gates the `auditLogPath` prop |
| `src/lib/auditLog.test.js` | 11 Vitest unit tests for `formatAuditEntry` (all passing) |
| `src/lib/auditLogHelpers.js` | Deleted — was untracked, never imported |

**Rich view trigger:** `activeTab.params?.actorRole === 'facility_supervisor'`. Covers: Facility Supervisor "My actions" tab, Super Admin / Observer "Facility Supervisors" tab, District / UC / Facility Head "Facility Supervisors" tab. The Vaccinators tab is untouched.

**Flags computed client-side:**

| Flag | Rule |
|---|---|
| `short_delivery` | Received vials < requested vials per vaccine (needs CREATE entry in loaded set) |
| `expiry_soon` | `expiryDate` ≤ received date on `STOCK_REQUEST_RECEIVED` |
| `pending_stale` | `APPROVAL_REQUEST` with `status=pending`, age > 24 h (amber) or > 72 h (red) |
| `awaiting_received` | `status=awaiting_both` + a RECEIVED entry exists for same `entityId` + age > 24 h |
| `backdated` | `details.occurredOn` date ≠ `toLocalDateStr(createdAt)` |
| `post_dayend_assign` | `STOCK_ASSIGN` where `occurredOn` date already has a `STOCK_DAY_END` for the same `workerId` in the loaded set |

All flags are skipped when the required entries are not in the loaded set (no guessing).

**storeImpact (physical store movement only):**
- `+N` → `STOCK_REQUEST_RECEIVED`, `STOCK_RECEIVE`
- `−N` → `STOCK_ASSIGN`
- null for everything else (requests, approvals, day end, session)

**Known limitations:**
- `entry.status` is the entity's *current* state, not state-at-event-time. "Now: Completed" can appear on a CREATED row if the request already closed.
- "Short by N" and `awaiting_received` require cross-page entries to be in the loaded set (same date/filter window). If the CREATE row is on a different page and past the 10-page cap, the flag is silently skipped.
- No LOGIN events in the API — session tab shows only LOGOUT.
- `post_dayend_assign` needs `details.workerId` and `details.occurredOn` on the assign entry. Older entries without these are skipped.

**Aligned with the naming pass and Round 40 when merged (2026-10-19):** the rich view's text follows the one-label-per-value rule: "Vaccinator" (column, "Unknown vaccinator"), "Partially fulfilled" instead of "Closed short", approval types from `approvalTypeLabel()`, and "Withdrawn" for a withdrawn approval's status badges. Summaries for cancel, decline and close-short read `details.items` first (Round 40) and fall back to the create row. The dashboard widget now loads the user list, so vaccinators show by name instead of "Unknown". `npm test` runs her 11 tests plus 4 for these changes (15 pass). Checked in the browser as Sadia: the rich table, the attention strip, the widget.

**Not checked in the browser by Amna** (no live credentials available during her session). The build passes clean.

### Naming pass (2026-10-18)
- **One label per backend value**, from the lib helpers. No backend or DB value changed. The rule is in `CLAUDE.md` › Avoid these patterns.
  - `facility_worker` → **Vaccinator** (sidebar "Vaccinators", Audit tab, pickers, columns).
  - `no_data` → **Not updated**.
  - Bare "Supervisor" columns → Facility / UC / District Supervisor.
  - "delivery" → stock request; the "Request sent" dialog → "Request raised".
  - "Partial" / "Close short" → Partially fulfilled.
  - Cancelled approvals → **Withdrawn**.
  - "Approval approved" → Change approved; `EDIT_FACILITY_VACCINE` labelled.
  - "Facility override" / "Reset to Global" → Custom / Reset to default.
  - Doses per vial is spelled one way; Analytics columns carry their units.
- **New helpers:** `ROLE_LABELS_PLURAL` (navigation.js); `APPROVAL_TYPES`, `approvalTypeLabel()`, `approvalStatusLabel()` and `submitted → Open` (status.js). The KPI and status lists on the dashboards now read `statusConfig().label` instead of hardcoded copies.
- **Kept on purpose:** URLs (`/worker/*`, `/facility/workers`, `/facility/record-stock`), Form B's government wording ("Medical Officer / In-charge", "Requisition"), and the Stock Register entry types.
- **Checked in the browser** (read-only), as the facility supervisor and the observer: dashboards, Approvals history (Withdrawn), Assign Vials, Audit Log, Users role chips, Facilities.
  - **Not checked:** dark mode, the Head / UC / district / worker screens.

- **Branch:** `main` holds everything and is pushed. No open branches except a temporary `proxy-check` for the IP test, if it still exists.
- **Backend docs** (`FRONTEND_HANDOFF.md`, `FRONTEND_PENDING.md`, `api-reference.md`, `functionality.md`):
  - Everything they list through Round 40 is built.
  - The local copies in `docs/` were deleted once adopted; ask the backend developer for current ones when the next round arrives.
  - `docs/` now holds only `test-accounts.md`, `phone-test-checklist.md`, `design_refrences/` and `screenshots/`.
- **Client requirements §1–§9:** all built (dashboards per role, stock requests, approvals, Assign Vials / Day End ledger, analytics with Excel/PDF, dashboard guides, EPI Form B, PWA with push and offline queue).
- **Backend:** latest round adopted is **Round 40**. **`BACKEND_REQUESTS.md` is the single doc for the backend** (done items removed), and nothing is open in it.
- **Design system:** `DESIGN.md` ("The Ward Ledger"). Since 2026-10-18 it allows a categorical palette (`--cat-1…5`) for non-status colour, KPI icon tiles and the 🔔 emoji bell. Red/amber/green still mean status only.

### Round 39 adopted (2026-10-19)
- **The CSRF retry keys on `code === 'CSRF_INVALID'`.** `api.js` `request()` refreshes `/session` and retries once. The old fallback is gone: retrying on any 403 to a write sent without a token, or on "csrf" in the message.
- **Checked live by curl:**
  - A signed-in logout with no header, and one with a wrong header, both returned `403 {"error":"Invalid or missing CSRF token","code":"CSRF_INVALID"}`.
  - The test session was then logged out properly.
- **Checked in the app:** signed in as Sadia, set a wrong token with `setCsrfToken('wrong')`, then called `logout()`. The calls were logout `403`, then `/session` `200`, then a successful retry, and the server session then answered `401`.
- **Not re-run:** the offline replay with no token in memory. It uses this same path and depends only on the `code` now.

### Round 38 adopted (2026-10-18)
- **Stock Register on `GET /api/stock-register`** (`getStockRegister()`). The balance is the server's `balanceVials`, and the client-side balance is gone.
  - Shown in doses (`vials × dosesPerVial`).
  - Vaccine and From/To filters go to the API and are kept in the URL.
  - Cursor pages of 100. The API gives no total, so the page count grows as pages are reached.
  - The CSV export loops every page.
  - Columns: Returned removed (the API doesn't list assign/return rows), Worker added (used/wasted rows).
  - The entry-type chips were removed: the API has no `kind` filter, and page-only chips would mislead.
- **The Facility Head has the register too:** `/head/stock-register`, under Records in the sidebar.
- **Offline window 3 → 7 days:**
  - The Assign Vials and Day End date pickers allow 7 days back.
  - The top bar's "N expire soon" now counts pending entries 5 or more days old.
  - The supervisor's session now lasts 7 days idle. No code change was needed, since a `401` only pauses the queue.
- **Checked in the browser** (RHC Latifabad, read-only):
  - Every vaccine's newest register balance × doses/vial equals the dashboard `quantity` (BCG 270).
  - The `TEST-BATCH-1` receipt shows its batch, expiry and manufacturer.
  - The vaccine and date filters reach the API.
  - Paging with `before` works (forced to 5 per page in the browser, since the facility has only 94 rows).
  - The CSV export looped 3 pages for 20 BCG rows.
  - As the Head: the sidebar link, the "Facility Head › Records" breadcrumb, and `/facility/stock-register` redirecting home.
  - Phone width in light mode.
  - The Assign Vials calendar allows 11–18 Oct.
  - **Not checked:** the "expire soon" chip with a real 5-day-old queued entry; dark mode on the register.
- **Known quirk:** going back a page can lower the page count ("of 4" becomes "of 3"), because only the pages already reached are counted. This is fixed once the API sends `total` (`BACKEND_REQUESTS.md` §1).

### Verified against production, bulk status, housekeeping (2026-10-19)
All on the RHC Latifabad demo accounts, and each result was confirmed by a read-only API call.

**Test data left in production (on purpose; production is wiped at go-live):**
- the user `test.vaccinator@example.com` (active) at RHC Latifabad;
- one completed 1-vial BCG stock request (note "Frontend QA test (1 vial)"), so BCG at RHC Latifabad is 270 doses;
- Rukhsana Brohi holds 11 BCG vials (one extra from the offline replay).
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
  - On reconnect it synced through the CSRF 403 → refresh → retry path, which since Round 39 is keyed on `CSRF_INVALID`.
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
- **CSRF after an offline start:** a write sent with no token gets `403 CSRF_INVALID`. `api.js` then refreshes `/session` and retries once (Round 39). This is what lets the queue send after an offline start.
- **Saved lists:** `main.jsx` saves `vaccines`, `users`, `holdings` and `dashboard` to `localStorage` (`sst_query_cache`) using TanStack's own `dehydrate` / `hydrate`, so no new package. It keeps a query's data even after a failed refetch. Login, logout and a real `401` clear it.
- **Queued entries count in the holdings:** `lib/queuedHoldings.js` `applyQueued()` (self-check: `node scripts/check-offline-holdings.mjs`), so an offline Day End shows the vials an offline Assign handed out. Holdings come back as worker rows only; no store row is invented.
- **Expiry warning:** the top bar's offline chip says "N expire soon" for pending entries dated 5 or more days back (the server refuses more than 7 since Round 38).
- **Font:** the Figtree font is precached, so the cold start keeps the brand font.
- **Checked on the production build** (preview on port 5173):
  - A cold start offline as the supervisor shows the worker list.
  - A 1-vial assign was queued, and Day End showed 11 held instead of 10. The entry was discarded before going online.
  - Signing out offline, then reopening online, gives the login page and the server session returns 401.
  - Replaying with no token against a mocked 403 then 200 sent the entry.
  - An online switch from supervisor to Head leaked no data.
- **Not checked on a real phone.** The replay to production was later verified on desktop (see above).

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
- **Checked in the browser:** super admin (own row has no Deactivate, last login, the cascade, the facility vaccine dialog, analytics `districtId`: Received 1355 → 406 for Thatta); facility supervisor (read-only Workers, KPI delta text); push deep links for supervisor, Head and UC; offline 409/503 with a mocked `fetch`. The writes were run afterwards (see the section above); "Send test" has not been run.

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
| New-tab 401 | Auth | **Cause found:** the session cookie is cross-site (`vercel.app` is a public suffix), so browsers that block third-party cookies drop it. No frontend race. Fix = same-site proxy. The backend answered the cookie, CORS and CSRF questions (Round 40); **the IP check passed (2026-10-18):** `/api/health` returned the same `ip` direct and through a preview of the rewrite, on home Wi-Fi (103.93.219.67) and mobile data (154.81.250.171), so the login limit stays per user. The backend approved going live. **Go-live (in this order):** (1) push the `vercel.json` rewrite and `api.js` `VITE_API_URL ?? ''` (still direct while the Vercel variable is set); (2) delete `VITE_API_URL` for Production in Vercel (`.env.production` is gitignored, so Vercel uses its dashboard value); (3) redeploy Production, because Vite bakes env at build time; (4) verify: `/api/health` through the app's own domain, sign in, open a new tab (still signed in), and repeat with third-party cookies blocked. **Rollback:** Instant Rollback in Vercel, then re-add the variable. Everyone signs in once more after the switch. |
| Audit Log: old closing rows lack their own items | Audit Log | Only rows written before Round 40 lack `details.items`; they resolve through the create row when it is on the same page. This fades out with time and needs no action. |
| Real-phone push and offline unverified | PWA | Backend side is answered and "Send test" exists, but no push has been seen on a device. Run `docs/phone-test-checklist.md` (gitignored, written 2026-10-19) on Android and an iPhone with the app on the home screen. **Needs the public production URL** (the domain the backend has as `FRONTEND_URL`); every `*.vercel.app` URL for this project is behind Vercel login. |

### Not yet tested
- After the merge with Amna: the Cancelled / Declined / Partially fulfilled tabs were checked only by `npm run build`, not in a browser.
- The redesigned login: layout checked in light, dark and phone width, but no sign-in was submitted and Google's button was not seen (no `VITE_GOOGLE_CLIENT_ID` in dev).
- Mobile Safari (sticky submit bars), Form B print preview, real file downloads (the headless browser cancels all downloads; CSV content was checked in-page).
- Push delivery to a real device, and the offline flow on a real phone with a flaky connection (see the Open issues row; the offline replay to production is verified on desktop).

---

## Gotchas

- **Port 5173 only.** The backend CORS allowlist rejects other ports; kill stale node processes if Vite falls back to 5174.
- **Restart the dev server after editing `tailwind.config.js`,** or new colour classes silently don't appear.
- **Shared database.** Local and deployed backends use the production database; anything you create is real. Test logins and cautions: `docs/test-accounts.md` (gitignored, ask Ahmed if missing).
- **Login limit:** 10 per 15 minutes per IP. Reuse browser sessions while testing.
- **Recharts can't read CSS variables;** take hex values from `useChartTheme()`.
- **Dates:** never `toISOString()` for "today" (UTC is a day behind in Pakistan until 05:00); use `localDateStr()` / `toLocalDateStr()`.
- **`npm run preview` (port 4173) can't sign in:** the backend CORS allowlist rejects it. To test the production build signed in, run `npx vite preview --port 5173 --strictPort` instead (stop the dev server first).
- **`TaskStop` can leave Vite's child `node` process on port 5173** (dev or preview). The next `--strictPort` start then fails. Free the port first with `Get-NetTCPConnection -LocalPort 5173 -State Listen` → `Stop-Process`.
- **Calling `api.js` from the browser in dev:** `await import('/src/lib/api.js')` gives the same module the app uses, for example `setCsrfToken('wrong')` to test the CSRF retry.
- **After a rebuild the service worker keeps serving the old bundle** until it updates. When testing, unregister it and clear caches (`navigator.serviceWorker.getRegistrations()` → `unregister()`, `caches.delete`) before trusting a result.
- **agent-browser `set offline on`** blocks the network but leaves `navigator.onLine` true after a reload. That tests the "online but no signal" path; a real phone in airplane mode reports offline.
- **Favicons are cached hard:** hard-refresh (Ctrl+Shift+R) or use a fresh tab to see a changed one.
- **Several URL filter keys in one event:** use one `useUrlFilters` `set({...})` call; two calls in the same tick overwrite each other.

---

## Next steps

**Start of next session:** `git pull`, run `npm install`, and ask for the public production URL (needed for step 3). Nothing is half-done in the working tree.

1. **Take the proxy live** (see the Open issues row for the order and the rollback), then delete the `proxy-check` branch and tell the backend developer it is live. When their next round arrives, drop the docs into `docs/`, adopt them, then delete them again.
2. **Watch for the first new closing row** (a cancel, decline or close-short written after Round 40) in the Audit Log; it should show its vaccines without the create row on the page.
3. **Run `docs/phone-test-checklist.md`** on Android and an iPhone:
   - Push: use "Send test".
   - Offline: an airplane-mode cold start, then Assign + Day End, then reconnect. This also covers the no-token replay through `CSRF_INVALID`, which has not been re-run since Round 39.
   - Watch for the "expire soon" chip on an entry dated 5 or more days back.
4. **QA the merged app** across all 7 roles, light and dark: the redesigned login (a real sign-in, the Google button), Amna's request tabs, route-guard redirects, and the "N not sent" dialog. (One full write flow is already verified on the demo accounts.)
5. **Dev-only advisories** (postcss, nanoid … in build tools): only with a planned Vite/tooling upgrade, as the fix is breaking.
