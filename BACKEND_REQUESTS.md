# Backend Requests — Frontend → Backend

Updated 2026-10-18 · Frontend branch `main`

The one list of what the frontend still needs from the backend. **Everything up to Round 40 is adopted on our side, and nothing is open.**
- Round 40 answered the Stock Register (`kind`, `total`), the closing-row items, the wording and both questions.
- The IP check passed (the rewrite passes the real client IP), and the backend approved the same-site proxy. Going live is on our side: see `HANDOFF.md`.

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).
