import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../lib/navigation'

// Page header: breadcrumb · light title · subtitle · right-aligned actions. One <h1> per screen.
// size="display" for dashboards/overviews; default for work screens (forms, lists, logs).
export default function PageHeader({ breadcrumb, title, subtitle, actions, size = 'default', children }) {
  // The Observer reuses the Super Admin pages, so their breadcrumbs name the viewer's own role.
  const { user } = useAuth()
  if (user?.role === 'observer' && breadcrumb?.startsWith(ROLE_LABELS.super_admin)) {
    breadcrumb = ROLE_LABELS.observer + breadcrumb.slice(ROLE_LABELS.super_admin.length)
  }
  const titleCls = size === 'display'
    ? 'text-[30px] sm:text-[36px]'
    : 'text-[26px] sm:text-[30px]'

  return (
    <div className="mb-6">
      {breadcrumb && <p className="text-xs text-text-muted mb-1.5 truncate">{breadcrumb}</p>}
      <div className="flex items-end gap-x-4 gap-y-3 flex-wrap">
        <div className="flex-1 min-w-[min(100%,16rem)]">
          <h1 className={`font-light tracking-tight leading-[1.1] text-text text-balance ${titleCls}`}>{title}</h1>
          {subtitle && <p className="text-text-muted mt-1.5 text-sm">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap" data-tour="page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
