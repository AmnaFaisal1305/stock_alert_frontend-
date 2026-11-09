# Backend Requests — Frontend → Backend

Updated 2026-11-09 · Frontend branch `main`

The one list of what the frontend still needs from the backend. Only open items are listed; delivered ones are removed (they're in this file's git history). Everything up to **Round 48** is adopted on the frontend. **Nothing is open.** The `dosesPerVial` request was closed on 2026-11-09 (pilot catalog set to the client's values). The backend's pending list of 2026-11-09 (Rounds 44–48, hidden offline mode and Form B, pilot catalog) is all done on the frontend, and push works on a real phone; the backend was told the same day. No `GET /api/approvals/:id` is needed: the frontend finds an approval in `GET /api/approvals`.

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).
