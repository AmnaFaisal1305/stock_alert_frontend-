import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, WifiOff, Sun, Moon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getUnreadCount } from '../../lib/api'
import NotificationPanel from './NotificationPanel'
import { subscribe, getQueue, getLastSynced } from '../../lib/offlineQueue'
import { useTheme } from '../../hooks/useTheme'

function useOnline() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) } },
    () => navigator.onLine,
    () => true,
  )
}

function useQueueState() {
  const pending    = useSyncExternalStore(subscribe, () => getQueue().filter(i => i.status === 'pending').length, () => 0)
  const lastSynced = useSyncExternalStore(subscribe, getLastSynced, () => null)
  return { pending, lastSynced }
}

const ROLE_LABELS = {
  super_admin:         'Super Admin',
  district_supervisor: 'District Supervisor',
  uc_supervisor:       'UC Supervisor',
  facility_supervisor: 'Facility Supervisor',
  facility_worker:     'Facility Worker',
  facility_head:       'Facility Head',
  observer:            'Observer',
}

const PAGE_TITLES = {
  '/facility/dashboard':    'Dashboard',
  '/facility/record-stock': 'Stock Requests',
  '/facility/approvals':    'Approvals',
  '/facility/thresholds':   'Vaccines & Thresholds',
  '/facility/workers':      'Users Info',
  '/facility/audit-log':    'Audit Log',
  '/facility/assign-vials': 'Assign Vials',
  '/facility/day-end':      'Day End',
  '/facility/stock-register': 'Stock Register',
  '/district/dashboard':    'Dashboard',
  '/district/facilities':   'Facilities',
  '/district/users':        'Users',
  '/district/audit-log':    'Audit Log',
  '/super-admin/dashboard': 'Dashboard',
  '/super-admin/districts': 'Districts',
  '/super-admin/facilities': 'Facilities',
  '/super-admin/ucs':       'UC Management',
  '/super-admin/vaccines':  'Vaccines',
  '/super-admin/users':     'User Management',
  '/super-admin/audit-log': 'Audit Log',
  '/uc/dashboard':          'Dashboard',
  '/uc/facilities':         'Facilities',
  '/uc/users':              'Users',
  '/uc/audit-log':          'Audit Log',
  '/uc/stock-requests':     'Stock Requests',
  '/head/dashboard':        'Dashboard',
  '/head/approvals':        'Approvals',
  '/head/stock-requests':   'Stock Requests',
  '/head/users':            'Users',
  '/head/audit-log':        'Audit Log',
  '/head/analytics':        'Analytics',
  '/head/guide':            'Guide',
  '/super-admin/analytics': 'Analytics',
  '/super-admin/guide':     'Guide',
  '/district/analytics':    'Analytics',
  '/district/guide':        'Guide',
  '/facility/analytics':    'Analytics',
  '/facility/guide':        'Guide',
  '/uc/analytics':          'Analytics',
  '/uc/guide':              'Guide',
  '/worker/stock-entry':    'Stock Entry',
  '/worker/status':         'Stock Status',
  '/worker/guide':          'Guide',
}

export default function TopBar({ onMenuClick }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const { resolved, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const bellRef  = useRef(null)
  const isOnline = useOnline()
  const { pending, lastSynced } = useQueueState()

  const initial   = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const pageTitle = PAGE_TITLES[pathname] ?? ''

  const showBell = user?.role !== 'facility_worker'

  const { data: countData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
    enabled: showBell,
  })

  const unreadCount = countData?.count ?? 0

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current?.contains(e.target) || bellRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <header className="h-16 bg-surface border-b border-surface-border flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-30">
      {/* Left: Mobile Menu Button + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-1 text-text-muted hover:text-text hover:bg-surface-alt rounded-xl lg:hidden transition-colors"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {pageTitle && (
          <h1 className="text-sm sm:text-base font-bold text-text tracking-tight truncate max-w-[140px] sm:max-w-none">{pageTitle}</h1>
        )}
      </div>

      {/* Right: notifications + role + user profile */}
      {user && (
        <div className="flex items-center gap-3.5">

          {/* Connectivity indicator */}
          {!isOnline ? (
            <div className="flex items-center gap-1.5 text-amber-600" title="You are offline">
              <WifiOff size={14} strokeWidth={2.2} />
              {pending > 0 && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  {pending} pending
                </span>
              )}
            </div>
          ) : (
            pending > 0 && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full" title={lastSynced ? `Last synced ${new Date(lastSynced).toLocaleTimeString()}` : undefined}>
                {pending} syncing…
              </span>
            )
          )}
          {isOnline && !pending && lastSynced && (
            <span className="text-[10px] text-text-muted hidden sm:inline" title={`Last synced ${new Date(lastSynced).toLocaleString()}`}>
              Synced {new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:bg-surface-alt hover:text-text transition-colors"
            aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolved === 'dark' ? <Sun size={18} strokeWidth={2.2} /> : <Moon size={18} strokeWidth={2.2} />}
          </button>

          {/* Bell — hidden for facility_worker */}
          {showBell && (
            <>
              <div className="relative">
                <button
                  ref={bellRef}
                  onClick={() => setOpen((v) => !v)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:bg-surface-alt hover:text-text transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell size={18} strokeWidth={2.2} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-extrabold flex items-center justify-center leading-none border border-surface">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {open && (
                  <div ref={panelRef}>
                    <NotificationPanel onClose={() => setOpen(false)} />
                  </div>
                )}
              </div>

              <div className="h-6 w-px bg-surface-border hidden sm:block" />
            </>
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider bg-primary/5 text-primary border border-primary/10 px-3 py-1 rounded-full hidden sm:inline-block">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <span className="text-sm font-semibold text-text-muted hidden md:block">{user.name ?? user.email}</span>
          <button
            type="button"
            aria-label={`Signed in as ${user.name ?? user.email}`}
            className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm border border-primary/20 hover:bg-primary-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {initial}
          </button>
        </div>
      )}
    </header>
  )
}
