import { Building2 } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function FacilityCard({ facility }) {
  const counts = facility.statusCounts

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 flex flex-col justify-between shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-red-50 text-primary mt-0.5 flex-shrink-0">
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-text text-sm leading-snug truncate" title={facility.name}>{facility.name}</h3>
            {facility.districtName && (
              <p className="text-[10px] text-text-muted mt-1 uppercase tracking-wider font-bold">{facility.districtName}</p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          <StatusBadge status={facility.status} />
        </div>
      </div>

      {counts && (counts.critical > 0 || counts.low > 0 || counts.adequate > 0) && (
        <div className="flex gap-1.5 mt-4 pt-3.5 border-t border-slate-100 flex-wrap">
          {counts.critical > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-danger-bg text-danger border border-danger/10">
              {counts.critical} Critical
            </span>
          )}
          {counts.low > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-warning-bg text-warning-dark border border-warning/10">
              {counts.low} Low
            </span>
          )}
          {counts.adequate > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-success-bg text-success-dark border border-success/10">
              {counts.adequate} Healthy
            </span>
          )}
        </div>
      )}
    </div>
  )
}
