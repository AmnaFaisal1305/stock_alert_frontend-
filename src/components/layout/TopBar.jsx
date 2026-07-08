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

export default function TopBar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const pageTitle = PAGE_TITLES[pathname] ?? ''

  return (
    <header className="h-14 bg-surface border-b border-surface-border flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: page title */}
      <div>
        {pageTitle && (
          <h1 className="text-sm font-semibold text-text">{pageTitle}</h1>
        )}
      </div>

      {/* Right: bell + role + user */}
      {user && (
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-alt hover:text-text transition-colors" aria-label="Notifications">
            <Bell size={16} />
          </button>
          <div className="h-5 w-px bg-surface-border" />
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full tracking-wide">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <span className="text-sm text-text-muted hidden sm:block">{user.name ?? user.email}</span>
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
            {initial}
          </div>
        </div>
      )}
    </header>
  )
}
