# Stock Register — Backend Request

Raised 2026-10-19 · Frontend branch `main`

---

## What we need

A dedicated endpoint `GET /api/stock-register` that returns all vaccine movements for the caller's facility, with the running per-vaccine balance already computed server-side.

**Why a new endpoint instead of the audit log:**
- The current implementation makes three separate audit-log calls (`STOCK_ENTRY`, `ADJUST_STOCK`, `STOCK_DAY_END`) and merges them client-side.
- The balance it computes is incomplete: stock received via stock requests (`STOCK_REQUEST_RECEIVED`, `STOCK_ASSIGN`) is excluded, so a facility restocked through a request can show a negative balance that contradicts the dashboard number.
- The balance must match the live stock figure on the dashboard — that calculation belongs on the backend.

---

## Proposed contract

**Endpoint:** `GET /api/stock-register`
**Auth:** session cookie + CSRF (read-only, so CSRF is optional — your call)
**Scope:** automatically restricted to the caller's facility (`facility_supervisor`, `facility_head`)

### Optional query parameters

| Parameter   | Type       | Description |
|-------------|------------|-------------|
| `vaccineId` | UUID       | Restrict rows to one vaccine |
| `type`      | string     | Restrict by display entry type: `Received`, `Record`, or `Stock Correction` |
| `from`      | YYYY-MM-DD | Earliest row date (Karachi day, inclusive) |
| `to`        | YYYY-MM-DD | Latest row date (Karachi day, inclusive) |

All parameters are optional and additive. Omitting all returns the full history.

### Response

```json
{
  "entries": [
    {
      "id":           "uuid of source record",
      "date":         "2026-10-15T08:32:00.000Z",
      "vaccineId":    "uuid",
      "vaccineName":  "BCG",
      "entryType":    "Received",
      "manufacturer": "Serum Institute",
      "batchNo":      "BCG-2024-001",
      "dosesPerVial": 10,
      "expiryDate":   "2027-03-31",
      "received":     100,
      "used":         null,
      "returned":     null,
      "wasted":       null,
      "correction":   null,
      "balance":      350
    }
  ]
}
```

Rows are sorted **newest → oldest**.

---

## Field rules

### `entryType` mapping

| Source action | Internal sub-type | `entryType` |
|---|---|---|
| `STOCK_ENTRY` | `received`, `opening` | `"Received"` |
| `STOCK_ENTRY` | `used`, `returned`, `wasted` | `"Record"` |
| `STOCK_DAY_END` | _(one row per vaccine per session)_ | `"Record"` |
| `ADJUST_STOCK` | _(any)_ | `"Stock Correction"` |
| `STOCK_REQUEST_RECEIVED` | _(any)_ | `"Received"` |
| `STOCK_ASSIGN` | _(any)_ | `"Received"` |

### Quantity fields

- `received`: doses added to stock. Populated for `Received` rows. `null` for all others.
- `used`: doses consumed. Populated for `Record` rows where usage was recorded.
- `returned`: doses returned to cold chain. Populated for `Record` rows where returns occurred.
- `wasted`: doses wasted. Populated for `Record` rows where wastage occurred.
- `correction`: signed integer (e.g. `+20` or `-15`). Populated only for `Stock Correction` rows. A positive value means stock was added; negative means stock was removed.
- Any field that does not apply to a row must be `null`, not `0` and not omitted.
- For `STOCK_DAY_END` rows, `used` / `returned` / `wasted` must be in **doses** (vials × `dosesPerVial`), not vials.

### `balance`

- The per-vaccine running balance at the exact moment of this row.
- Computed oldest → newest across **all** movement sources: `STOCK_ENTRY`, `ADJUST_STOCK`, `STOCK_DAY_END`, `STOCK_REQUEST_RECEIVED`, `STOCK_ASSIGN`.
- The balance on the **most recent row** for each vaccine must equal the current live stock displayed on the facility dashboard. If they diverge, the dashboard number wins.
- Balance can be negative (e.g. day-end recorded before an opening entry was corrected).

---

## What the frontend will do once this lands

1. Add `getStockRegister(params)` to `src/lib/api.js`.
2. Replace the three `getAuditLog` calls in `StockRegister.jsx` with a single `getStockRegister` call.
3. Remove the client-side balance computation.
4. Item #7 in `BACKEND_REQUESTS.md` (multi-action audit-log filter) can be skipped.

---

## Priority

**High / Blocking** — the register currently shows an incorrect balance for any facility that has received stock through a stock request.
