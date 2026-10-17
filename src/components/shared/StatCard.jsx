// KPI figure: label, large light tabular value, one line of context, optional icon tile.
// tone colours the value only when it encodes status: 'critical' | 'low' | 'adequate'.
// accent colours the icon tile: a status (defaults to tone) or a category 1–5 (DESIGN.md).
const TONE_TEXT = {
  critical: 'text-danger-dark',
  low:      'text-warning-dark',
  adequate: 'text-success-dark',
}

export const ACCENT = {
  critical: 'bg-danger-bg text-danger-dark',
  low:      'bg-warning-bg text-warning-dark',
  adequate: 'bg-success-bg text-success-dark',
  no_data:  'bg-surface-chip text-text-muted',
  primary:  'bg-primary-bg text-primary',
  1: 'bg-cat-1-bg text-cat-1',
  2: 'bg-cat-2-bg text-cat-2',
  3: 'bg-cat-3-bg text-cat-3',
  4: 'bg-cat-4-bg text-cat-4',
  5: 'bg-cat-5-bg text-cat-5',
}

export default function StatCard({ label, value, tone, subtitle, unit, onClick, active = false, icon: Icon, accent }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={[
        'bg-surface rounded-card border p-4 sm:p-5 w-full text-left',
        active ? 'border-text' : 'border-surface-border',
        onClick ? 'transition-colors hover:border-text-muted' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-text-muted truncate pt-1">{label}</p>
        {Icon && (
          <span className={`w-9 h-9 -mt-0.5 -mr-0.5 rounded-control grid place-items-center flex-shrink-0 ${ACCENT[accent ?? tone ?? 'primary'] ?? ACCENT.primary}`} aria-hidden="true">
            <Icon size={18} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <p className={`text-[32px] font-light leading-none tracking-tight tabular-nums ${Icon ? 'mt-1' : 'mt-2'} ${TONE_TEXT[tone] ?? 'text-text'}`}>
        {value}
        {unit && <span className="text-sm font-normal text-text-muted ml-1.5 tracking-normal">{unit}</span>}
      </p>
      {subtitle && <p className="text-xs text-text-muted mt-2 truncate">{subtitle}</p>}
    </Tag>
  )
}
