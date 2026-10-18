import { memo, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, X, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { navFor, scopeLabel, GuideIcon } from '../../lib/navigation'

const TREE_INDENT = ['', 'ml-4', 'ml-8']

function NavItem({ to, label, icon: Icon, depth = 0, collapsed, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex items-center rounded-control text-sm transition-colors',
          collapsed ? 'justify-center h-10 w-10 mx-auto' : `gap-3 h-10 px-3 ${TREE_INDENT[depth]}`,
          isActive ? 'bg-white/10 text-white font-medium' : 'text-white/75 hover:bg-white/[0.06] hover:text-white',
        ].join(' ')
      }
    >
      <Icon size={depth ? 16 : 18} strokeWidth={1.75} className="flex-shrink-0 opacity-80" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

// Collapse is driven by the top bar's menu button (Layout).
const Sidebar = memo(function Sidebar({ mobileOpen, onClose, collapsed }) {
  const { user, logout } = useAuth()
  const nav = navFor(user?.role)
  const scope = scopeLabel(user)

  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onClose])

  // On mobile the drawer is always full width, so "collapsed" only applies on lg+.
  const isCollapsed = collapsed && !mobileOpen

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-[rgb(28_33_30/0.35)] z-40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={[
          'h-screen bg-epi-dark text-white flex flex-col flex-shrink-0',
          'fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0 transition-[width,transform] duration-200 ease-out',
          isCollapsed ? 'w-[72px]' : 'w-[250px]',
          mobileOpen ? 'translate-x-0 shadow-overlay' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        aria-label="Sidebar"
      >
        {/* Brand */}
        <div className={`flex items-center gap-2.5 px-3.5 pt-4 pb-4 border-b border-white/[0.08] ${isCollapsed ? 'justify-center' : ''}`}>
          <img src="/images/logo-circle-192.png" alt="" width="38" height="38" className="w-[38px] h-[38px] rounded-full ring-1 ring-white/20 flex-shrink-0" />
          {!isCollapsed && (
            <p className="text-sm font-medium leading-tight flex-1 min-w-0 text-balance">Stock Management &amp; Alert System</p>
          )}
          {mobileOpen && (
            <button onClick={onClose} aria-label="Close navigation" className="lg:hidden w-8 h-8 grid place-items-center rounded-control text-white/70 hover:bg-white/10 hover:text-white">
              <X size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Scope + CTA */}
        {!isCollapsed && (
          <div className="px-3.5 pt-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/45 truncate" title={scope}>
              {nav.section}<span className="text-white/25"> · </span><span className="normal-case tracking-normal font-medium text-white/70">{scope}</span>
            </p>
          </div>
        )}
        {nav.cta && (
          <div className={isCollapsed ? 'px-2.5 pt-3' : 'px-3 pt-3'}>
            <NavLink
              to={nav.cta.to}
              onClick={onClose}
              title={isCollapsed ? nav.cta.label : undefined}
              className={`flex items-center justify-center gap-2 h-10 rounded-control bg-white/90 text-epi-dark text-sm font-medium hover:bg-white transition-colors ${isCollapsed ? 'w-10 mx-auto' : 'w-full'}`}
            >
              {isCollapsed ? <ArrowRight size={16} strokeWidth={1.75} /> : nav.cta.label}
            </NavLink>
          </div>
        )}

        {/* Groups */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-none pb-3 ${isCollapsed ? 'px-2.5' : 'px-3'}`} aria-label="Main navigation">
          {nav.groups.map((g) => (
            <div key={g.label} className="mt-4">
              {isCollapsed ? (
                <div className="h-px bg-white/[0.08] mx-2 mb-2" aria-hidden="true" />
              ) : (
                <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/40">{g.label}</p>
              )}
              <div className="flex flex-col gap-0.5">
                {g.items.map((item) => (
                  <NavItem key={item.to} {...item} depth={isCollapsed ? 0 : item.depth} collapsed={isCollapsed} onNavigate={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={`border-t border-white/[0.08] py-3 flex flex-col gap-0.5 ${isCollapsed ? 'px-2.5' : 'px-3'}`}>
          {nav.guide && <NavItem to={nav.guide} label="Guide" icon={GuideIcon} collapsed={isCollapsed} onNavigate={onClose} />}
          <button
            onClick={logout}
            title={isCollapsed ? 'Sign out' : undefined}
            className={`flex items-center rounded-control text-sm text-white/75 hover:bg-white/[0.06] hover:text-white transition-colors ${isCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 h-10 px-3 w-full'}`}
          >
            <LogOut size={18} strokeWidth={1.75} className="flex-shrink-0 opacity-80" aria-hidden="true" />
            {!isCollapsed && 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  )
})

export default Sidebar
