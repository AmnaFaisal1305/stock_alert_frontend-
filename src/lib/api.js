const BASE_URL = import.meta.env.VITE_API_URL

let _csrfToken = null
// Guard: dispatch sst:session-expired at most once per session; reset on fresh login
let _sessionExpiredDispatched = false

export function setCsrfToken(token) {
  _csrfToken = token
  if (token) _sessionExpiredDispatched = false
}

export function getCsrfToken() {
  return _csrfToken
}

async function request(method, path, body, { skipAuthRedirect = false, _csrfRetried = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (method !== 'GET' && _csrfToken) {
    headers['x-csrf-token'] = _csrfToken
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (res.status === 401 && !skipAuthRedirect) {
    sessionStorage.removeItem('sst_user')
    sessionStorage.removeItem('sst_csrf')
    if (!_sessionExpiredDispatched) {
      _sessionExpiredDispatched = true
      window.dispatchEvent(new CustomEvent('sst:session-expired'))
    }
    throw Object.assign(new Error('Session expired'), { status: 401 })
  }

  if (!res.ok) {
    let err
    try {
      err = await res.json()
    } catch {
      err = { error: res.statusText }
    }

    // Another tab logged in → new CSRF token issued. Refresh and retry once.
    if (res.status === 403 && !_csrfRetried &&
        typeof err.error === 'string' && err.error.toLowerCase().includes('csrf')) {
      try {
        const session = await request('GET', '/api/auth/session', undefined, { skipAuthRedirect: true })
        if (session?.csrfToken) setCsrfToken(session.csrfToken)
      } catch { /* session expired — fall through to throw below */ }
      return request(method, path, body, { skipAuthRedirect, _csrfRetried: true })
    }

    const error = new Error(err.error ?? 'Request failed')
    error.status = res.status
    error.fields = err.fields ?? null
    error.body = err
    throw error
  }

  if (res.status === 204) return null
  return res.json()
}

function buildQs(params) {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v != null && v !== '')
  if (!entries.length) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  return request('POST', '/api/auth/login', { email, password }, { skipAuthRedirect: true })
}

export async function logout() {
  return request('POST', '/api/auth/logout', {})
}

export async function forgotPassword(email) {
  return request('POST', '/api/auth/forgot-password', { email })
}

export async function resetPasswordByToken(token, password) {
  return request('POST', `/api/auth/reset-password/${token}`, { password })
}

export async function googleLogin(idToken) {
  return request('POST', '/api/auth/google', { idToken }, { skipAuthRedirect: true })
}

export async function getSession() {
  return request('GET', '/api/auth/session', undefined, { skipAuthRedirect: true })
}

export async function getPushPublicKey() {
  return request('GET', '/api/push/public-key', undefined, { skipAuthRedirect: true })
}

export async function subscribePush(subscription) {
  return request('POST', '/api/push/subscriptions', subscription)
}

export async function unsubscribePush(endpoint) {
  return request('DELETE', '/api/push/subscriptions', { endpoint })
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUsers(params) {
  return request('GET', `/api/users${buildQs(params)}`)
}

export async function createUser(payload) {
  return request('POST', '/api/users', payload)
}

export async function deactivateUser(id) {
  return request('PUT', `/api/users/${id}/deactivate`, {})
}

export async function activateUser(id) {
  return request('PUT', `/api/users/${id}/activate`, {})
}

export async function resetPassword(id, password) {
  return request('PUT', `/api/users/${id}/reset-password`, { password })
}

export async function assignUcSupervisor(userId, ucIds) {
  return request('PUT', `/api/users/${userId}/uc-assignments`, { ucIds })
}

// ── Districts ─────────────────────────────────────────────────────────────────

export async function getDistricts() {
  return request('GET', '/api/districts')
}

export async function createDistrict(payload) {
  return request('POST', '/api/districts', payload)
}

export async function getDistrict(id) {
  return request('GET', `/api/districts/${id}`)
}

export async function updateDistrict(id, name) {
  return request('PUT', `/api/districts/${id}`, { name })
}

export async function deleteDistrict(id) {
  return request('DELETE', `/api/districts/${id}`, {})
}

export async function activateDistrict(id) {
  return request('PUT', `/api/districts/${id}/activate`, {})
}

// ── Towns ─────────────────────────────────────────────────────────────────────

export async function getTowns() {
  return request('GET', '/api/towns')
}

export async function createTown(payload) {
  return request('POST', '/api/towns', payload)
}

export async function updateTown(id, name) {
  return request('PUT', `/api/towns/${id}`, { name })
}

export async function deleteTown(id) {
  return request('DELETE', `/api/towns/${id}`, {})
}

export async function activateTown(id) {
  return request('PUT', `/api/towns/${id}/activate`, {})
}

// ── Union Councils ────────────────────────────────────────────────────────────

export async function getUnionCouncils(params) {
  return request('GET', `/api/union-councils${buildQs(params)}`)
}

export async function createUnionCouncil(payload) {
  return request('POST', '/api/union-councils', payload)
}

export async function updateUnionCouncil(id, name) {
  return request('PUT', `/api/union-councils/${id}`, { name })
}

export async function deleteUnionCouncil(id) {
  return request('DELETE', `/api/union-councils/${id}`, {})
}

export async function activateUnionCouncil(id) {
  return request('PUT', `/api/union-councils/${id}/activate`, {})
}

// ── Facilities ────────────────────────────────────────────────────────────────

export async function getFacilities(params) {
  return request('GET', `/api/facilities${buildQs(params)}`)
}

export async function createFacility(payload) {
  return request('POST', '/api/facilities', payload)
}

export async function getFacility(id) {
  return request('GET', `/api/facilities/${id}`)
}

export async function updateFacility(id, name) {
  return request('PUT', `/api/facilities/${id}`, { name })
}

export async function deleteFacility(id) {
  return request('DELETE', `/api/facilities/${id}`, {})
}

export async function activateFacility(id) {
  return request('PUT', `/api/facilities/${id}/activate`, {})
}

// ── Vaccines ──────────────────────────────────────────────────────────────────

export async function getVaccines() {
  return request('GET', '/api/vaccines')
}

export async function createVaccine(payload) {
  return request('POST', '/api/vaccines', payload)
}

export async function updateVaccine(id, payload) {
  return request('PUT', `/api/vaccines/${id}`, payload)
}

export async function deleteVaccine(id) {
  return request('DELETE', `/api/vaccines/${id}`, {})
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(params) {
  return request('GET', `/api/dashboard${buildQs(params)}`)
}

// ── Stock entries ─────────────────────────────────────────────────────────────

export async function createStockEntry(payload) {
  return request('POST', '/api/stock-entries', payload)
}

export async function assignVials(payload) {
  return request('POST', '/api/stock-entries/assign', payload)
}

export async function recordDayEnd(payload) {
  return request('POST', '/api/stock-entries/day-end', payload)
}

export async function getHoldings() {
  return request('GET', '/api/stock-entries/holdings')
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export async function getApprovals(status) {
  return request('GET', `/api/approvals${buildQs(status ? { status } : {})}`)
}

export async function createApproval(payload) {
  return request('POST', '/api/approvals', payload)
}

export async function approveApproval(id) {
  return request('PUT', `/api/approvals/${id}/approve`, {})
}

export async function rejectApproval(id, decisionReason) {
  return request('PUT', `/api/approvals/${id}/reject`, { decisionReason })
}

export async function cancelApproval(id) {
  return request('PUT', `/api/approvals/${id}/cancel`, {})
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getNotifications(params) {
  return request('GET', `/api/notifications${buildQs(params)}`)
}

export async function getUnreadCount() {
  return request('GET', '/api/notifications/unread-count')
}

export async function markNotificationRead(id) {
  return request('PUT', `/api/notifications/${id}/read`, {})
}

export async function markAllRead() {
  return request('PUT', '/api/notifications/read-all', {})
}

// ── Stock requests ────────────────────────────────────────────────────────────

export async function getStockRequests(status) {
  return request('GET', `/api/stock-requests${buildQs(status ? { status } : {})}`)
}

export async function getStockRequest(id) {
  return request('GET', `/api/stock-requests/${id}`)
}

export async function createStockRequest(payload) {
  return request('POST', '/api/stock-requests', payload)
}

export async function recordSent(id, payload) {
  return request('PUT', `/api/stock-requests/${id}/sent`, payload)
}

export async function recordReceived(id, payload) {
  return request('PUT', `/api/stock-requests/${id}/received`, payload)
}

export async function approveStockRequest(id, note) {
  return request('PUT', `/api/stock-requests/${id}/approve`, note ? { note } : {})
}

export async function cancelStockRequest(id, reason) {
  return request('PUT', `/api/stock-requests/${id}/cancel`, reason ? { reason } : {})
}

export async function declineStockRequest(id, reason) {
  return request('PUT', `/api/stock-requests/${id}/decline`, { reason })
}

// ── Audit log ─────────────────────────────────────────────────────────────────

// params: feed, limit, before (previous nextCursor), counts, and filters
// actorRole, actorId, action, facilityId, entityId, from, to (Karachi days, inclusive).
export async function getAuditLog(params = {}) {
  return request('GET', `/api/audit-log${buildQs(params)}`)
}

// ── Analytics (Sprint 6) ──────────────────────────────────────────────────────

export async function getAnalytics({ from, to } = {}) {
  return request('GET', `/api/analytics${buildQs({ from, to })}`)
}

// ── EPI Form B monthly sheet (Round 33) ───────────────────────────────────────

export async function getSheet(facilityId, month) {
  return request('GET', `/api/sheets/${facilityId}${buildQs({ month })}`)
}

export async function saveSheet(facilityId, { month, rows, signatures }) {
  return request('PUT', `/api/sheets/${facilityId}`, { month, rows, signatures })
}
