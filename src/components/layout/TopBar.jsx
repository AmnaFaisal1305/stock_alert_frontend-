import { useState, useRef, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Bell, AlertCircle, X, Syringe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getDashboard } from '../../lib/api'

const ROLE_LABELS = {
  super_admin:         'Super Admin',
  district_supervisor: 'District Supervisor',
  facility_supervisor: 'Facility Supervisor',
  facility_worker:     'Facility Worker',
}

const PAGE_TITLES = {
  '/facility/dashboard':    'Dashboard',
  '/facility/record-stock': 'Record Stock',
  '/facility/thresholds':   'Vaccines & Thresholds',
  '/facility/workers':      'Users Info',
  '/facility/audit-log':    'Audit Log',
  '/district/dashboard':    'Dashboard',
  '/district/facilities':   'Facilities',
  '/district/users':        'Users',
  '/district/audit-log':    'Audit Log',
  '/super-admin/dashboard': 'Dashboard',
  '/super-admin/districts': 'Districts',
  '/super-admin/users':     'User Management',
  '/super-admin/audit-log': 'Audit Log',
  '/worker/stock-entry':    'Stock Entry',
  '/worker/status':         'Stock Status',
}

function facilityPath(role, facilityId) {
  if (role === 'super_admin')         return `/super-admin/facilities/${facilityId}`
  if (role === 'district_supervisor') return `/district/facilities/${facilityId}`
  if (role === 'facility_supervisor') return '/facility/thresholds'
  return '/worker/status'
}

function NotificationPanel({ alerts, role, onClose }) {
  return (
    <div className="absolute right-0 top-12 w-[340px] bg-white rounded-2xl border border-surface-border shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-danger-bg">
        <div className="flex items-center gap-2">
          <AlertCircle size={15} className="text-danger" />
          <p className="text-xs font-bold text-danger uppercase tracking-wider">
            Critical Alerts — {alerts.length} vaccine{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onClose} className="text-danger/60 hover:text-danger transition-colors p-0.5 rounded">
          <X size={14} />
        </button>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-surface-border">
        {alerts.map((a, i) => (
          <Link
            key={i}
            to={facilityPath(role, a.facilityId)}
            onClick={onClose}
            className="block px-4 py-3 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0 mt-0.5">
                <span className="absolute inline-flex h-2 w-2 rounded-full bg-danger/40 animate-ping" />
                <Syringe size={14} className="relative text-danger" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text truncate">{a.vaccineName}</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  <span className="font-semibold text-text-muted/80">Facility:</span> {a.facilityName}
                </p>
                {a.districtName && (
                  <p className="text-[11px] text-text-muted">
                    <span className="font-semibold text-text-muted/80">District:</span> {a.districtName}
                  </p>
                )}
                <p className="text-[11px] font-semibold text-danger mt-1">
                  {a.quantity != null ? `${a.quantity} doses remaining` : 'No stock recorded'}
                </p>
              </div>
              <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-bg text-danger border border-danger/20">
                Critical
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function TopBar({ onMenuClick }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const bellRef  = useRef(null)

  const initial   = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const pageTitle = PAGE_TITLES[pathname] ?? ''

  const showBell = user?.role !== 'facility_worker'

  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 15_000,
    enabled: showBell,
  })

  // Extract critical vaccine rows — works for all roles that return data.facilities
  const criticalAlerts = (data?.facilities ?? []).filter((r) => r.status === 'critical')

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
    <header className="h-16 bg-white border-b border-surface-border flex items-center justify-between px-4 sm:px-6 flex-shrink-0 shadow-sm z-30">
      {/* Left: Mobile Menu Button + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-1 text-secondary hover:text-text hover:bg-slate-100 rounded-xl lg:hidden transition-colors"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {pageTitle && (
          <h1 className="text-base font-bold text-text tracking-tight">{pageTitle}</h1>
        )}
      </div>

      {/* Right: notifications + role + user profile */}
      {user && (
        <div className="flex items-center gap-3.5">

          {/* Bell — hidden for facility_worker */}
          {showBell && (
            <>
              <div className="relative">
                <button
                  ref={bellRef}
                  onClick={() => setOpen((v) => !v)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:bg-slate-100 hover:text-text transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell size={18} strokeWidth={2.2} />
                  {criticalAlerts.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-extrabold flex items-center justify-center leading-none border border-white">
                      {criticalAlerts.length > 9 ? '9+' : criticalAlerts.length}
                    </span>
                  )}
                </button>

                {open && criticalAlerts.length > 0 && (
                  <div ref={panelRef}>
                    <NotificationPanel alerts={criticalAlerts} role={user.role} onClose={() => setOpen(false)} />
                  </div>
                )}

                {open && criticalAlerts.length === 0 && (
                  <div ref={panelRef} className="absolute right-0 top-12 w-72 bg-white rounded-2xl border border-surface-border shadow-2xl z-50 px-5 py-6 flex flex-col items-center gap-2 text-center animate-in fade-in duration-150">
                    <Bell size={28} className="text-text-muted/30" />
                    <p className="text-sm font-semibold text-text">No critical alerts</p>
                    <p className="text-xs text-text-muted">All vaccines are within healthy or low stock levels.</p>
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
