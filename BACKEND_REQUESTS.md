# Backend Requests — Frontend → Backend

Updated 2026-10-19 · Frontend branch `main`

The one list of what the frontend still needs from the backend. **Everything up to Round 39 is adopted on our side, and nothing is open.**
- Round 38 answered the Stock Register and offline questions.
- Round 39 answered the CSRF one: a missing or wrong token is `403 { code: "CSRF_INVALID" }`.

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).
