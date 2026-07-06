import { createContext, useContext, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'

const AuthContext = createContext(null)

const ROLE_DEFAULTS = {
  super_admin:         '/super-admin/dashboard',
  district_supervisor: '/district/dashboard',
  facility_supervisor: '/facility/dashboard',
  facility_worker:     '/worker/stock-entry',
}

const SESSION_KEY = 'sst_user'
const CSRF_KEY    = 'sst_csrf'

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const csrf = sessionStorage.getItem(CSRF_KEY)
    if (raw && csrf) {
      return { user: JSON.parse(raw), csrf }
    }
  } catch {}
  return null
}

export function AuthProvider({ children }) {
  const saved = loadSession()
  const [user, setUser] = useState(saved?.user ?? null)
  const navigate = useNavigate()

  if (saved?.csrf) api.setCsrfToken(saved.csrf)

  const login = useCallback((userData, csrfToken) => {
    api.setCsrfToken(csrfToken)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    sessionStorage.setItem(CSRF_KEY, csrfToken)
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // ignore — clear local state regardless
    }
    api.setCsrfToken(null)
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(CSRF_KEY)
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const defaultRoute = user ? (ROLE_DEFAULTS[user.role] ?? '/login') : '/login'

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, defaultRoute }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
