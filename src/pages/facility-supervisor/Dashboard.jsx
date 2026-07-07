import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'

function StockRow({ row }) {
  const pct = row.minQuantity > 0
    ? Math.round(((row.quantity ?? 0) / row.minQuantity) * 100)
    : 100

  const barColor =
    row.status === 'red'     ? 'bg-danger'   :
    row.status === 'amber'   ? 'bg-warning'  :
    row.status === 'no_data' ? 'bg-secondary' : 'bg-success'

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-text text-sm">{row.vaccineName}</p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-text-muted">
          <span>{row.quantity ?? '—'} doses</span>
          <span>min {row.minQuantity}</span>
        </div>
        <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function FacilityDashboard() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
  })

  if (isLoading) return <p className="text-text-muted">Loading dashboard…</p>
  if (isError)   return <p className="text-danger">Failed to load dashboard.</p>

  const rows = (data?.facilities ?? []).filter((r) => r.facilityId === user.facilityId)
  const facilityName = rows[0]?.facilityName
  const districtName = rows[0]?.districtName

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">Facility Dashboard — Stock Levels</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {facilityName
            ? `${facilityName}${districtName ? ` · ${districtName}` : ''}`
            : 'Current vaccine stock at your facility'}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-text-muted text-sm">No vaccines configured for this facility yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row) => (
            <StockRow key={`${row.facilityId}-${row.vaccineId}`} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
