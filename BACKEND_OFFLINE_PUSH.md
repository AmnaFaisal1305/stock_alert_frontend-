# Backend Questions: Offline Queue and Push — Frontend → Backend

Written 2026-10-18 · Frontend branch `main`

The general list of backend requests is `BACKEND_REQUESTS.md`. This file covers only the offline queue (Assign Vials, Day End) and push notifications, which we tested together.

## What we found
- **Push is configured in production** (`GET /api/push/public-key` returns a key). Real delivery to a device has not been seen by either side.
- **The offline queue assumes things about your responses** that we can't confirm from the docs. Please answer from the backend code.

## What we changed on our side (no action needed from you)
- A queued entry that the server refuses is marked failed, shown to the user ("N not sent" with your error message) and never retried.
- A `409` is no longer resent with a new `clientRef` (see Q1).
- An entry is also queued when the request gets no response at all (weak signal), not only when the browser reports offline. The replay reuses the same `clientRef`.
- Each queued entry belongs to the user who made it; another user on the same phone never replays it.

**Status (2026-10-19): all answered in Round 36 (`FRONTEND_HANDOFF.md`) and adopted.** In short:
- Q1 `409` = the `clientRef` was used at another facility. We mark it failed with that message rather than resending under a new ref.
- Q2 all refusals are `400`.
- Q3 `url` is the app root, so we route from `type`.
- Q4 dead subscriptions are deleted.
- R1 is built, as "Send test" in the notification panel.

Nothing open here; real-device delivery is still untested.

| # | Item | Priority | Status |
|---|---|---|---|
| Q1 | What `409` means on `assign` / `day-end` | High | Answered |
| Q2 | `400` or `422` for refused entries, and the body shape | High | Answered |
| Q3 | Exact push payload and `url` values | High | Answered |
| Q4 | Dead push subscriptions | Medium | Answered |
| R1 | `POST /api/push/test` | Medium | Built, adopted |

---

## Q1. What does `409` mean on `POST /api/stock-entries/assign` and `/day-end`?
- When is it returned (same `clientRef` with a different payload? a concurrent request? a stale balance?)?
- Does replaying the **same `clientRef` with the same payload** return the original rows with `200`/`201` (our assumption), never `409`?
- **Why it matters:** the queue used to resend a `409` entry with a new `clientRef`. If your `409` means "already recorded", that doubles a stock movement. We now mark it failed and show it to the user instead. Once you confirm, we can retry safely where that is correct.

## Q2. Which status do refused entries get: `400` or `422`?
- Cases: not enough vials, day-end sums that don't balance, `occurredOn` older than 3 days or in the future, inactive worker.
- Please give the status and the JSON body shape for each (we read `error`, and for stock cases `vaccineId`, `available`, `remaining`).
- We treat every `4xx` except `401`, `408` and `429` as final (the user is told the entry was not recorded). Tell us if any `4xx` should be retried.

## Q3. Exact push message payload
The service worker reads these fields from the push JSON:
```json
{ "title": "…", "body": "…", "url": "/head/approvals", "entityType": "…", "entityId": "…" }
```
- Is that what you send? If not, give us the real field names.
- `url` must be an **in-app path** (we open it as is). Please list the `url` you send for each notification type (critical stock, approval waiting, request sent / received / approved / declined, …) and make sure each one is a route the **recipient's role** can open. Opening another role's route redirects the user to their dashboard.
- Payload size and TTL / urgency you set.

## Q4. Dead subscriptions
- When the push service answers `404` or `410`, do you delete that subscription?
- Do you keep one row per `endpoint`, so re-subscribing never duplicates? We unsubscribe and subscribe again each time alerts are turned on.

## R1. Test push to my own device
- **Screen:** notification panel › "Turn on alerts" (all roles except worker).
- **Problem today:** delivery to a real phone, especially an iPhone with the app on the home screen, can't be checked without waiting for a real event.
- **Proposed contract:** `POST /api/push/test`, any signed-in role, CSRF required, rate-limited (e.g. 3 per hour). Sends `{ title: "Test alert", body: "Push is working", url: "/" }` to the caller's own subscriptions. `200 { sent: n }`, `404` if the caller has no subscription, `503` if push is not configured.
- **Fallback:** none needed; we wait for a real event.
