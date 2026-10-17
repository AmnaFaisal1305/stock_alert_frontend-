// What's missing + the action that fixes it. Sits inside a Card or Table; no frame of its own
// unless `framed` (standalone on the page).
export default function EmptyState({ icon: Icon, title, message, action, framed = false, className = '' }) {
  return (
    <div className={`text-center px-6 py-12 ${framed ? 'bg-surface border border-surface-border rounded-card' : ''} ${className}`}>
      {Icon && <Icon size={20} strokeWidth={1.75} className="mx-auto mb-3 text-text-muted" aria-hidden="true" />}
      <p className="text-sm font-medium text-text">{title}</p>
      {message && <p className="text-sm text-text-muted mt-1 max-w-sm mx-auto">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
