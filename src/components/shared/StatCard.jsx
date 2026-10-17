// KPI figure: label, large light tabular value, one line of context.
// tone colours the value only when it encodes status: 'critical' | 'low' | 'adequate'.
const TONE_TEXT = {
  critical: 'text-danger-dark',
  low:      'text-warning-dark',
  adequate: 'text-success-dark',
}

export default function StatCard({ label, value, tone, subtitle, unit, onClick, active = false }) {
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
      <p className="text-xs font-medium text-text-muted truncate">{label}</p>
      <p className={`text-[32px] font-light mt-2 leading-none tracking-tight tabular-nums ${TONE_TEXT[tone] ?? 'text-text'}`}>
        {value}
        {unit && <span className="text-sm font-normal text-text-muted ml-1.5 tracking-normal">{unit}</span>}
      </p>
      {subtitle && <p className="text-xs text-text-muted mt-2 truncate">{subtitle}</p>}
    </Tag>
  )
}
