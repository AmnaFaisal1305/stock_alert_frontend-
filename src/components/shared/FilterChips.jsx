// Single-select filter pills with optional counts (DESIGN.md "Chips & Filters").
// options: [{ value, label, count?, status? }]; `status` adds the matching stock-status dot.
import { statusConfig } from '../../lib/status'

export default function FilterChips({ options, value, onChange, label = 'Filter', className = '' }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={[
              'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border text-sm transition-colors',
              active
                ? 'bg-surface-chip border-surface-chip text-text font-semibold'
                : 'bg-surface border-surface-border text-text hover:bg-surface-alt',
            ].join(' ')}
          >
            {o.status && <span className={`w-1.5 h-1.5 rounded-full ${statusConfig(o.status).dot}`} aria-hidden="true" />}
            {o.label}
            {o.count != null && <span className="text-text-muted font-normal tabular-nums">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
