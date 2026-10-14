// Shared page header — the reference "clinical Material" signature:
// breadcrumb · thin large title · subtitle · right-aligned actions.
// Replaces the bespoke per-page banners. Keep one <h1> per screen.
export default function PageHeader({ breadcrumb, title, subtitle, actions, children }) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <p className="text-xs text-text-muted mb-1.5 truncate">{breadcrumb}</p>
      )}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="font-light text-3xl sm:text-4xl tracking-tight leading-[1.1] text-text">
            {title}
          </h1>
          {subtitle && (
            <p className="text-text-muted mt-1.5 text-sm">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap">{actions}</div>
        )}
      </div>
      {children}
    </div>
  )
}
