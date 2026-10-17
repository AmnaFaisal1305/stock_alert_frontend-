// Resting surface: white on paper, 1px hairline, 18px radius, no shadow (DESIGN.md "Flat-By-Default").
// padding=false for cards that hold a table/list edge to edge.
export default function Card({ as: Tag = 'div', padding = true, className = '', children, ...props }) {
  return (
    <Tag className={`bg-surface border border-surface-border rounded-card ${padding ? 'p-4 sm:p-5' : 'overflow-hidden'} ${className}`} {...props}>
      {children}
    </Tag>
  )
}

// Title row inside a card: title + optional muted description + right-aligned action.
export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
