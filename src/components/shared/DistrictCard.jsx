import { Building2 } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { statusConfig } from '../../lib/status'

export default function DistrictCard({ district }) {
  const counts = district.statusCounts
  const cfg = statusConfig(district.status)

  const borderClass =
    district.status === 'critical' ? 'border-danger/25' :
    district.status === 'low'      ? 'border-warning/20' :
    'border-surface-border'

  return (
    <div className={[
      'bg-white rounded-2xl border overflow-hidden shadow-sm',
      'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
      borderClass,
    ].join(' ')}>

      {/* Status accent bar — color matches district worst status */}
      <div className={`h-1 ${cfg.dot}`} />

      <div className="p-5 flex flex-col gap-0">
        {/* Header row: icon + name + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${cfg.bg}`}>
              <Building2 size={15} className={cfg.text} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h3
                className="font-bold text-text text-sm leading-tight truncate"
                title={district.name}
              >
                {district.name}
              </h3>
              <p className="text-xs text-text-muted mt-0.5 font-medium tabular-nums">
                {district.facilityCount === 0
                  ? 'No facilities yet'
                  : `${district.facilityCount} ${district.facilityCount === 1 ? 'facility' : 'facilities'}`}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <StatusBadge status={district.status} />
          </div>
        </div>

        {/* Facility breakdown chips */}
        {counts && (counts.critical > 0 || counts.low > 0 || counts.adequate > 0) && (
          <div className="flex gap-1.5 mt-4 pt-3.5 border-t border-slate-100 flex-wrap">
            {counts.critical > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-danger-bg text-danger border border-danger/10 tabular-nums">
                {counts.critical} Critical
              </span>
            )}
            {counts.low > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-warning-bg text-warning-dark border border-warning/10 tabular-nums">
                {counts.low} Low
              </span>
            )}
            {counts.adequate > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-success-bg text-success-dark border border-success/10 tabular-nums">
                {counts.adequate} Healthy
              </span>
            )}
          </div>
        )}

        {/* Empty district — no facilities assigned */}
        {district.facilityCount === 0 && (
          <div className="mt-4 pt-3.5 border-t border-slate-100">
            <p className="text-[11px] text-text-muted/70 font-medium italic">
              No facilities assigned — awaiting setup
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
