import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import { getDashboard, getFacilities } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Button, { buttonClasses } from '../../components/ui/Button'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import Table from '../../components/shared/Table'
import Card, { CardHeader } from '../../components/shared/Card'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { statusConfig } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'
import { plural } from '../../lib/format'
import { facilityStatusMap, countByStatus, worstFirst, facilityColumns, FacilityMobileCard } from './facilityTable'

const KPIS = [
  { status: 'critical', label: 'Critical',    context: (n) => (n ? 'Restock now' : 'None critical') },
  { status: 'low',      label: 'Low',         context: (n) => (n ? 'Plan a delivery' : 'None low') },
  { status: 'adequate', label: 'Normal',      context: () => 'Stock is healthy' },
  { status: 'no_data',  label: 'Not updated', context: (n) => (n ? 'No stock recorded yet' : 'All reporting') },
]

function FacilityAlert({ critical, low }) {
  const isCritical = critical.length > 0
  const list = isCritical ? critical : low
  if (!list.length) return null
  const names = list.slice(0, 3).map((f) => f.name).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '')
  const Icon = isCritical ? AlertCircle : AlertTriangle
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card px-4 sm:px-5 py-3.5 mb-5 ${isCritical ? 'bg-danger-bg text-danger-dark' : 'bg-warning-bg text-warning-dark'}`}>
      <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
      <p className="text-sm flex-1 min-w-[14rem]">
        <span className="font-semibold">{names}</span> {list.length === 1 ? 'has' : 'have'} {isCritical ? 'critically low' : 'low'} stock.
      </p>
      <Link to="/uc/stock-requests" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
        Open stock requests <ArrowRight size={14} strokeWidth={1.75} />
      </Link>
    </div>
  )
}

// Facilities × vaccines, doses in store. Each cell pairs its colour with a dot and a title.
function StockMatrix({ rows }) {
  const { vaccines, facilities } = useMemo(() => {
    const vaccines = new Map()
    const facilities = new Map()
    rows.forEach((r) => {
      if (!vaccines.has(r.vaccineId)) vaccines.set(r.vaccineId, displayVaccineName(r.vaccineName))
      if (!facilities.has(r.facilityId)) facilities.set(r.facilityId, { id: r.facilityId, name: r.facilityName, cells: new Map() })
      facilities.get(r.facilityId).cells.set(r.vaccineId, r)
    })
    return {
      vaccines: [...vaccines].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      facilities: [...facilities.values()].sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [rows])

  if (!vaccines.length) return null

  return (
    <Card padding={false} className="mt-6">
      <CardHeader className="px-4 sm:px-5 pt-4 pb-3" title="Stock by vaccine" description="Doses in store at each facility. The small figure is the critical threshold." />
      <div className="relative overflow-x-auto border-t border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-xs font-medium text-text-muted">
              <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left whitespace-nowrap">Facility</th>
              {vaccines.map((v) => (
                <th key={v.id} scope="col" className="px-3 py-2.5 text-right whitespace-nowrap" dir="auto">{v.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {facilities.map((f) => (
              <tr key={f.id} className="hover:bg-surface-alt">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-medium text-text whitespace-nowrap">
                  <Link to={`/uc/facilities/${f.id}`} className="hover:text-primary hover:underline">{f.name}</Link>
                </th>
                {vaccines.map((v) => {
                  const c = f.cells.get(v.id)
                  if (!c || c.quantity == null) return <td key={v.id} className="px-3 py-2.5 text-right text-text-muted">—</td>
                  const cfg = statusConfig(c.status)
                  return (
                    <td key={v.id} className="px-3 py-2.5 text-right whitespace-nowrap" title={`${v.name}: ${cfg.label}`}>
                      <span className={`inline-flex items-center gap-1.5 font-medium ${c.status === 'adequate' ? 'text-text' : cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
                        {c.quantity}
                        <span className="sr-only"> doses, {cfg.label}</span>
                      </span>
                      {c.criticalDoses != null && <span className="block text-xs text-text-muted">min {c.criticalDoses}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function UCSupervisorDashboard() {
  const { user } = useAuth()
  const [filter, setFilter] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  const facilitiesQ = useQuery({ queryKey: ['facilities'], queryFn: getFacilities, staleTime: 30_000 })

  const { facilities, statusOf, counts, columns } = useMemo(() => {
    const map = facilityStatusMap(data)
    const statusOf = (f) => map.get(f.id) ?? 'no_data'
    const facilities = [...(facilitiesQ.data?.facilities ?? [])].sort(worstFirst(statusOf))
    return { facilities, statusOf, counts: countByStatus(facilities, statusOf), columns: facilityColumns(statusOf) }
  }, [data, facilitiesQ.data])

  const visible = filter ? facilities.filter((f) => statusOf(f) === filter) : facilities

  return (
    <div>
      <PageHeader
        size="display"
        breadcrumb="UC Supervisor › Dashboard"
        title={user.ucNames?.length ? user.ucNames.join(' · ') : 'My union councils'}
        subtitle={facilities.length ? `${plural(facilities.length, 'facility', 'facilities')} in your union councils` : undefined}
        actions={<Link to="/uc/stock-requests" className={buttonClasses()}>Stock requests</Link>}
      />

      {isError || facilitiesQ.isError ? (
        <ErrorState title="Couldn’t load the dashboard" error={error ?? facilitiesQ.error} onRetry={() => { refetch(); facilitiesQ.refetch() }} />
      ) : isLoading || facilitiesQ.isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : (
        <>
          <FacilityAlert
            critical={facilities.filter((f) => statusOf(f) === 'critical')}
            low={facilities.filter((f) => statusOf(f) === 'low')}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            {KPIS.map(({ status, label, context }) => (
              <StatCard
                key={status}
                label={label}
                value={counts[status]}
                unit={counts[status] === 1 ? 'facility' : 'facilities'}
                tone={counts[status] > 0 && status !== 'no_data' ? status : undefined}
                subtitle={context(counts[status])}
                onClick={() => setFilter((f) => (f === status ? null : status))}
                active={filter === status}
              />
            ))}
          </div>

          <section aria-labelledby="facilities-heading">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="facilities-heading" className="text-base font-semibold text-text">
                {filter ? `${statusConfig(filter).label} facilities` : 'Facilities'}
                <span className="ml-2 text-sm font-normal text-text-muted">{visible.length}</span>
              </h2>
              {filter
                ? <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>Show all</Button>
                : <Link to="/uc/facilities" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>Search facilities <ArrowRight size={14} strokeWidth={1.75} /></Link>}
            </div>
            <Table
              columns={columns}
              rows={visible}
              emptyMessage={filter ? 'No facilities in this status.' : 'No facilities assigned to your union councils yet.'}
              mobileCard={(f) => <FacilityMobileCard f={f} status={statusOf(f)} />}
            />
          </section>

          <StockMatrix rows={data?.facilities ?? []} />
        </>
      )}
    </div>
  )
}
