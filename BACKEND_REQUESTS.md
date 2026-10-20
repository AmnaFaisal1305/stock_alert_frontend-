# Backend Requests — Frontend → Backend

Updated 2026-10-20 · Frontend branch `main`

The one list of what the frontend still needs from the backend. **Nothing is open.**
- Round 43 delivered the Stock Register `returned` rows and is **live and verified** on production (2026-10-20): `GET /api/stock-register?kind=returned` returns `200` with 32 rows at RHC Latifabad, every row's `vials` now includes `returned`, and the unfiltered `total` rose 95 → 127 (the +32 returned rows). The frontend Returned chip/column render them; the dev-only dummy row has been removed. (An earlier 400 was a pre-deploy state that has since propagated.)
- Round 40 answered the Stock Register (`kind`, `total`), the closing-row items, the wording and both questions.
- The IP check passed (the rewrite passes the real client IP), and the backend approved the same-site proxy. Going live is on our side: see `HANDOFF.md`.

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).
