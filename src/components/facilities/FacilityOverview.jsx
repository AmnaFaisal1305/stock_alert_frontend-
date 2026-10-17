// Multi-facility dashboard pieces shared by the UC and district dashboards.
import { useState, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ArrowRight, TrendingDown, CheckCircle2, HelpCircle } from 'lucide-react'
import Button, { buttonClasses } from '../ui/Button'
import ViewToggle from '../ui/ViewToggle'
import Card, { CardHeader } from '../shared/Card'
import StatCard from '../shared/StatCard'
import Table from '../shared/Table'
import { useViewMode } from '../../hooks/useViewMode'
import { facilityStatusMap, countByStatus, worstFirst, facilityColumns, FacilityMobileCard, FacilityGridCard } from './facilityTable'
import { statusConfig } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'

// Names the worst facilities; `action` is { to, label } for the role's next step.
export function FacilityAlert({ critical, low, action }) {
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
      {action && (
        <Link to={action.to} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
          {action.label} <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      )}
    </div>
  )
}

// Facilities × vaccines, doses in store. Each cell pairs its colour with a dot and a screen-reader label.
// groupByDistrict: system-wide view, one header row per district.
export function StockMatrix({ rows, base, groupByDistrict = false }) {
  const { vaccines, facilities } = useMemo(() => {
    const vaccines = new Map()
    const facilities = new Map()
    rows.forEach((r) => {
      if (!vaccines.has(r.vaccineId)) vaccines.set(r.vaccineId, displayVaccineName(r.vaccineName))
      if (!facilities.has(r.facilityId)) facilities.set(r.facilityId, { id: r.facilityId, name: r.facilityName, district: r.districtName ?? '', cells: new Map() })
      facilities.get(r.facilityId).cells.set(r.vaccineId, r)
    })
    return {
      vaccines: [...vaccines].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      facilities: [...facilities.values()].sort((a, b) =>
        (groupByDistrict && a.district.localeCompare(b.district)) || a.name.localeCompare(b.name)),
    }
  }, [rows, groupByDistrict])

  if (!vaccines.length) return null

  return (
    <Card padding={false} className="mt-6">
      <CardHeader className="px-4 sm:px-5 pt-4 pb-3" title="Stock by vaccine" description="Doses in store at each facility. The small figure is the critical threshold." />
      {/* relative: keeps the absolutely positioned sr-only labels inside the scroll box */}
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
            {facilities.map((f, i) => (
              <Fragment key={f.id}>
              {groupByDistrict && f.district !== facilities[i - 1]?.district && (
                <tr className="bg-surface-alt">
                  <th scope="rowgroup" colSpan={vaccines.length + 1} className="sticky left-0 px-4 py-2 text-left text-xs font-semibold text-text">{f.district || 'Unknown district'}</th>
                </tr>
              )}
              <tr className="hover:bg-surface-alt">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-medium text-text whitespace-nowrap">
                  <Link to={`${base}/facilities/${f.id}`} className="hover:text-primary hover:underline">{f.name}</Link>
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const KPIS = [
  { status: 'critical', label: 'Critical',    icon: AlertCircle,  context: (n) => (n ? 'Restock now' : 'None critical') },
  { status: 'low',      label: 'Low',         icon: TrendingDown, context: (n) => (n ? 'Plan a delivery' : 'None low') },
  { status: 'adequate', label: 'Normal',      icon: CheckCircle2, context: () => 'Stock is healthy' },
  { status: 'no_data',  label: 'Not updated', icon: HelpCircle,   context: (n) => (n ? 'No stock recorded yet' : 'All reporting') },
]

// Alert + KPI cards that filter one worst-first facility table + stock matrix.
// `facilities` from GET /api/facilities, `dashboard` from GET /api/dashboard (same scope).
export function FacilityBoard({ facilities: list, dashboard, base, alertAction }) {
  const [filter, setFilter] = useState(null)
  const [view, setView] = useViewMode(`board${base.replace('/', '-')}`)

  const { facilities, statusOf, counts, columns } = useMemo(() => {
    const map = facilityStatusMap(dashboard)
    const statusOf = (f) => map.get(f.id) ?? 'no_data'
    const facilities = [...list].sort(worstFirst(statusOf))
    return { facilities, statusOf, counts: countByStatus(facilities, statusOf), columns: facilityColumns(statusOf, base) }
  }, [dashboard, list, base])

  const visible = filter ? facilities.filter((f) => statusOf(f) === filter) : facilities

  return (
    <>
      <FacilityAlert
        critical={facilities.filter((f) => statusOf(f) === 'critical')}
        low={facilities.filter((f) => statusOf(f) === 'low')}
        action={alertAction}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {KPIS.map(({ status, label, icon, context }) => (
          <StatCard
            key={status}
            label={label}
            icon={icon}
            accent={status}
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
          <div className="flex items-center gap-2">
            {filter
              ? <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>Show all</Button>
              : <Link to={`${base}/facilities`} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>Search facilities <ArrowRight size={14} strokeWidth={1.75} /></Link>}
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
        <Table
          columns={columns}
          rows={visible}
          view={view}
          gridCard={(f) => <FacilityGridCard f={f} status={statusOf(f)} base={base} />}
          emptyMessage={filter ? 'No facilities in this status.' : 'No facilities in this area yet.'}
          mobileCard={(f) => <FacilityMobileCard f={f} status={statusOf(f)} base={base} />}
        />
      </section>

      <StockMatrix rows={dashboard?.facilities ?? []} base={base} />
    </>
  )
}
