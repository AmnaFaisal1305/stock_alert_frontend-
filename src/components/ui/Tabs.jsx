// The one tab style (DESIGN.md "Segmented Tabs"): chip track, white active segment.
// tabs: [{ value, label, count?, icon? }]
export default function Tabs({ tabs, value, onChange, size = 'md', className = '', label = 'Sections' }) {
  const pad = size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-sm'

  return (
    <div role="tablist" aria-label={label} className={`inline-flex max-w-full overflow-x-auto scrollbar-none gap-1 p-1 rounded-control bg-surface-chip ${className}`}>
      {tabs.map(({ value: v, label: l, count, icon: Icon }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={[
              'inline-flex items-center gap-1.5 rounded-[7px] whitespace-nowrap transition-colors',
              pad,
              active ? 'bg-surface text-text font-semibold shadow-[0_1px_2px_rgb(28_33_30/0.08)]' : 'text-text-muted hover:text-text',
            ].join(' ')}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} />}
            {l}
            {count != null && <span className="tabular-nums text-text-muted font-normal">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
