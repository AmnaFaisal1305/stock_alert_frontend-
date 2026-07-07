import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, Building2, Users, ClipboardList,
  Syringe, PackagePlus, Settings, UserCog, LogOut, X,
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
    { to: '/facility/thresholds',    label: 'Vaccines',           icon: Settings        },
    { to: '/facility/workers',       label: 'Worker Management',  icon: UserCog         },
    { to: '/facility/audit-log',     label: 'Audit Log',          icon: ClipboardList   },
  ],
  facility_worker: [
    { to: '/worker/stock-entry',     label: 'Stock Entry',        icon: Syringe         },
    { to: '/worker/status',          label: 'Stock Status',       icon: LayoutDashboard },
  ],
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth()
  const links = NAV[user?.role] ?? []

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-64 min-h-screen bg-surface border-r border-surface-border flex flex-col',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          'lg:static lg:z-auto lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="px-6 py-5 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Syringe size={22} className="text-primary" />
            <span className="font-bold text-text text-sm leading-tight">
              Vaccine Stock<br />Alert System
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-lg text-text-muted hover:bg-surface-alt hover:text-text transition-colors lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-secondary hover:bg-surface-alt hover:text-text',
                ].join(' ')
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-surface-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:bg-surface-alt hover:text-text transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
