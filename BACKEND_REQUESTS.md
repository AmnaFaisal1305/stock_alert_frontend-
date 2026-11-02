# Backend Requests — Frontend → Backend

Updated 2026-11-02 · Frontend branch `main`

The one list of what the frontend still needs from the backend. **Everything up to Round 46 is adopted on our side. Nothing is open.** The same-site proxy (`vercel.json` → `/api/*`) is live on https://smart-stock-alert.vercel.app.
- Round 44 delivered §1 (`balances`) and §2 (`vaccineId`) on `GET /api/analytics`; Round 46 delivered §3 (`blockedBy`). The frontend uses all three (2026-11-02). The old request text is in this file's git history.
- Round 45 (`PUT /api/users/:id`, optional `lastName`) is adopted: Super Admin › Users has an Edit action.

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).

---

## Note for the backend: per-item email links (answer to your Round 42 offer)

The frontend now has two role-agnostic routes that open one item on the signed-in user's own screen:
- `/stock-requests/:id`
- `/approvals/:id`

A signed-out user is sent to the login page and lands on the item after signing in. A role without that screen (District Supervisor, Super Admin, Observer) lands on its dashboard. Please put the item's id in the email buttons with these patterns (`FRONTEND_URL` + path). Pushes already carry `entityId`; the app now opens that item too.
