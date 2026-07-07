import { useQuery } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, CheckCircle2, Syringe } from 'lucide-react'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'
import SkeletonCard from '../../components/shared/SkeletonCard'

function SummaryPill({ icon: Icon, label, count, colorClass }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${colorClass}`}>
      <Icon size={12} />
      {count} {label}
    </div>
  )
}

function StockCard({ row }) {
  const status      = row.status === 'no_data' ? 'amber' : row.status
  const pct         = row.minQuantity > 0
    ? Math.min(Math.round(((row.quantity ?? 0) / row.minQuantity) * 100), 100)
    : 100
  const borderColor = status === 'red' ? 'border-l-danger'  : status === 'amber' ? 'border-l-warning'  : 'border-l-success'
  const barColor    = status === 'red' ? 'bg-danger'         : status === 'amber' ? 'bg-warning'         : 'bg-success'

  return (
    <div className={`bg-surface rounded-xl border border-surface-border border-l-4 ${borderColor} px-4 py-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-text">{row.vaccineName}</p>
        <StatusBadge status={status} />
      </div>
      <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>{row.quantity ?? '—'} doses</span>
        <span>min {row.minQuantity}</span>
      </div>
    </div>
  )
}

export default function WorkerStatusView() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 20_000,
  })

  const rows          = (data?.facilities ?? []).filter((r) => r.facilityId === user?.facilityId)
  const facilityName  = rows[0]?.facilityName
  const okCount       = rows.filter((r) => r.status === 'green').length
  const lowCount      = rows.filter((r) => r.status === 'amber' || r.status === 'no_data').length
  const criticalCount = rows.filter((r) => r.status === 'red').length

  return (
    <div className="flex flex-col gap-6 max-w-sm mx-auto pt-4">
      <div>
        <h1 className="text-xl font-bold text-text">Stock Status</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {facilityName ? `${facilityName} — read only` : 'Current stock at your facility — read only'}
        </p>
      </div>

      {isError && <p className="text-sm text-danger">Failed to load status.</p>}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <SummaryPill icon={CheckCircle2} label="OK" count={okCount}
            colorClass="bg-success-bg border-success/30 text-success-dark" />
          <SummaryPill icon={AlertTriangle} label="Low" count={lowCount}
            colorClass="bg-warning-bg border-warning/30 text-warning-dark" />
          <SummaryPill icon={AlertCircle} label="Critical" count={criticalCount}
            colorClass="bg-danger-bg border-danger/30 text-danger" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {isLoading
          ? [1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={2} />)
          : rows.map((row) => (
              <StockCard key={`${row.facilityId}-${row.vaccineId}`} row={row} />
            ))
        }
      </div>

      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center py-16 border border-dashed border-surface-border rounded-xl text-text-muted">
          <Syringe size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold text-text">No vaccines configured</p>
          <p className="text-sm mt-1">Ask your facility supervisor to add vaccines.</p>
        </div>
      )}
    </div>
  )
}
