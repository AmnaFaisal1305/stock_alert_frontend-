import { Building2 } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function DistrictCard({ district }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 flex flex-col justify-between min-h-[120px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-red-50 text-primary mt-0.5">
            <Building2 size={16} />
          </div>
          <div>
            <h3 className="font-bold text-text text-sm leading-tight">{district.name}</h3>
            <p className="text-xs text-text-muted mt-1">{district.facilityCount} facilities</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <StatusBadge status={district.status} />
        </div>
      </div>
    </div>
  )
}
