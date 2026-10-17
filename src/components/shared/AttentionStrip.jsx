import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { ACCENT } from './StatCard'

// "Needs attention" row on dashboards: one link per thing waiting on this user.
// items: [{ icon, accent, count, label, to }]; items with count 0 are hidden.
export default function AttentionStrip({ items, loading = false }) {
  const shown = items.filter((i) => i && i.count > 0)
  if (loading) return null
  return (
    <section aria-label="Needs attention" className="mb-6">
      {shown.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success-dark">
          <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" /> Nothing needs your attention right now.
        </p>
      ) : (
        <ul className="grid gap-2 sm:gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map(({ icon: Icon, accent, count, label, to }) => (
            <li key={label}>
              <Link
                to={to}
                className="group flex items-center gap-3 h-full rounded-card border border-surface-border bg-surface px-4 py-3 transition-colors hover:border-text-muted"
              >
                <span className={`w-9 h-9 rounded-control grid place-items-center flex-shrink-0 ${ACCENT[accent] ?? ACCENT.primary}`} aria-hidden="true">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className="flex-1 min-w-0 text-sm text-text">
                  <span className="font-semibold tabular-nums">{count}</span> {label}
                </span>
                <ChevronRight size={16} strokeWidth={1.75} className="text-text-muted group-hover:text-text flex-shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
