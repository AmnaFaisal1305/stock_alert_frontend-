# Backend Fixes — Small Pending Items

**Project:** Smart Stock Alert  
**Written for:** Backend developer  
**Frontend repo branch:** `redesign/ui-clinical-material`

These are small, isolated backend issues found during frontend development. Each one has a clear expected behaviour and a known symptom.

---

## 1. `GET /api/auth/session` — cross-tab session restore

**Symptom:** Opening the app in a new browser tab shows the login page even though the user is already logged in in another tab. After logging in, the new tab redirects to the dashboard correctly — the session just isn't being picked up automatically.

**Root cause:** The frontend stores auth state in `sessionStorage`, which is isolated per browser tab. On a new tab, `sessionStorage` is empty, so the frontend immediately calls `GET /api/auth/session` (with `credentials: 'include'`) to restore the session from the existing HttpOnly cookie. If this endpoint returns `401`, the user is sent to the login page.

**What the frontend expects:**

```
GET /api/auth/session
Cookie: <existing session cookie>

→ 200 { user: { id, name, email, role, ... }, csrfToken: "<fresh token>" }
→ 401 if no valid session cookie
```

**Requirements:**
- Must return a **fresh `csrfToken`** alongside `user` — the frontend needs it to make any mutation requests from the restored session.
- Must accept the session cookie sent via `credentials: 'include'` from any same-origin tab (not just the tab that originally logged in).
- `401` is the correct response when the cookie is absent or expired — that's handled correctly.

**Note:** The frontend has already added cross-tab broadcast logic (`localStorage` storage events) so that tabs that are already open when another tab logs in/out will sync immediately. The `GET /api/auth/session` fix is specifically needed for **new tabs opened after login**.

---

## 2. CSRF token rotation on session restore

**Symptom:** Related to fix #1. If `GET /api/auth/session` returns `{ user }` without a `csrfToken`, all subsequent mutation requests from the restored session will fail with `403 Forbidden` (missing/invalid CSRF token).

**What to check:** Ensure the session restore endpoint issues (or re-issues) the CSRF token — same as the login endpoint does — and returns it in the response body.

---

## 3. `POST /api/auth/logout` — should invalidate the session cookie server-side

**Symptom:** If a user logs out and then someone else logs in on the same device, the old cookie (if not server-side invalidated) might still be valid. Not a confirmed bug, but worth verifying.

**What to check:** `POST /api/auth/logout` should destroy the server-side session and clear the cookie (`Set-Cookie: session=; Max-Age=0; ...`). If logout only clears the frontend state but the cookie stays valid on the server, the old cookie can still authenticate `GET /api/auth/session` calls.

---

## 4. Session expiry causing unexpected automatic logout

**Symptom:** The user is actively using the app and gets sent back to the login page without clicking Logout. This happens mid-session — they haven't been idle or closed any tab.

**How the frontend handles it:** Any API call that returns `401` dispatches an internal `sst:session-expired` event, which clears local auth state and redirects to `/login`. This is correct and intentional — the frontend should log out on a 401. The issue is that the backend is returning 401 on a valid in-use session.

**Likely causes to check on the backend:**

1. **Session TTL is too short** — If the session cookie or server-side session expires after e.g. 30 minutes of inactivity, the dashboard's background polling (runs every 30s) will hit a 401 as soon as the TTL is exceeded, immediately logging the user out. Extend the TTL or implement a rolling session (reset TTL on each request).

2. **Session is not being rolled / renewed** — If the session TTL is absolute (not rolling), users doing continuous work will still be logged out after the TTL regardless of activity. Sessions should renew on each authenticated request.

3. **Race between two tabs** — Before the cross-tab fix (#1 above), opening a second tab would call `GET /api/auth/session` which may have inadvertently invalidated or replaced the session token for the first tab, causing the first tab's next API call to fail with 401.

**What to check:** Confirm the session TTL, whether it rolls on activity, and whether `GET /api/auth/session` creates a new session or reuses the existing one.

---

## 5. Role-based route authorization

**Symptom:** The frontend has no client-side guards preventing a user from navigating directly to another role's route (e.g. a `district_supervisor` typing `/super-admin/dashboard` in the URL bar). The UI won't show navigation links for that role, but if the backend returns data for any authenticated user regardless of role, the screen will render.

**What the backend must do:** Every data-fetching endpoint must verify the caller's role and return `403 Forbidden` if the role is not authorized to access that resource. For example, `GET /api/dashboard` for super-admin data must reject a `facility_worker` token.

**Priority:** High — this is a security boundary, not just a UX issue.

---

## 6. Push notification delivery

**Symptom:** A user enables push notifications (browser asks for permission, frontend registers the push subscription with the backend), but no push notifications ever arrive when a stock alert is triggered.

**How the frontend works:** `enablePush()` in `src/lib/push.js` calls `navigator.serviceWorker.pushManager.subscribe(...)` and then sends the resulting subscription object (endpoint, keys) to the backend via `POST /api/push/subscribe`. The frontend's role ends there — it cannot deliver pushes itself.

**What the backend must do:** When a stock event occurs (e.g. a vaccine drops to critical), the backend must:
1. Look up all push subscription records for users who should be notified (based on role/facility/district scoping).
2. Call the Web Push API (e.g. using the `web-push` npm library) with the stored subscription and the notification payload.

Without this, push subscriptions are stored but never used.

**Priority:** High — push notifications are a core product feature.

---

## 7. Per-device push subscription storage

**Symptom:** A user logs out on device A (which calls `POST /api/push/unsubscribe`) and also loses push notifications on device B, even though device B is still logged in.

**Root cause:** If the backend stores push subscriptions per-user (one record per `userId`) rather than per-device (one record per `endpoint`), unsubscribing from device A deletes the subscription for all devices.

**What the backend must do:** Store push subscriptions keyed by the subscription `endpoint` URL (which is device-unique), not just by `userId`. Unsubscribing should only remove the subscription matching the exact endpoint passed by the client.

**Priority:** Medium — affects multi-device users.

---

## Summary

| # | Endpoint / Area | Issue | Priority |
|---|---|---|---|
| 1 | `GET /api/auth/session` | Returns 401 for valid cookies in new tabs | High |
| 2 | `GET /api/auth/session` | Response missing `csrfToken` field | High |
| 3 | `POST /api/auth/logout` | Session cookie not invalidated server-side | Medium |
| 4 | Session management | Short/absolute TTL causes unexpected mid-session logout | High |
| 5 | All data endpoints | No role-based authorization — cross-role access not blocked | High |
| 6 | Push delivery | Backend never calls Web Push API to deliver notifications | High |
| 7 | Push subscription storage | Subscriptions stored per-user, not per-device endpoint | Medium |
