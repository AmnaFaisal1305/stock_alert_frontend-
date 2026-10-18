# Backend Requests — Frontend → Backend

Updated 2026-10-19 · Frontend branch `main`

The one list of what the frontend still needs from the backend. **Everything up to Round 37 is adopted on our side**, and nothing earlier is still open. This file replaces `STOCK_REGISTER_BACKEND.md` and `BACKEND_OFFLINE_PUSH.md`, which have been removed.

All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).

| # | Request | Screen | Priority |
|---|---|---|---|
| 1 | Stock Register source that includes stock received through requests | Facility supervisor › Stock Register | **High** (balance is wrong today) |
| 2 | Offline use: back-dating window and session expiry | Assign Vials, Day End (offline) | Medium (questions) |
| 3 | A missing CSRF header returns `403 "Internal server error"` | Every write | Low (worked around) |

---

## 1. Stock Register

**Screen:** Facility supervisor › Stock Register. One row per stock movement for the supervisor's facility, with a per-vaccine running balance.

### Problem today
The register is built from the audit log. Since Round 36, `STOCK_ENTRY` and `ADJUST_STOCK` are no longer written, so stock that comes in through requests, and approved corrections, never reach the register. A facility stocked through requests shows a balance that contradicts the dashboard, and can even go negative.

### Why Round 36's suggestion doesn't work for this screen
We checked it against production (2026-10-19, RHC Latifabad, read-only calls):
- `GET /api/audit-log?action=STOCK_REQUEST_APPROVE,APPROVAL_APPROVE,STOCK_ASSIGN,STOCK_DAY_END` **as the facility supervisor** returns 7 `STOCK_ASSIGN` and 2 `STOCK_DAY_END` rows, and **no** `STOCK_REQUEST_APPROVE` or `APPROVAL_APPROVE` rows.
  - That is despite the facility having 1 `completed` request, 1 `partially_fulfilled` request and 1 approved approval.
  - This matches `api-reference.md` (audit log: "the Head's approve/reject rows are not in their view").
- The same call **as the Head** returns them. `STOCK_REQUEST_APPROVE.details` is `{ status, note, items: [{ vaccineId, vaccineName, requestedVials, receivedVials, fulfilledVials }] }`.
  - It has **no** `batchNo`, `expiryDate` or `manufacturer`, which the register shows for stock in.

### What we'd like (preferred): `GET /api/stock-register`
A dedicated, read-only endpoint. The balance is then computed where the dashboard figure is, and the two can't drift apart.

- **Roles:** `facility_supervisor` and `facility_head`, restricted to their own facility. If it's easy, also allow `super_admin` / `observer` / district / UC with a required `facilityId`.
- **Query (all optional):**

| Param | Type | Meaning |
|---|---|---|
| `vaccineId` | UUID | One vaccine only |
| `from`, `to` | `YYYY-MM-DD` | Pakistan days, inclusive |
| `limit`, `before` | int, cursor | Paging, like the audit log (newest first) |

- **Response:**

```json
{
  "entries": [
    {
      "id": "uuid of the source row",
      "occurredAt": "2026-10-15T08:32:00.000Z",
      "vaccineId": "uuid",
      "vaccineName": "BCG",
      "dosesPerVial": 10,
      "kind": "received",
      "source": { "type": "stock_request", "id": "uuid" },
      "batchNo": "BCG-2024-001",
      "expiryDate": "2027-03-31",
      "manufacturer": "Serum Institute",
      "vials": { "in": 30, "used": null, "wasted": null, "correction": null },
      "workerId": null,
      "workerName": null,
      "balanceVials": 120
    }
  ],
  "nextCursor": null
}
```

- **`kind` values and what moves the balance:**

| `kind` | Comes from | Effect on `balanceVials` |
|---|---|---|
| `opening` | go-live opening balance | + `vials.in` |
| `received` | a Head-approved stock request round (`receivedVials` of that round) | + `vials.in` |
| `correction` | an approved `stock_correction` (signed) | ± `vials.correction` |
| `used` / `wasted` | a day-end (one row per worker × vaccine) | − `vials.used` / − `vials.wasted` |
| `assigned` / `returned` | store ↔ vaccinator moves | **none**: vials with a worker still count, as in the dashboard's `quantity` |
| `legacy` | old `STOCK_ENTRY` / `ADJUST_STOCK` rows | as they were recorded |

- **Rules:**
  - Fields that don't apply are `null`, not `0`.
  - Figures are in **vials**; the frontend derives doses with `dosesPerVial`.
  - `balanceVials` is the facility's running total for that vaccine **after** the row, oldest → newest across all kinds. The newest row's balance must equal the dashboard's facility quantity for that vaccine (in vials).
  - `assigned` / `returned` rows may be left out entirely if that's simpler. Tell us which you chose.

### Acceptable alternative
Show the facility supervisor the `STOCK_REQUEST_APPROVE` and `APPROVAL_APPROVE` (`stock_correction`) audit rows of their own facility. Also add `batchNo` / `expiryDate` / `manufacturer` per item to `STOCK_REQUEST_APPROVE.details`. We would keep computing the balance in the browser, with the risk that it drifts from the dashboard.

### Please confirm either way
- On `STOCK_REQUEST_APPROVE`, is `receivedVials` the stock added **in that round**, with `fulfilledVials` the running total across rounds?

**Frontend once this lands:**
- Add `getStockRegister()` to `api.js`.
- Replace the audit-log calls in `StockRegister.jsx`.
- Remove the client-side balance.

---

## 2. Offline use: back-dating window and session expiry

**Screen:** Assign Vials and Day End. Facility supervisors must be able to record these with no signal, including opening the app cold while offline. We are building that now. Entries are queued on the phone with their `clientRef` and sent when the signal returns, as agreed. Requests and approvals stay online-only. Two backend rules decide how long a supervisor can stay offline:

- **Q1. The 3-day `occurredOn` limit.** An entry recorded offline and sent more than 3 days later is refused (`400`), and the supervisor has to re-enter it.
  - Can the limit be measured from when the entry was **recorded**? For example, the server could accept `occurredOn` up to 3 days before the time it first sees that `clientRef`.
  - Or can the window be widened for `/assign` and `/day-end`?
  - If neither, we'll warn on the phone when a queued entry is 2 days old.
- **Q2. Session expiry while offline.** A session ends after 8 hours without requests, and queued entries can't be sent until the supervisor signs in again. A phone left offline overnight therefore needs a fresh sign-in before syncing.
  - Is that the intended rule for field use?
  - Or could the idle window be longer for `facility_supervisor`, for example up to the existing 7-day cap?
  - We keep the queue across the sign-in either way, so nothing is lost; it's only an extra step.

**Fallback:** both rules stay as they are. The app shows the reason on any refused entry and keeps it until the supervisor discards it.

---

## 3. A missing CSRF header returns a generic 403

**Seen 2026-10-19:** `POST /api/auth/logout` with a valid session cookie but no `x-csrf-token` header answers `403 {"error":"Internal server error"}`. A wrong token answers with a CSRF message.
- **Why it matters:** the client refreshes `/session` and retries once when a 403 is about CSRF, and it recognises that from the message. After an offline cold start there is no token in memory, so the first queued entry replayed would hit this generic 403 and be treated as a final refusal.
- **What we did:** the client now also refreshes and retries on any 403 to a write sent without a token, so nothing is blocked.
- **Ask:** return a CSRF-specific body for a missing header too (e.g. `{ "error": "Missing CSRF token" }`). `Internal server error` with a 403 also hides real server errors in logs.
