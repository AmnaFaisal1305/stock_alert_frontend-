const BASE_URL = import.meta.env.VITE_API_URL

let _csrfToken = null

export function setCsrfToken(token) {
  _csrfToken = token
}

export function getCsrfToken() {
  return _csrfToken
}

async function request(method, path, body) {
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

  if (res.status === 401) {
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
  return request('POST', '/api/auth/login', { email, password })
}

export async function logout() {
  return request('POST', '/api/auth/logout', {})
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

export async function createDistrict(name) {
  return request('POST', '/api/districts', { name })
}

// ── Facilities ────────────────────────────────────────────────────────────────

export async function getFacilities() {
  return request('GET', '/api/facilities')
}

export async function createFacility(payload) {
  return request('POST', '/api/facilities', payload)
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard() {
  return request('GET', '/api/dashboard')
}

// ── Stock entries ─────────────────────────────────────────────────────────────

export async function createStockEntry(vaccineId, quantity) {
  return request('POST', '/api/stock-entries', { vaccineId, quantity })
}

// ── Thresholds ────────────────────────────────────────────────────────────────

export async function updateThreshold(id, minQuantity) {
  return request('PUT', `/api/thresholds/${id}`, { minQuantity })
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export async function getAuditLog() {
  return request('GET', '/api/audit-log')
}
