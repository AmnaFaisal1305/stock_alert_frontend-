// Page header: breadcrumb · light title · subtitle · right-aligned actions. One <h1> per screen.
// size="display" for dashboards/overviews; default for work screens (forms, lists, logs).
export default function PageHeader({ breadcrumb, title, subtitle, actions, size = 'default', children }) {
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
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
