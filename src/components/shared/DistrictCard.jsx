import { Building2 } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function DistrictCard({ district }) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-primary" />
          <h3 className="font-semibold text-text text-sm">{district.name}</h3>
        </div>
        <StatusBadge status={district.status} />
      </div>
      <p className="text-xs text-text-muted">{district.facilityCount} facilities</p>
    </div>
  )
}
