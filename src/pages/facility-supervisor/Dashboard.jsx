import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, ArrowRight, Syringe, TrendingDown, CheckCircle2, CircleDashed, PackageCheck, Clock, ClipboardList, ClipboardCheck } from 'lucide-react'
import { getDashboard, getVaccines, getStockRequests, getApprovals } from '../../lib/api'
import { OPEN_STAGES } from '../../lib/stockRequests'
import AttentionStrip from '../../components/shared/AttentionStrip'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import StatCard from '../../components/shared/StatCard'
import StatusBadge from '../../components/shared/StatusBadge'
import Table from '../../components/shared/Table'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import Button, { buttonClasses } from '../../components/ui/Button'
import { STATUS_RANK, statusConfig } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'
import { timeAgo, plural, localDateStr } from '../../lib/format'

const STATUS_ICON = { critical: AlertTriangle, low: TrendingDown, adequate: CheckCircle2, no_data: CircleDashed }

const KPI_ORDER = [
  { status: 'critical', context: (n) => (n ? 'Needs immediate action' : 'None right now') },
  { status: 'low',      context: (n) => (n ? 'Plan restocking soon' : 'None right now') },
  { status: 'adequate', context: () => 'At or above threshold' },
  { status: 'no_data',  context: (n) => (n ? 'No stock recorded yet' : 'All vaccines reporting') },
].map((k) => ({ ...k, label: statusConfig(k.status).label }))

// Change in vaccine lines since summary.previous; neutral wording, status colour stays for status.
function deltaText(now, before) {
  if (before == null) return null
  const d = now - before
  return d === 0 ? 'same as last week' : `${d > 0 ? '+' : '−'}${Math.abs(d)} vs last week`
}

// Isolated so its 5s tick doesn't re-render the page.
function RefreshedAgo({ at }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [])
  const secs = Math.round((Date.now() - at) / 1000)
  if (secs < 10) return <>refreshed just now</>
  return <>refreshed {secs < 60 ? `${secs}s ago` : timeAgo(at)}</>
}

