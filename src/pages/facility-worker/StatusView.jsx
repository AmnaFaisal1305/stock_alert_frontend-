import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'

export default function WorkerStatusView() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 20_000,
  })

  if (isLoading) return <p className="text-text-muted text-sm pt-4">Loading…</p>
  if (isError)   return <p className="text-danger text-sm pt-4">Failed to load status.</p>

  const rows = (data?.facilities ?? []).filter((r) => r.facilityId === user?.facilityId)
  const facilityName = rows[0]?.facilityName

  return (
    <div className="flex flex-col gap-6 max-w-sm mx-auto pt-4">
      <div>
        <h1 className="text-xl font-bold text-text">Stock Status</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {facilityName ? `${facilityName} — read only` : 'Current stock at your facility — read only'}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-text-muted text-sm">No vaccines configured for this facility yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div
              key={`${row.facilityId}-${row.vaccineId}`}
              className="bg-surface rounded-xl border border-surface-border px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-sm text-text">{row.vaccineName}</p>
                <p className="text-xs text-text-muted">{row.quantity ?? '—'} doses</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
