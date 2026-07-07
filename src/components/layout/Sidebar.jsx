import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, Building2, Users, ClipboardList,
  Syringe, PackagePlus, Settings, UserCog, LogOut, Activity,
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

export default function Sidebar() {
  const { user, logout } = useAuth()
  const links = NAV[user?.role] ?? []
  const sectionLabel = ROLE_SECTION_LABELS[user?.role] ?? 'Navigation'

  return (
    <aside className="w-64 min-h-screen bg-surface border-r border-surface-border flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Syringe size={17} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-text text-sm leading-tight">VaxAlert</p>
            <p className="text-[11px] text-text-muted leading-tight">Stock Management</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-3 mb-3">
          {sectionLabel}
        </p>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]'
                  : 'text-secondary hover:bg-surface-alt hover:text-text border-l-2 border-transparent pl-[10px]',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-primary' : 'text-text-muted group-hover:text-text transition-colors'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Activity indicator + Sign out */}
      <div className="px-3 pb-4 pt-2 border-t border-surface-border space-y-0.5">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 pl-[10px] rounded-lg text-sm font-medium text-secondary hover:bg-danger/5 hover:text-danger transition-all duration-150 w-full border-l-2 border-transparent group"
        >
          <LogOut size={16} className="text-text-muted group-hover:text-danger transition-colors" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
