import { memo, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, Building2, Users, ClipboardList,
  Syringe, PackagePlus, UserCog, LogOut, BookOpen, MapPin,
  ChevronLeft,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV = {
  super_admin: [
    { to: '/super-admin/dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
    {
      type: 'tree',
      items: [
        { to: '/super-admin/districts',  label: 'Districts',     icon: Map,      depth: 0 },
        { to: '/super-admin/ucs',        label: 'UC Management', icon: MapPin,   depth: 1 },
        { to: '/super-admin/facilities', label: 'Facilities',    icon: Building2, depth: 2 },
      ],
    },
    { to: '/super-admin/vaccines',   label: 'Vaccines',        icon: Syringe         },
    { to: '/super-admin/users',      label: 'User Management', icon: Users           },
    { to: '/super-admin/audit-log',  label: 'Audit Log',       icon: ClipboardList   },
  ],
  district_supervisor: [
    { to: '/district/dashboard',  label: 'Dashboard Analytics', icon: LayoutDashboard },
    { to: '/district/facilities', label: 'Vaccine Performance', icon: Building2       },
    { to: '/district/users',      label: 'Users',               icon: Users           },
    { to: '/district/audit-log',  label: 'Audit Log',           icon: ClipboardList   },
  ],
  facility_supervisor: [
    { to: '/facility/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
    { to: '/facility/thresholds',     label: 'Vaccines',      icon: Syringe         },
    { to: '/facility/record-stock',   label: 'Record Stock',  icon: PackagePlus     },
    { to: '/facility/stock-register', label: 'Stock Register',icon: BookOpen        },
    { to: '/facility/workers',        label: 'Users Info',    icon: UserCog         },
    { to: '/facility/audit-log',      label: 'Audit Log',     icon: ClipboardList   },
  ],
  uc_supervisor: [
    { to: '/uc/dashboard',   label: 'Dashboard',          icon: LayoutDashboard },
    { to: '/uc/facilities',  label: 'Vaccine Performance',icon: Building2       },
    { to: '/uc/users',       label: 'Users',              icon: Users           },
    { to: '/uc/audit-log',   label: 'Audit Log',          icon: ClipboardList   },
  ],
  facility_worker: [
    { to: '/worker/stock-entry', label: 'Stock Entry',  icon: Syringe         },
    { to: '/worker/status',      label: 'Stock Status', icon: LayoutDashboard },
  ],
}

const ROLE_SECTION_LABELS = {
  super_admin:         'Administration',
  district_supervisor: 'District',
  uc_supervisor:       'UC Supervisor',
  facility_supervisor: 'Facility',
  facility_worker:     'My Workspace',
}

const Sidebar = memo(function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth()
  const links        = NAV[user?.role] ?? []
  const sectionLabel = ROLE_SECTION_LABELS[user?.role] ?? 'Navigation'

  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onClose])

  return (
    <>
      {/* Mobile overlay */}
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

      <aside
        className={[
          'h-screen bg-epi-dark flex flex-col flex-shrink-0 relative',
          'fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-64',
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* ── Logo ─────────────────────────────────── */}
        <div className={[
          'border-b border-white/10 flex items-center flex-shrink-0 relative',
          collapsed ? 'justify-center px-0 py-5 h-[72px]' : 'gap-3 px-5 py-5 h-[72px]',
        ].join(' ')}>
          <div className="w-9 h-9 flex-shrink-0">
            <img
              src="/images/icon image.jpeg"
              alt="Logo"
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'screen', filter: 'invert(1) hue-rotate(180deg)' }}
            />
          </div>

          {!collapsed && (
            <p className="font-extrabold text-white text-xs leading-snug tracking-tight flex-1 min-w-0">
              Stock Management &amp; Alert System
            </p>
          )}

          {/* Collapse toggle — desktop only, top-right of header */}
          {!mobileOpen && (
            <button
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={[
                'hidden lg:flex items-center justify-center w-6 h-6 rounded-full',
                'bg-white/10 hover:bg-white/20 text-white/50 hover:text-white',
                'transition-all duration-150 flex-shrink-0',
                collapsed ? '' : 'ml-auto',
              ].join(' ')}
            >
              <ChevronLeft
                size={13}
                strokeWidth={2.5}
                className={[
                  'transition-transform duration-300',
                  collapsed ? 'rotate-180' : '',
                ].join(' ')}
              />
            </button>
          )}

          {/* Mobile close button */}
          {mobileOpen && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="ml-auto lg:hidden text-white/60 hover:text-white p-1 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────── */}
        <nav
          className={[
            'flex-1 py-5 overflow-y-auto overflow-x-hidden flex flex-col gap-1',
            collapsed ? 'px-2.5' : 'px-3',
          ].join(' ')}
          aria-label="Main navigation"
        >
          {/* Section label */}
          {!collapsed && (
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 mb-2">
              {sectionLabel}
            </p>
          )}

          {links.map((item, idx) => {
            if (item.type === 'tree') {
              const treeLink = ({ to, label, icon: Icon }, size = 18) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    [
                      'flex items-center rounded-xl font-semibold transition-all duration-150 group',
                      collapsed ? 'justify-center w-full p-3 text-sm' : 'gap-2.5 px-3 py-2 text-sm',
                      isActive
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-white/50 hover:bg-white/10 hover:text-white/90',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={size} strokeWidth={isActive ? 2.2 : 1.8}
                        className={['flex-shrink-0 transition-colors duration-150', isActive ? 'text-white' : 'text-white/40 group-hover:text-white/80'].join(' ')} />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </>
                  )}
                </NavLink>
              )

              const root     = item.items.find((i) => i.depth === 0)
              const ucItem   = item.items.find((i) => i.depth === 1)
              const facItem  = item.items.find((i) => i.depth === 2)

              if (collapsed) {
                return (
                  <div key={idx} className="flex flex-col gap-1">
                    {treeLink(root)}
                    {treeLink(ucItem)}
                    {treeLink(facItem)}
                  </div>
                )
              }

              return (
                <div key={idx} className="flex flex-col gap-0.5">
                  {/* Districts — root */}
                  {treeLink(root, 18)}

                  {/* UC Management — nested under Districts */}
                  <div className="ml-5 border-l border-white/[0.08] pl-2 flex flex-col gap-0.5">
                    {treeLink(ucItem, 15)}

                    {/* Facilities — nested under UC */}
                    <div className="ml-4 border-l border-white/[0.08] pl-2">
                      {treeLink(facItem, 14)}
                    </div>
                  </div>
                </div>
              )
            }

            const { to, label, icon: Icon } = item
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  [
                    'flex items-center rounded-xl text-sm font-semibold transition-all duration-150 group',
                    collapsed ? 'justify-center w-full p-3' : 'gap-3 px-3.5 py-2.5',
                    isActive
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-white/50 hover:bg-white/10 hover:text-white/90',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8}
                      className={['flex-shrink-0 transition-colors duration-150', isActive ? 'text-white' : 'text-white/40 group-hover:text-white/80'].join(' ')} />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* ── Bottom: sign-out + collapse toggle ───── */}
        <div className={[
          'border-t border-white/10 py-4 flex flex-col gap-1',
          collapsed ? 'px-2.5 items-center' : 'px-3',
        ].join(' ')}>

          {/* Sign out */}
          <button
            onClick={logout}
            title={collapsed ? 'Sign Out' : undefined}
            className={[
              'flex items-center rounded-xl text-sm font-semibold text-white/40',
              'hover:bg-danger/20 hover:text-red-300 transition-all duration-150 group',
              collapsed ? 'justify-center w-full p-3' : 'gap-3 px-3.5 py-2.5 w-full',
            ].join(' ')}
          >
            <LogOut size={18} strokeWidth={1.8} className="flex-shrink-0 group-hover:text-red-300 transition-colors" />
            {!collapsed && <span>Sign Out</span>}
          </button>

        </div>
      </aside>
    </>
  )
})

export default Sidebar
