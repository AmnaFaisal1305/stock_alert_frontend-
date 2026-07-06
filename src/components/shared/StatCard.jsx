export default function StatCard({ label, value, icon: Icon, colorClass = 'text-primary' }) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 flex items-center gap-4">
      {Icon && (
        <div className={`p-3 rounded-lg bg-surface-alt ${colorClass}`}>
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="text-sm text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
      </div>
    </div>
  )
}
