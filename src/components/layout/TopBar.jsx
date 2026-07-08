import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

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
  '/facility/workers':      'Worker Management',
  '/facility/audit-log':    'Audit Log',
  '/district/dashboard':    'Dashboard',
  '/district/facilities':   'Facilities',
  '/district/users':        'User Management',
  '/district/audit-log':    'Audit Log',
  '/super-admin/dashboard': 'Dashboard',
  '/super-admin/districts': 'Districts',
  '/super-admin/users':     'User Management',
  '/super-admin/audit-log': 'Audit Log',
  '/worker/stock-entry':    'Stock Entry',
  '/worker/status':         'Stock Status',
}

export default function TopBar({ onMenuClick }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const pageTitle = PAGE_TITLES[pathname] ?? ''

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
          <button className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:bg-slate-100 hover:text-text transition-colors" aria-label="Notifications">
            <Bell size={18} strokeWidth={2.2} />
          </button>
          <div className="h-6 w-px bg-surface-border hidden sm:block" />
          <span className="text-[11px] font-bold uppercase tracking-wider bg-primary/5 text-primary border border-primary/10 px-3 py-1 rounded-full hidden sm:inline-block">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <span className="text-sm font-semibold text-text-muted hidden md:block">{user.name ?? user.email}</span>
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm border border-primary/20 hover:bg-primary-light cursor-pointer transition-colors">
            {initial}
          </div>
        </div>
      )}
    </header>
  )
}
