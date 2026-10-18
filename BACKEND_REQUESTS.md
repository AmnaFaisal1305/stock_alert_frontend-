# Backend Requests — Frontend → Backend

Updated 2026-10-18 · Frontend branch `main`

The one list of what the frontend still needs from the backend. Everything up to Round 39 is adopted on our side.

All new parameters should be optional and additive, and combined with the caller's role scope (never widening it). No request below renames a stored value or needs a data migration.

| # | Request | Blocks | Frontend side |
|---|---|---|---|
| 1 | Stock Register `kind` filter + `total` | the entry-type filter, a fixed page count | built; switches on when `total` arrives |
| 2 | Session cookie works behind a same-site proxy | the new-tab 401 fix | ready to deploy once you confirm |
| 3 | Items on `STOCK_REQUEST_CANCEL` audit rows | vaccines on cancelled rows | built; uses `details.items` when present |
| 4 | Wording in server-built text | consistent names (non-blocking) | labels unified on our side |

---

## 1. `GET /api/stock-register`: `kind` filter and `total`

**Why:** the register is cursor-paged with no count. The page count therefore grows as pages are reached, and going back lowers it ("of 4" becomes "of 3"). Filtering by entry type on the client would only cover the loaded page, so the filter was removed in Round 38.

**Ask:**
- **`kind`** (optional): a comma-separated list from `received`, `used`, `wasted`, `correction`. `received` also matches `opening` rows.
  - Example: `?kind=used,wasted`.
  - Omitted means every kind, as today.
- **`total`** in the response: the number of entries matching every filter (`vaccineId`, `from`, `to`, `kind`), ignoring `before`/`limit`.
  - Example: `{ entries, nextCursor, total }`.
  - This is the same as `GET /api/audit-log` already returns.

**Please ship both together.** The frontend shows the entry-type chips only when `total` is in the response.

## 2. Session cookie behind a same-site proxy (new-tab 401)

**Finding:** the frontend code has no race that could cause this.
- Queries wait for `GET /api/auth/session` on boot.
- A missing CSRF token gives the `403 CSRF_INVALID` path, not a 401.

The cause is that the session cookie is cross-site. The app and `smart-stock-alert-be.vercel.app` are different sites (`vercel.app` is on the Public Suffix List). Browsers that block third-party cookies (Safari ITP, Brave, Chrome incognito or Chrome with third-party cookies blocked) don't send it, so `/session` answers 401.

**Fix (frontend):** a Vercel rewrite `/api/*` → `https://smart-stock-alert-be.vercel.app/api/*`, with the app calling its own origin. The cookie then becomes first-party.

**Ask (please confirm each before we deploy):**
1. **No `Domain` attribute on the session cookie** (host-only). Behind the proxy the browser sees the frontend's host, and a `Domain=…be.vercel.app` cookie would be rejected. `SameSite=Lax; Secure; HttpOnly` is then enough.
2. **Trust the proxy for the client IP** (Express `app.set('trust proxy', …)` or equivalent; read `X-Forwarded-For`). Without it, every user arrives from Vercel's IPs. The login limit (10 per 15 min per IP) and any other per-IP limit would then be shared by everyone.
3. **Origin and CSRF checks** accept the frontend's own origin (`Origin: https://<frontend domain>`) on proxied requests. `FRONTEND_URL` should be the public frontend domain.
4. **Links in emails** (password reset) and **push payload URLs** keep pointing at `FRONTEND_URL`. No change is expected; please confirm nothing builds a URL from the request host.

Direct calls (local dev on port 5173) stay as they are, so CORS for `http://localhost:5173` is still needed.

## 3. Items on `STOCK_REQUEST_CANCEL` audit rows

**Why:** the Audit Log is paged on the server. A cancel row has no items, so the frontend looks up the matching `STOCK_REQUEST_CREATE` row. That row is usually on another page, so the cancelled row shows no vaccines.

**Ask:** write `details.items: [{ vaccineId, vaccineName, requestedVials }]` on `STOCK_REQUEST_CANCEL`, the same shape `STOCK_REQUEST_DECLINE` already writes. This applies to new rows only; no backfill is needed. The frontend reads `details.items` first and falls back to the create row for older entries.

## 4. Wording in server-built text (non-blocking)

The frontend now shows one label per backend value. Stored values stay as they are. Please use the same words in text the server writes, which the app shows as is (notification and push titles and bodies, emails, user-facing error messages):

| Backend value / concept | Say | Not |
|---|---|---|
| `facility_worker` | Vaccinator | worker, facility worker |
| `facility_head` | Facility Head | head, in-charge |
| `facility_supervisor` / `uc_supervisor` / `district_supervisor` | Facility Supervisor / UC Supervisor / District Supervisor | a bare "supervisor" where the level is unclear |
| `adequate` | Normal | adequate, healthy |
| `no_data` | Not updated | no data, not recorded |
| `partially_fulfilled` | Partially fulfilled | closed short, partial |
| stock request | stock request | delivery, indent, requisition (Form B keeps "Requisition") |
| approval `cancelled` | withdrawn | cancelled |
| per-facility thresholds | custom thresholds, reset to default | override, global |

**Two questions:**
- **Vaccine names:** does the DB store real names ("BCG", "OPV") or "Vaccine 01"–"Vaccine 16"? The frontend has a legacy "Vaccine NN" → name map. If no row uses "Vaccine NN" any more, we will delete it.
- **Analytics `status: "submitted"`:** please confirm it means "raised, not yet completed / declined / cancelled". We show it as "Open".
