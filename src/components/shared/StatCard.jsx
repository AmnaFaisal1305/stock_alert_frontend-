export default function StatCard({ label, value, icon: Icon, colorClass = 'text-primary', subtitle, unit }) {
  return (
    <div className="relative bg-surface rounded-card border border-surface-border p-4 sm:p-5 w-full">
      {Icon && (
        <div className={`absolute top-4 right-4 w-9 h-9 rounded-xl bg-surface-alt ${colorClass} flex items-center justify-center`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
      )}
      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider truncate pr-10">{label}</p>
      <p className="text-3xl sm:text-[34px] font-light text-text mt-2.5 leading-none tracking-tight tabular-nums">{value}</p>
      {unit && <p className="text-xs font-semibold text-text-muted mt-1.5 truncate">{unit}</p>}
      {subtitle && <p className="text-xs text-text-muted mt-1.5 truncate">{subtitle}</p>}
    </div>
  )
}
