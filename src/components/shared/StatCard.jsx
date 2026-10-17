// KPI figure: label, large light tabular value, one line of context.
// tone colours the value only when it encodes status: 'critical' | 'low' | 'adequate'.
// `icon` / `colorClass` are accepted for older callers and intentionally not rendered
// (DESIGN.md bans corner icon tiles).
const TONE_TEXT = {
  critical: 'text-danger-dark',
  low:      'text-warning-dark',
  adequate: 'text-success-dark',
}

// shortcut: infers tone from legacy colorClass until every caller passes `tone` (Phase 3 rollout).
function legacyTone(colorClass = '') {
  if (colorClass.includes('danger')) return 'critical'
  if (colorClass.includes('warning')) return 'low'
  return undefined
}

export default function StatCard({ label, value, tone, colorClass, subtitle, unit, onClick, active = false }) {
  const Tag = onClick ? 'button' : 'div'
  tone = tone ?? legacyTone(colorClass)
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
