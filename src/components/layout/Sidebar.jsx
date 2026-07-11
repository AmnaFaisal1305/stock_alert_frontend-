import { memo, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, Building2, Users, ClipboardList,
  Syringe, PackagePlus, UserCog, LogOut,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV = {
  super_admin: [
    { to: '/super-admin/dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
    { to: '/super-admin/districts',  label: 'Districts',          icon: Map             },
    { to: '/super-admin/users',      label: 'User Management',    icon: Users           },
    { to: '/super-admin/audit-log',  label: 'Audit Log',          icon: ClipboardList   },
  ],
  district_supervisor: [
    { to: '/district/dashboard',     label: 'Dashboard',          icon: LayoutDashboard },
    { to: '/district/facilities',    label: 'Facilities',         icon: Building2       },
    { to: '/district/users',         label: 'User Management',    icon: Users           },
    { to: '/district/audit-log',     label: 'Audit Log',          icon: ClipboardList   },
  ],
  facility_supervisor: [
    { to: '/facility/dashboard',     label: 'Dashboard',          icon: LayoutDashboard },
    { to: '/facility/record-stock',  label: 'Record Stock',       icon: PackagePlus     },
    { to: '/facility/thresholds',    label: 'Vaccines',           icon: Syringe         },
    { to: '/facility/workers',       label: 'Worker Management',  icon: UserCog         },
    { to: '/facility/audit-log',     label: 'Audit Log',          icon: ClipboardList   },
  ],
  facility_worker: [
    { to: '/worker/stock-entry',     label: 'Stock Entry',        icon: Syringe         },
    { to: '/worker/status',          label: 'Stock Status',       icon: LayoutDashboard },
  ],
}

const ROLE_SECTION_LABELS = {
  super_admin:         'Administration',
  district_supervisor: 'District',
  facility_supervisor: 'Facility',
  facility_worker:     'My Workspace',
}

const Sidebar = memo(function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth()
  const links       = NAV[user?.role] ?? []
  const sectionLabel = ROLE_SECTION_LABELS[user?.role] ?? 'Navigation'

  // Close on Escape when mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onClose])

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}
          role="button"
          tabIndex={0}
          aria-label="Close navigation"
        />
      )}

      <aside className={[
        'w-64 h-screen bg-white border-r border-surface-border flex flex-col flex-shrink-0',
        'fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0 transition-transform duration-300 ease-in-out',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:shadow-none'
      ].join(' ')}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/akuh_logo.webp" alt="AKUH Logo" className="w-8 h-8 object-contain flex-shrink-0" />
            <div>
              <p className="font-extrabold text-text text-xs leading-none tracking-tight uppercase">Smart Stock Alert</p>
              <p className="text-[9px] font-bold text-text-muted/70 mt-0.5 uppercase tracking-wider">AKUH Network</p>
            </div>
          </div>
          {mobileOpen && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="lg:hidden text-text-muted hover:text-text p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto" aria-label="Main navigation">
          <p className="text-[10px] font-bold text-text-muted/65 uppercase tracking-widest px-3 mb-4">
            {sectionLabel}
          </p>
          <div className="space-y-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 group border-l-4',
                    isActive
                      ? 'bg-primary/5 text-primary border-primary'
                      : 'text-secondary border-transparent hover:bg-slate-50 hover:text-text',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} className={isActive ? 'text-primary' : 'text-text-muted group-hover:text-text transition-colors'} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Sign out */}
        <div className="px-4 pb-6 pt-3 border-t border-surface-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-secondary hover:bg-danger/5 hover:text-danger transition-all duration-150 w-full border-l-4 border-transparent group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut size={17} className="text-text-muted group-hover:text-danger transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
})

export default Sidebar
