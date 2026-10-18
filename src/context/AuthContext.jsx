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
// Profile only (the session cookie is HttpOnly): lets a cold start with no signal reopen the app.
const OFFLINE_USER_KEY = 'sst_offline_user'

function rememberUser(u) {
  try { localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(u)) } catch {}
}
function forgetUser() {
  try { localStorage.removeItem(OFFLINE_USER_KEY) } catch {}
}
// A sign-out made with no signal never reached the server, so the cookie still works; finish it
// on the next start instead of silently restoring that session.
const LOGOUT_PENDING_KEY = 'sst_logout_pending'

function rememberedUser() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_USER_KEY)) } catch { return null }
}

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
    if (localStorage.getItem(LOGOUT_PENDING_KEY)) {
      api.logout()
        .then(() => localStorage.removeItem(LOGOUT_PENDING_KEY))
        .catch((err) => { if (err?.status === 401) localStorage.removeItem(LOGOUT_PENDING_KEY) }) // still offline: retry next start
        .finally(() => setBootstrapping(false))
      return
    }
    api.getSession()
      .then(({ user: u, csrfToken }) => {
        api.setCsrfToken(csrfToken)
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
        sessionStorage.setItem(CSRF_KEY, csrfToken)
        localStorage.setItem('sst_auth_signal', '1')
        rememberUser(u)
        setUser(u)
      })
      .catch((err) => {
        // No signal (or the server is down): reopen as the last signed-in user. The queue replays
        // later; the first write online refreshes the CSRF token (api.js retries a CSRF 403).
        const offline = !err?.status || err.status >= 500
        const u = offline ? rememberedUser() : null
        if (u) {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(u)) // offlineQueue reads the user id here
          setUser(u)
        } else if (!offline) {
          forgetUser() // 401: the session really ended; drop the saved lists too
          queryClient.clear()
        }
      })
      .finally(() => setBootstrapping(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-tab auth sync via localStorage storage events (storage events fire in all tabs
  // except the one that wrote, making them perfect for broadcasting login/logout).
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'sst_logout_ts') {
        // Another tab logged out — clear this tab too
        if (!user) return
        queryClient.clear()
        api.setCsrfToken(null)
        sessionStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(CSRF_KEY)
        setUser(null)
        navigate('/login', { replace: true })
      }
      if (e.key === 'sst_auth_signal' && !user) {
        // Another tab logged in — pick up the session via cookie
        api.getSession()
          .then(({ user: u, csrfToken }) => {
            api.setCsrfToken(csrfToken)
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
            sessionStorage.setItem(CSRF_KEY, csrfToken)
            setUser(u)
          })
          .catch(() => {})
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [user, navigate, queryClient])

  // Handle session expiry from any tab without a full page reload.
  // api.js dispatches this event instead of window.location.replace('/login'),
  // preventing the bootstrapping getSession() from silently re-authenticating
  // as whoever owns the current cookie (fixes cross-tab switching + logout loops).
  useEffect(() => {
    const handle = () => {
      queryClient.clear()
      api.setCsrfToken(null)
      // Clear the auth signal so the next login re-fires the storage event in other tabs
      localStorage.removeItem('sst_auth_signal')
      forgetUser()
      setUser(null)
      navigate('/login', { replace: true })
    }
    window.addEventListener('sst:session-expired', handle)
    return () => window.removeEventListener('sst:session-expired', handle)
  }, [navigate, queryClient])

  const login = useCallback((userData, csrfToken) => {
    queryClient.clear()
    api.setCsrfToken(csrfToken)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    sessionStorage.setItem(CSRF_KEY, csrfToken)
    // reset PWA prompt dismissal so prompts appear for each new login
    sessionStorage.removeItem('sst_notif_card')
    sessionStorage.removeItem('sst_install_card')
    localStorage.setItem('sst_auth_signal', '1')
    localStorage.removeItem(LOGOUT_PENDING_KEY)
    rememberUser(userData)
    setUser(userData)
  }, [queryClient])

  const logout = useCallback(async () => {
    await disablePushForLogout()
    try {
      await api.logout()
    } catch (err) {
      // clear local state regardless; with no signal, end the server session on the next start
      if (!err?.status || err.status >= 500) localStorage.setItem(LOGOUT_PENDING_KEY, '1')
    }
    queryClient.clear()
    api.setCsrfToken(null)
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(CSRF_KEY)
    localStorage.removeItem('sst_auth_signal')
    forgetUser()
    localStorage.setItem('sst_logout_ts', Date.now().toString())
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
