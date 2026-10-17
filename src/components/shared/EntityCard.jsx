import { ACCENT } from './StatCard'

// Inner layout of a grid-view card (Table view="grid" supplies the frame):
// icon tile + title/subtitle + badge, a short label/value list, then footnote + actions.
// meta: [{ label, value }]; accent: a status or category 1–5 (see StatCard ACCENT).
export default function EntityCard({ icon: Icon, accent = 'primary', title, subtitle, badge, meta = [], footnote, actions }) {
  const rows = meta.filter((m) => m && m.value != null && m.value !== '')
  return (
    <>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className={`w-9 h-9 rounded-control grid place-items-center flex-shrink-0 ${ACCENT[accent] ?? ACCENT.primary}`} aria-hidden="true">
            <Icon size={18} strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text truncate" title={typeof title === 'string' ? title : undefined}>{title}</p>
          {subtitle && <p className="text-xs text-text-muted truncate mt-0.5">{subtitle}</p>}
        </div>
        {badge && <div className="flex-shrink-0">{badge}</div>}
      </div>

      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map((m) => (
            <div key={m.label} className="contents">
              <dt className="text-xs text-text-muted self-center">{m.label}</dt>
              <dd className="text-text text-right min-w-0 truncate tabular-nums">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {(footnote || actions) && (
        <div className="mt-auto pt-3 border-t border-surface-border flex items-center justify-between gap-2 min-h-[44px]">
          <p className="text-xs text-text-muted truncate">{footnote}</p>
          {actions}
        </div>
      )}
    </>
  )
}
