const BASE_URL = import.meta.env.VITE_API_URL

let _csrfToken = null

export function setCsrfToken(token) {
  _csrfToken = token
}

export function getCsrfToken() {
  return _csrfToken
}

async function request(method, path, body, { skipAuthRedirect = false } = {}) {
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
    window.location.replace('/login')
    throw Object.assign(new Error('Session expired'), { status: 401 })
  }

  if (!res.ok) {
    let err
    try {
      err = await res.json()
    } catch {
      err = { error: res.statusText }
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

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUsers() {
  return request('GET', '/api/users')
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

// ── Facilities ────────────────────────────────────────────────────────────────

export async function getFacilities() {
  return request('GET', '/api/facilities')
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

export async function updateVaccine(id, name) {
  return request('PUT', `/api/vaccines/${id}`, { name })
}

export async function deleteVaccine(id) {
  return request('DELETE', `/api/vaccines/${id}`, {})
}

export async function updateVaccineStock(id, quantity) {
  return request('PUT', `/api/vaccines/${id}/stock`, { quantity })
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard() {
  return request('GET', '/api/dashboard')
}

// ── Stock entries ─────────────────────────────────────────────────────────────

export async function createStockEntry(payload) {
  return request('POST', '/api/stock-entries', payload)
}

// ── Thresholds ────────────────────────────────────────────────────────────────

export async function updateThreshold(id, minQuantity) {
  return request('PUT', `/api/thresholds/${id}`, { minQuantity })
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export async function getAuditLog({ limit } = {}) {
  const qs = limit != null ? `?limit=${limit}` : ''
  return request('GET', `/api/audit-log${qs}`)
}
