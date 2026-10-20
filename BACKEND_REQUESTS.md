# Backend Requests — Frontend → Backend

Updated 2026-10-20 · Frontend branch `main`

The one list of what the frontend still needs from the backend. **Everything up to Round 43 is adopted on our side, and nothing is open.** The same-site proxy (`vercel.json` → `/api/*`) is live on https://smart-stock-alert.vercel.app.
- Round 43 delivered the Stock Register `returned` rows, live and verified on production (2026-10-20): `GET /api/stock-register?kind=returned` returns 200 with 32 rows at RHC Latifabad, every row's `vials` includes `returned`, and the unfiltered `total` rose 95 → 127. The frontend Returned chip/column render them; the dev-only dummy row has been removed.

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).
