import { memo, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, Building2, Users, ClipboardList,
  Syringe, PackagePlus, UserCog, LogOut, BookOpen, MapPin, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV = {
  super_admin: [
    { to: '/super-admin/dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
    { to: '/super-admin/districts',  label: 'Districts',          icon: Map             },
    { to: '/super-admin/ucs',        label: 'UC Management',      icon: MapPin          },
    { to: '/super-admin/facilities', label: 'Facilities',         icon: Building2       },
    { to: '/super-admin/vaccines',   label: 'Vaccines',           icon: Syringe         },
    { to: '/super-admin/users',      label: 'User Management',    icon: Users           },
    { to: '/super-admin/audit-log',  label: 'Audit Log',          icon: ClipboardList   },
  ],
  district_supervisor: [
    { to: '/district/dashboard',     label: 'Dashboard Analytics',  icon: LayoutDashboard },
    { to: '/district/facilities',    label: 'Vaccine Performance',  icon: Building2       },
    { to: '/district/users',         label: 'Users',                icon: Users           },
    { to: '/district/audit-log',     label: 'Audit Log',            icon: ClipboardList   },
  ],
  facility_supervisor: [
    { to: '/facility/dashboard',        label: 'Dashboard',          icon: LayoutDashboard },
    { to: '/facility/thresholds',       label: 'Vaccines',           icon: Syringe         },
    { to: '/facility/record-stock',     label: 'Record Stock',       icon: PackagePlus     },
    { to: '/facility/stock-register',   label: 'Stock Register',     icon: BookOpen        },
    { to: '/facility/workers',          label: 'Users Info',         icon: UserCog         },
    { to: '/facility/audit-log',        label: 'Audit Log',          icon: ClipboardList   },
  ],
  uc_supervisor: [
    { to: '/uc/dashboard',           label: 'Dashboard',          icon: LayoutDashboard },
    { to: '/uc/facilities',          label: 'Vaccine Performance', icon: Building2       },
    { to: '/uc/users',               label: 'Users',              icon: Users           },
    { to: '/uc/audit-log',           label: 'Audit Log',          icon: ClipboardList   },
  ],
  facility_worker: [
    { to: '/worker/stock-entry',     label: 'Stock Entry',        icon: Syringe         },
    { to: '/worker/status',          label: 'Stock Status',       icon: LayoutDashboard },
  ],
}

const ROLE_SECTION_LABELS = {
  super_admin:         'Administration',
  district_supervisor: 'District',
  uc_supervisor:       'UC Supervisor',
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
        'w-64 h-screen bg-epi-dark flex flex-col flex-shrink-0',
        'fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0 transition-transform duration-300 ease-in-out',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:shadow-none'
      ].join(' ')}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/20 bg-white">
              <img src="/images/WhatsApp Image 2026-08-21 at 2.25.20 AM.jpeg" alt="Government of Sindh" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-extrabold text-white text-xs leading-snug tracking-tight">Stock Management &amp; Alert System</p>
            </div>
          </div>
          {mobileOpen && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="lg:hidden text-white/60 hover:text-white p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-epi-mint"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto" aria-label="Main navigation">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-3 mb-4">
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
                      ? 'bg-epi-mint/15 text-epi-mint border-epi-mint/50'
                      : 'text-white/70 border-transparent hover:bg-white/10 hover:text-white',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} className={isActive ? 'text-epi-mint' : 'text-white/40 group-hover:text-white transition-colors'} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Sign out */}
        <div className="px-4 pb-6 pt-3 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-white/60 hover:bg-danger/20 hover:text-red-300 transition-all duration-150 w-full border-l-4 border-transparent group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-epi-mint"
          >
            <LogOut size={17} className="text-white/40 group-hover:text-red-300 transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
})

export default Sidebar
