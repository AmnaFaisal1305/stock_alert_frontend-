import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { disablePushForLogout } from '../lib/push'

const AuthContext = createContext(null)

const ROLE_DEFAULTS = {
  super_admin:         '/super-admin/dashboard',
  district_supervisor: '/district/dashboard',
  uc_supervisor:       '/uc/dashboard',
  facility_supervisor: '/facility/dashboard',
  facility_worker:     '/worker/stock-entry',
  facility_head:       '/head/dashboard',
  observer:            '/super-admin/dashboard',
}

const SESSION_KEY = 'sst_user'
const CSRF_KEY    = 'sst_csrf'

function loadSession() {
  try {
    const raw  = sessionStorage.getItem(SESSION_KEY)
    const csrf = sessionStorage.getItem(CSRF_KEY)
    if (raw && csrf) return { user: JSON.parse(raw), csrf }
  } catch {}
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const session = loadSession()
    if (session?.csrf) api.setCsrfToken(session.csrf)
    return session?.user ?? null
  })

  // bootstrapping: true while we're attempting a cookie-based session restore on PWA launch
  const [bootstrapping, setBootstrapping] = useState(() => !loadSession())

  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  // On PWA relaunch: sessionStorage is empty but the cookie may still be valid
  useEffect(() => {
    if (!bootstrapping) return
    api.getSession()
      .then(({ user: u, csrfToken }) => {
        api.setCsrfToken(csrfToken)
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
        sessionStorage.setItem(CSRF_KEY, csrfToken)
        setUser(u)
      })
      .catch(() => {
        // no valid session — stay on login
      })
      .finally(() => setBootstrapping(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback((userData, csrfToken) => {
    queryClient.clear()
    api.setCsrfToken(csrfToken)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    sessionStorage.setItem(CSRF_KEY, csrfToken)
    // reset PWA prompt dismissal so prompts appear for each new login
    sessionStorage.removeItem('sst_notif_card')
    sessionStorage.removeItem('sst_install_card')
    setUser(userData)
  }, [queryClient])

  const logout = useCallback(async () => {
    await disablePushForLogout()
    try {
      await api.logout()
    } catch {
      // ignore — clear local state regardless
    }
    queryClient.clear()
    api.setCsrfToken(null)
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(CSRF_KEY)
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate, queryClient])

  const defaultRoute = user ? (ROLE_DEFAULTS[user.role] ?? '/login') : '/login'

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, defaultRoute, bootstrapping }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
