export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="text-center py-14 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
      {Icon && <Icon size={36} className="mx-auto mb-3 opacity-20" />}
      <p className="font-bold text-text">{title}</p>
      {message && <p className="text-xs mt-1 text-text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
