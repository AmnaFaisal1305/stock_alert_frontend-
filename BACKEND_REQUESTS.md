# Backend Requests — Frontend → Backend

Updated 2026-11-02 · Frontend branch `main`

The one list of what the frontend still needs from the backend. Only open items are listed; delivered ones are removed (they're in this file's git history). Everything up to **Round 47** is adopted on the frontend.

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).

---

## 1. Stock correction of an emptied batch (Round 47 follow-up)

A `stock_correction` now needs a `batchId`, and the form takes it from `GET /api/stock-entries/store-batches`, which lists only batches with vials left. So when a physical count finds vials of a batch the store shows as 0 (say a miscount on Day End), the supervisor can't pick it and can't correct it upward.

Could `store-batches` take an optional `?includeEmpty=true` that also returns the facility's batches at 0 that haven't expired (or expired within the last few months)? The assign picker keeps the current list; only the correction form would send it. If you'd rather keep the endpoint as it is, tell us how a supervisor should record found vials of an emptied batch.

---

## 2. Per-item email links (answer to your Round 42 offer)

The frontend has two role-agnostic routes that open one item on the signed-in user's own screen:
- `/stock-requests/:id`
- `/approvals/:id`

A signed-out user is sent to the login page and lands on the item after signing in. A role without that screen (District Supervisor, Super Admin, Observer) lands on its dashboard. Please put the item's id in the email buttons with these patterns (`FRONTEND_URL` + path; your `EMAIL_SCREENS` map in `api/_lib/notify.js`). Pushes already carry `entityId`; the app opens that item too.
