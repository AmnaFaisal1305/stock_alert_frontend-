import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import { WifiOff, Sun, Moon, Menu, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getUnreadCount } from '../../lib/api'
import NotificationPanel from './NotificationPanel'
import { subscribe, getQueue, getLastSynced } from '../../lib/offlineQueue'
import { useTheme } from '../../hooks/useTheme'
import { scopeLabel, ROLE_LABELS } from '../../lib/navigation'

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

const iconBtn = 'w-9 h-9 rounded-control grid place-items-center text-text-muted hover:bg-surface-chip hover:text-text transition-colors'

function SyncStatus() {
  const isOnline = useOnline()
  const { pending, lastSynced } = useQueueState()
  const time = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (!isOnline) {
    return (
      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-warning-bg text-warning-dark text-xs font-medium" role="status">
        <WifiOff size={13} strokeWidth={2} aria-hidden="true" />
        Offline{pending > 0 && ` · ${pending} pending`}
      </span>
    )
  }
  if (pending > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-info-bg text-info-dark text-xs font-medium" role="status">
        <RefreshCw size={13} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Syncing {pending}
      </span>
    )
  }
  if (lastSynced) {
    return <span className="hidden sm:inline text-xs text-text-muted" title={new Date(lastSynced).toLocaleString()}>Synced {time(lastSynced)}</span>
  }
  return null
}

// Rings the bell for a moment whenever the unread count goes up.
function useRingOnIncrease(count) {
  const prev = useRef(count)
  const [ringing, setRinging] = useState(false)
  useEffect(() => {
    if (count > prev.current) {
      setRinging(true)
      const t = setTimeout(() => setRinging(false), 1000)
      prev.current = count
      return () => clearTimeout(t)
    }
    prev.current = count
  }, [count])
  return ringing
}

export default function TopBar({ onMenuClick, navCollapsed, navOpen }) {
  const { user } = useAuth()
  const { resolved, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const bellRef  = useRef(null)

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const showBell = user?.role !== 'facility_worker'

  const { data: countData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
    enabled: showBell,
  })
  const unreadCount = countData?.count ?? 0
  const ringing = useRingOnIncrease(unreadCount)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current?.contains(e.target) || bellRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function handleKey(e) { if (e.key === 'Escape') { setOpen(false); bellRef.current?.focus() } }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <header className="h-16 bg-surface-alt border-b border-surface-border flex items-center gap-3 px-4 sm:px-6 lg:px-7 flex-shrink-0 z-30">
      <button onClick={onMenuClick} className={`${iconBtn} -ml-1.5 lg:-ml-2`} aria-label="Toggle navigation" title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
        <Menu size={20} strokeWidth={1.75} />
        <span className="sr-only lg:hidden">{navOpen ? '(open)' : ''}</span>
      </button>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SyncStatus />

          <button
            onClick={toggle}
            className={iconBtn}
            aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={resolved === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {resolved === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          </button>

          {showBell && (
            <div className="relative">
              <button
                ref={bellRef}
                onClick={() => setOpen((v) => !v)}
                className={`${iconBtn} relative`}
                aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                aria-expanded={open}
              >
                {/* Emoji bell as in docs/design_refrences (DESIGN.md exception). */}
                <span aria-hidden="true" className={`text-[18px] leading-none origin-top ${ringing ? 'animate-bell-ring motion-reduce:animate-none' : ''}`}>🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute top-0 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-full bg-danger text-white text-[10px] font-semibold grid place-items-center leading-none ring-2 ring-surface-alt tabular-nums" aria-hidden="true">
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
          )}

          <span className="hidden sm:inline-flex items-center h-6 px-2.5 ml-1 rounded-full bg-success-bg text-success-dark text-[11px] font-semibold uppercase tracking-[0.06em]">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>

          <div className="hidden md:block text-right leading-tight ml-1 max-w-[200px]">
            <p className="text-sm font-medium text-text truncate">{user.name ?? user.email}</p>
            <p className="text-xs text-text-muted truncate">{scopeLabel(user)}</p>
          </div>

          <span
            className="w-[38px] h-[38px] ml-1 rounded-full bg-primary text-white grid place-items-center text-sm font-medium flex-shrink-0"
            title={`Signed in as ${user.name ?? user.email}`}
            aria-hidden="true"
          >
            {initial}
          </span>
        </div>
      )}
    </header>
  )
}
