export default function StatCard({ label, value, icon: Icon, colorClass = 'text-primary', subtitle }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 flex items-center gap-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full">
      {Icon && (
        <div className={`p-3 rounded-xl bg-slate-50 ${colorClass} flex-shrink-0 flex items-center justify-center`}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider truncate">{label}</p>
        <p className="text-2xl font-extrabold text-text mt-0.5 tracking-tight">{value}</p>
        {subtitle && <p className="text-[10px] text-text-muted/75 font-medium mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}
