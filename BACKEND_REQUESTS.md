# Backend Requests — Frontend → Backend

Updated 2026-10-30 · Frontend branch `main`

The one list of what the frontend still needs from the backend. **Everything up to Round 43 is adopted on our side. Two requests are open (§1, §2), both for the Analytics screen.** The same-site proxy (`vercel.json` → `/api/*`) is live on https://smart-stock-alert.vercel.app.
- Round 43 delivered the Stock Register `returned` rows, live and verified on production (2026-10-20): `GET /api/stock-register?kind=returned` returns 200 with 32 rows at RHC Latifabad, every row's `vials` includes `returned`, and the unfiltered `total` rose 95 → 127. The frontend Returned chip/column render them; the dev-only dummy row has been removed.

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).

---

## 1. Analytics: vials on hand at the start and end of the period (`GET /api/analytics`)

**Why.** The Analytics Stock Summary is getting a fifth card, Stock Correction (Add / Delete), so that its figures reconcile:

`stock at start of period + received + correction add − correction delete − used − wasted = stock at end of period`

The pilot starts from zero stock (no opening balance is ever loaded), so "stock at start" is only the stock carried in from before `from`: zero for a period starting at go-live, non-zero for any later period.

Checked against production on 2026-10-30 (the Observer, default period 2025-11-01 → 2026-10-30): 0 + 1361 + 4 − 9 − 954 − 103 = **299**, which equals the current `remaining` total. It balances only because the default period covers all data and ends today. The frontend can't make it balance for any other period:
- `remaining` is the **current** balance and ignores `to`, so a period that ends in the past has no closing figure.
- `movement` holds only entries inside the period, so a period that starts after the first entry has no figure for the stock already on hand.

**Ask.** Add a `balances` array, combined with the role scope and the Round 36 location filters, like the other sections:

```json
"balances": [{ "facilityId": "uuid", "facilityName": "string", "vaccineId": "uuid", "vaccineName": "string",
               "startVials": 0, "endVials": 0 }]
```

- `startVials`: vials on hand (store + vaccinators) at the start of `from` (Pakistan date), i.e. the **facility total** of your stock-math table, in vials, over entries with `occurredOn` **before** `from`:
  `opening + received + returned + adjustment_increase − adjustment_decrease − used − wasted`
  - `returned` here is the legacy store-side entry type only. **Do not add `worker_returned`** (the day-end return that `movement.returned` reports): like `assigned`, it moves vials inside the facility and doesn't change its total. Adding it would inflate every balance (167 vials on production today).
  - This is Form B column B's sum (in vials instead of doses), so the two must agree for a period starting on the 1st of a month.
- `endVials`: the same sum over entries with `occurredOn` **up to and including** `to`. When `to` is today it must equal `storeVials + heldVials` from `remaining`.
- Corrections count on their `occurredOn`, the same date `movement` buckets them by, so `startVials + movement totals = endVials` for every vaccine.
- Entries can be back-dated up to 7 days, so a past period's `startVials` / `endVials` may still change for up to a week. That's expected; no snapshotting needed.

**Go-live: no opening balance.** The client confirmed (2026-10-30) that the pilot starts from zero stock; all stock enters through stock requests. Please don't run the go-live `opening` script, or have it load nothing. The frontend no longer reads `movement.opening`.

## 2. Analytics: `vaccineId` filter (`GET /api/analytics`)

**Why.** Analytics is getting a Vaccine filter, and clicking a vaccine in any chart will filter the whole page to it. `movement` and `remaining` already carry `vaccineId`, so the Stock Summary tab can be filtered on our side. `requests` and `pendingApprovals` have no vaccine, so the Stock Requests and Approvals tabs can't be.

**Ask.** An optional `vaccineId` (UUID) on `GET /api/analytics`, combined with the role scope and the location filters, and only narrowing them:
- `movement`, `remaining`, `balances`: that vaccine's rows only.
- `requests`: count only requests with an item for that vaccine.
- `pendingApprovals`: count only stock corrections for that vaccine. Threshold changes are for a vaccine too, so count those as well.
- An unknown or deleted `vaccineId` gives empty arrays, not `400`, so a stale URL still loads the page.

Until §2 ships, the frontend filters the Stock Summary tab on its side. The Requests and Approvals tabs show "This tab isn't filtered by vaccine" while a vaccine is selected.
