# Frontend Handoff — Smart Stock Alert

**Current state as of 2026-10-21 (backend Round 43 adopted).** Read `CLAUDE.md` first: it holds the conventions, architecture, component layers and API constraints. This file covers only what `CLAUDE.md` doesn't: where the project stands, how the less obvious pieces work, what is open, and what bites. The round-by-round history is in git (`git log -- HANDOFF.md`).

---

## Where things stand

- **Backend:** every round through **43** is adopted. `BACKEND_REQUESTS.md` is the one doc for the backend, and nothing is open in it. The backend's docs (`api-reference.md`, `FRONTEND_HANDOFF.md`, `FRONTEND_PENDING.md`) are dropped into `docs/` when a round arrives and deleted once adopted; ask the backend developer for current copies.
- **Client requirements §1–§9:** all built (dashboards per role, stock requests, approvals, Assign Vials / Day End ledger, analytics with Excel/PDF, dashboard guides, EPI Form B, PWA with push and offline queue).
- **EPI Form B is hidden** (2026-10-20, client request): no sidebar link, and `/…/sheet` redirects to the dashboard. `FormBSheet.jsx` and its API calls are kept; restore the import and the four routes in `App.jsx` and the links in `lib/navigation.js` to bring it back.
- **Guides** (`DashboardGuide.jsx`) come in English and Urdu (toggle saved in `localStorage` as `sst_guide_lang`). The Urdu was machine-written and needs a native speaker's review. Keep both languages in step with `NAV`.
- **Production:** https://smart-stock-alert.vercel.app (public, no Vercel login). Every push to `main` deploys it. `main` is the only branch.
- **Tests:** `npm test` runs 44 Vitest tests (`auditLog.js`, `api.js`, `push.js`). `npm run build` is clean.
- **Design system:** `DESIGN.md` ("The Ward Ledger"). It allows a categorical palette (`--cat-1…5`) for non-status colour, KPI icon tiles and the 🔔 emoji bell. Red/amber/green mean status only.

### Last verified (2026-10-21, production)
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

## Test data in production

Local and deployed backends share the **production database**; it is wiped at go-live. Left there on purpose:
- the user `test.vaccinator@example.com` (active) at RHC Latifabad;
- one completed 1-vial BCG stock request (note "Frontend QA test (1 vial)");
- Rukhsana Brohi holds one extra BCG vial from an offline-replay test;
- `LOGOUT` rows from test sign-outs.

Test logins: `docs/test-accounts.md` (gitignored, ask Ahmed if missing).

---

## Open issues

| Issue | Where | Notes |
|---|---|---|
| Real-phone push and offline unverified | PWA | No push has been seen on a device. Run `docs/phone-test-checklist.md` (gitignored) on Android and an iPhone with the app on the home screen. |
| Urdu guide text unreviewed | `DashboardGuide.jsx` | Written by the developer's assistant, not a native speaker. Have it reviewed and correct the `ur` entries. |
| Refresh drops unsent typing | Top bar | Refresh is a full reload: values typed but not submitted on Assign Vials / Day End are lost (queued offline entries are kept). |

### Not yet tested
- Super admin signed in (the observer covered the same screens read-only).
- Dark mode and phone width on every role except the vaccinator.
- The redesigned login: a real sign-in was done. Google's button was rendered in dev (production client ID passed as an env var, not saved), but not the personalised "Sign in as …" variant or a Google sign-in itself.
- The Refresh button and Urdu guide inside the installed PWA on a real phone.
- The Cancelled / Declined / Partially fulfilled request tabs, the "N not sent" dialog, and the "expire soon" chip with a real 5-day-old entry.
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

1. **Run `docs/phone-test-checklist.md`** on Android and an iPhone: push via "Send test"; an airplane-mode cold start, Assign + Day End, reconnect; the "expire soon" chip.
2. **Finish the QA pass:** super admin signed in, dark mode and phone width per role, the request tabs, the Google button.
3. **Watch for the first new closing row** in the Audit Log; it should show its vaccines without the create row on the page.
4. **When the backend's next round arrives:** drop its docs into `docs/`, adopt them, update `BACKEND_REQUESTS.md` and this file, then delete the docs.
5. **Dev-only advisories:** only with a planned Vite/tooling upgrade.
