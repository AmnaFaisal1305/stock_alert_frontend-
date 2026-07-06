import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, Building2, Users, ClipboardList,
  Syringe, PackagePlus, Settings, UserCog, LogOut,
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

export default function Sidebar() {
  const { user, logout } = useAuth()
  const links = NAV[user?.role] ?? []

  return (
    <aside className="w-64 min-h-screen bg-surface border-r border-surface-border flex flex-col">
      <div className="px-6 py-5 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Syringe size={22} className="text-primary" />
          <span className="font-bold text-text text-sm leading-tight">
            Vaccine Stock<br />Alert System
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:bg-surface-alt hover:text-text transition-colors w-full"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
