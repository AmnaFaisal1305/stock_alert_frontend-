import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Syringe } from 'lucide-react'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import StatusBadge from '../../components/shared/StatusBadge'
import FilterChips from '../../components/shared/FilterChips'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { STATUS_RANK, statusConfig } from '../../lib/status'

const STATUS_ORDER = Object.keys(STATUS_RANK)

function quantityText(row) {
  if (row.quantity === null) return <span className="text-text-muted">{statusConfig('no_data').label}</span>
  if (row.quantity === 0) return <span className="text-danger-dark font-medium">Out of stock</span>
  return <>{row.quantity}<span className="text-xs text-text-muted ml-1">doses</span></>
}

export default function WorkerStatusView() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 20_000,
    staleTime: 10_000,
  })

  const { rows, facilityName, districtName, counts } = useMemo(() => {
    const rows = (data?.facilities ?? [])
      .filter((r) => r.facilityId === user?.facilityId)
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, rows.filter((r) => r.status === s).length]))
    return { rows, facilityName: rows[0]?.facilityName, districtName: rows[0]?.districtName, counts }
  }, [data, user?.facilityId])

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const options = [
    { value: 'all', label: 'All', count: rows.length },
    ...STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => ({ value: s, label: statusConfig(s).label, count: counts[s], status: s })),
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Stock Status"
        subtitle={facilityName ? `${facilityName}${districtName ? ` · ${districtName} District` : ''}` : 'Current stock at your facility'}
      />

      {isError ? (
        <ErrorState title="Couldn’t load stock status" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : rows.length === 0 ? (
        <EmptyState
          framed
          icon={Syringe}
          title="No vaccines set up yet"
          message="Ask your facility supervisor to add vaccines and thresholds for this facility."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <FilterChips options={options} value={filter} onChange={setFilter} label="Filter by status" />
          <Card padding={false}>
            <ul className="divide-y divide-surface-border">
              {visible.map((row) => (
                <li key={row.vaccineId} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_7rem] items-center gap-x-3 gap-y-1.5 px-4 sm:px-5 py-3.5">
                  <p className="min-w-0 truncate text-base font-medium text-text" dir="auto">{row.vaccineName}</p>
                  <p className="sm:order-last text-right tabular-nums text-sm text-text">{quantityText(row)}</p>
                  <div className="col-span-2 sm:col-span-1"><StatusBadge status={row.status} /></div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}
