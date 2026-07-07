import StatusBadge from './StatusBadge'

export default function FacilityCard({ facility }) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-text text-sm leading-tight">{facility.name}</h3>
        <StatusBadge status={facility.status} />
      </div>
    </div>
  )
}