function StockAlert({ critical, low, canAct }) {
  if (!critical.length && !low.length) return null
  const isCritical = critical.length > 0
  const list = isCritical ? critical : low
  const names = list.slice(0, 3).map((r) => displayVaccineName(r.vaccineName)).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '')
  const first = list[0]
  const short = first.criticalDoses != null && first.quantity != null ? Math.max(0, first.criticalDoses - first.quantity) : 0
  const Icon = isCritical ? AlertCircle : AlertTriangle

  return (
    <div role="alert" className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card px-4 sm:px-5 py-3.5 mb-5 ${isCritical ? 'bg-danger-bg text-danger-dark' : 'bg-warning-bg text-warning-dark'}`}>
      <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
      <p className="text-sm flex-1 min-w-[14rem]">
        <span className="font-semibold">{names}</span>{' '}
        {list.length === 1 ? 'is' : 'are'} {isCritical ? 'critically low' : 'running low'}
        {list.length === 1 && first.quantity != null && (
          <> — {first.quantity} doses left{short > 0 ? `, ${short} short of the critical threshold` : ''}</>
        )}
        .
      </p>
      {canAct && (
        <Link to="/facility/record-stock" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
          Raise a stock request <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      )}
    </div>
  )
}


export default function FacilityDashboard() {
  const { user } = useAuth()
  const isSupervisor = user?.role === 'facility_supervisor'
  const [filter, setFilter] = useState(null)

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  // statusCounts counts facility × vaccine lines, the same unit as these KPI tiles.
  const compareTo = localDateStr(-7)
  const { data: compareData } = useQuery({
    queryKey: ['dashboard', 'compare', compareTo],
    queryFn: () => getDashboard({ compareTo }),
    staleTime: 10 * 60_000,
  })
  const previous = compareData?.summary?.previous?.statusCounts
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const requestsQ = useQuery({ queryKey: ['stock-requests'], queryFn: () => getStockRequests(), refetchInterval: 30_000 })
  const approvalsQ = useQuery({ queryKey: ['approvals', 'pending'], queryFn: () => getApprovals('pending') })

  const attention = useMemo(() => {
    const reqs = requestsQ.data?.stockRequests ?? []
    const stage = (s) => reqs.filter((r) => r.stage === s).length
    const stale = reqs.filter((r) => OPEN_STAGES.has(r.stage) && Date.now() - new Date(r.createdAt) > 3 * 86_400_000).length
    const pending = approvalsQ.data?.approvals?.length ?? 0
    return isSupervisor
      ? [
          { icon: PackageCheck, accent: 4, count: stage('awaiting_received'), label: 'stock requests to record as received', to: '/facility/record-stock' },
          { icon: AlertTriangle, accent: 'low', count: stage('figures_differ'), label: 'requests where sent and received differ', to: '/facility/record-stock' },
          { icon: Clock, accent: 'low', count: stale, label: 'requests open for over 3 days', to: '/facility/record-stock' },
          { icon: ClipboardList, accent: 2, count: pending, label: 'approval requests waiting for the Facility Head', to: '/facility/approvals' },
        ]
      : [
          { icon: ClipboardCheck, accent: 'low', count: pending, label: 'approvals waiting for you', to: '/head/approvals' },
          { icon: PackageCheck, accent: 4, count: stage('ready_for_approval'), label: 'stock requests ready to sign off', to: '/head/stock-requests' },
          { icon: Clock, accent: 'low', count: stale, label: 'requests open for over 3 days', to: '/head/stock-requests' },
        ]
  }, [requestsQ.data, approvalsQ.data, isSupervisor])

  const { rows, counts, nameById, facilityName, districtName, critical, low } = useMemo(() => {
    const rows = (data?.facilities ?? [])
      .filter((r) => r.facilityId === user.facilityId)
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    const counts = Object.fromEntries(KPI_ORDER.map(({ status }) => [status, rows.filter((r) => r.status === status).length]))
    return {
      rows,
      counts,
      nameById: Object.fromEntries(rows.map((r) => [r.vaccineId, displayVaccineName(r.vaccineName)])),
      facilityName: rows[0]?.facilityName,
      districtName: rows[0]?.districtName,
      critical: rows.filter((r) => r.status === 'critical'),
      low: rows.filter((r) => r.status === 'low'),
    }
  }, [data, user.facilityId])

  const dpvById = useMemo(
    () => Object.fromEntries((vaccineData?.vaccines ?? []).map((v) => [v.id, v.dosesPerVial])),
    [vaccineData],
  )

  const visible = filter ? rows.filter((r) => r.status === filter) : rows

  const columns = [
    { key: 'vaccine', label: 'Vaccine', render: (r) => <span className="font-medium whitespace-nowrap" dir="auto">{displayVaccineName(r.vaccineName)}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'stock', label: 'In stock', align: 'right',
      render: (r) => r.quantity == null ? <span className="text-text-muted">—</span> : (
        <span className="tabular-nums whitespace-nowrap">
          {r.quantity} <span className="text-xs text-text-muted">doses</span>
          {dpvById[r.vaccineId] ? <span className="block text-xs text-text-muted">{Math.round(r.quantity / dpvById[r.vaccineId])} vials</span> : null}
        </span>
      ),
    },
    {
      key: 'threshold', label: 'Critical / low', align: 'right',
      render: (r) => r.criticalDoses == null && r.lowDoses == null
        ? <span className="text-text-muted">Not set</span>
        : <span className="tabular-nums text-text-muted">{r.criticalDoses ?? '—'} / {r.lowDoses ?? '—'}</span>,
    },
    { key: 'consumed', label: 'Used', align: 'right', render: (r) => <span className="tabular-nums">{r.consumed ?? '—'}</span> },
    { key: 'wasted', label: 'Wasted (30d)', align: 'right', render: (r) => <span className="tabular-nums">{r.wasted ?? '—'}</span> },
    {
      key: 'recorded', label: 'Last recorded', align: 'right',
      render: (r) => r.recordedAt ? <span className="text-text-muted">{timeAgo(r.recordedAt)}</span> : <span className="text-warning-dark">Never</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        size="display"
        breadcrumb={isSupervisor ? 'Facility Supervisor › Dashboard' : 'Facility Head › Dashboard'}
        title={facilityName ?? 'Facility dashboard'}
        subtitle={<>{districtName ? `${districtName} District · ` : ''}{dataUpdatedAt ? <RefreshedAgo at={dataUpdatedAt} /> : 'Loading…'}</>}
        actions={isSupervisor && (
          <>
            <Link to="/facility/workers" className={buttonClasses({ variant: 'secondary' })}>Vaccinators</Link>
            <Link to="/facility/approvals" className={buttonClasses({ variant: 'secondary' })}>Thresholds</Link>
            <Link to="/facility/record-stock" className={buttonClasses()}>Stock Requests</Link>
          </>
        )}
      />

      {isError ? (
        <ErrorState title="Couldn’t load the dashboard" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : rows.length === 0 ? (
        <EmptyState
          framed
          icon={Syringe}
          title="No vaccines set up for this facility"
          message="Vaccines are added by the system administrator. Once they are, stock and status appear here."
        />
      ) : (
        <>
          <StockAlert critical={critical} low={low} canAct={isSupervisor} />

          <AttentionStrip items={attention} loading={requestsQ.isLoading || approvalsQ.isLoading} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            {KPI_ORDER.map(({ status, label, context }) => (
              <StatCard
                key={status}
                label={label}
                icon={STATUS_ICON[status]}
                accent={status}
                value={counts[status]}
                tone={counts[status] > 0 && status !== 'no_data' ? status : undefined}
                subtitle={[context(counts[status]), previous && deltaText(counts[status], previous[status] ?? 0)].filter(Boolean).join(' · ')}
                onClick={() => setFilter((f) => (f === status ? null : status))}
                active={filter === status}
              />
            ))}
          </div>

          <section aria-labelledby="stock-heading">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="stock-heading" className="text-base font-semibold text-text">
                {filter ? `${statusConfig(filter).label} vaccines` : 'Vaccine stock'}
                <span className="ml-2 text-sm font-normal text-text-muted">{plural(visible.length, 'vaccine')}</span>
              </h2>
              {filter && <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>Show all</Button>}
            </div>
            <Table
              columns={columns}
              rows={visible}
              rowKey={(r) => r.vaccineId}
              emptyMessage="No vaccines in this status."
              mobileCard={(r) => (
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-text truncate" dir="auto">{displayVaccineName(r.vaccineName)}</p>
                    <p className="text-sm tabular-nums text-text flex-shrink-0">{r.quantity ?? '—'} <span className="text-xs text-text-muted">doses</span></p>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <StatusBadge status={r.status} />
                    <p className="text-xs text-text-muted">{r.recordedAt ? `Recorded ${timeAgo(r.recordedAt)}` : 'Not updated yet'}</p>
                  </div>
                </div>
              )}
            />
          </section>
        </>
      )}
    </div>
  )
}
