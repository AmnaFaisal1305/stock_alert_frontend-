// Icon actions for a table row or grid card. Callers pass only the actions the current role
// may take. actions: [{ icon, label, onClick, danger?, to? }]; label is the tooltip and the
// accessible name. `to` renders a router Link instead of a button.
import { Link } from 'react-router-dom'

const base = 'w-8 h-8 grid place-items-center rounded-control transition-colors flex-shrink-0'
const tone = (danger) => (danger ? 'text-danger-dark hover:bg-danger-bg' : 'text-text-muted hover:bg-primary-bg hover:text-primary')

export default function RowActions({ actions, className = '' }) {
  const list = actions.filter(Boolean)
  if (!list.length) return null
  return (
    // Stop row/card clicks from firing when an action is used.
    <div className={`flex items-center gap-0.5 ${className}`} onClick={(e) => e.stopPropagation()}>
      {list.map(({ icon: Icon, label, onClick, danger, to, disabled }) =>
        to ? (
          <Link key={label} to={to} title={label} aria-label={label} className={`${base} ${tone(danger)}`}>
            <Icon size={16} strokeWidth={1.75} />
          </Link>
        ) : (
          <button key={label} type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={`${base} ${tone(danger)} disabled:opacity-40 disabled:pointer-events-none`}>
            <Icon size={16} strokeWidth={1.75} />
          </button>
        ),
      )}
    </div>
  )
}
