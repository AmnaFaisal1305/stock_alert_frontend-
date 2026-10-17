import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getDashboard, getDistricts } from '../../lib/api'
import { useChartTheme } from '../../hooks/useChartTheme'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import StatusBadge from '../../components/shared/StatusBadge'
import Table from '../../components/shared/Table'
import FilterChips from '../../components/shared/FilterChips'
import Card, { CardHeader } from '../../components/shared/Card'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { FacilityAlert, StockMatrix } from '../../components/facilities/FacilityOverview'
import { facilityStatus, districtStatus, STATUS_RANK } from '../../lib/status'
import { plural } from '../../lib/format'

const SERIES = [
  { key: 'critical', label: 'Critical' },
  { key: 'low',      label: 'Low' },
  { key: 'adequate', label: 'Normal' },
  { key: 'no_data',  label: 'Not updated' },
]

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-surface-border rounded-control shadow-float px-3.5 py-2.5 text-xs min-w-[150px]">
      <p className="font-semibold text-text mb-1.5">{label}</p>
      {payload.filter((p) => p.value > 0).map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-text-muted">
            <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} aria-hidden="true" />{p.name}
          </span>
          <span className="font-medium text-text tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// Facilities per district split by status — the worst ten districts.
function DistrictBars({ districts }) {
  const t = useChartTheme()
  const data = [...districts]
    .filter((d) => d.facilityCount > 0)
    .sort((a, b) => b.counts.critical - a.counts.critical || b.counts.low - a.counts.low)
    .slice(0, 10)
    .map((d) => ({ name: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name, ...d.counts }))
  if (!data.length) return null

  return (
    <Card className="mb-5">
      <CardHeader
        title="Facilities by district"
        description={`Worst ${plural(data.length, 'district')} first`}
        action={
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: t.status(s.key) }} aria-hidden="true" />{s.label}
              </li>
            ))}
          </ul>
        }
      />
      <div className="mt-4" style={{ height: Math.max(data.length * 40 + 24, 120) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barSize={14}>
            <CartesianGrid horizontal={false} stroke={t.grid} />
            <XAxis type="number" tick={t.tick} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ ...t.tick, fill: t.tickStrong }} tickLine={false} axisLine={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: t.grid, fillOpacity: 0.4 }} />
            {SERIES.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="s" isAnimationActive={false} fill={t.status(s.key)} radius={i === SERIES.length - 1 ? [0, 3, 3, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

const num = (n, status) => (
  <span className={`tabular-nums ${n > 0 && status === 'critical' ? 'text-danger-dark font-medium' : n > 0 && status === 'low' ? 'text-warning-dark font-medium' : n ? '' : 'text-text-muted'}`}>{n}</span>
)

const districtColumns = [
  { key: 'name', label: 'District', render: (d) => <Link to={`/super-admin/districts/${d.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary hover:underline">{d.name}</Link> },
  { key: 'status', label: 'Status', render: (d) => <StatusBadge status={d.status} /> },
  { key: 'facilities', label: 'Facilities', align: 'right', render: (d) => <span className="tabular-nums">{d.facilityCount}</span> },
  { key: 'critical', label: 'Critical', align: 'right', render: (d) => num(d.counts.critical, 'critical') },
  { key: 'low', label: 'Low', align: 'right', render: (d) => num(d.counts.low, 'low') },
  { key: 'adequate', label: 'Normal', align: 'right', render: (d) => num(d.counts.adequate) },
  { key: 'no_data', label: 'Not updated', align: 'right', render: (d) => num(d.counts.no_data) },
]

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  const { data: districtData } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })

  const { districts, facilities, matrixRows } = useMemo(() => {
    const byId = new Map((districtData?.districts ?? []).map((d) => [d.id, {
      id: d.id, name: d.name, facilityCount: 0, statuses: [],
      counts: { critical: 0, low: 0, adequate: 0, no_data: 0 },
    }]))
    const facilities = (data?.summary?.byFacility ?? []).map((f) => ({ name: f.facilityName, status: facilityStatus(f.statusCounts), districtId: f.districtId }))
    for (const f of facilities) {
      if (!byId.has(f.districtId)) {
        byId.set(f.districtId, { id: f.districtId, name: f.districtId, facilityCount: 0, statuses: [], counts: { critical: 0, low: 0, adequate: 0, no_data: 0 } })
      }
      const d = byId.get(f.districtId)
      d.facilityCount++
      d.statuses.push(f.status)
      d.counts[f.status]++
    }
    const districts = [...byId.values()]
      .map((d) => ({ ...d, status: districtStatus(d.statuses) }))
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name))
    const matrixRows = (data?.facilities ?? []).map((r) => ({ ...r, districtName: r.districtName ?? byId.get(r.districtId)?.name }))
    return { districts, facilities, matrixRows }
  }, [data, districtData])

  const fCount = (s) => facilities.filter((f) => f.status === s).length
  const dCount = (s) => districts.filter((d) => d.status === s).length
  const healthy = fCount('adequate')
  const healthPct = facilities.length ? Math.round((healthy / facilities.length) * 100) : 0
  const visible = filter === 'all' ? districts : districts.filter((d) => d.status === filter)

  const s = data?.summary
  const subtitle = [
    plural(districts.length, 'district'),
    s?.townCount ? plural(s.townCount, 'town') : null,
    s?.ucCount ? plural(s.ucCount, 'union council') : null,
    plural(facilities.length, 'facility', 'facilities'),
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <PageHeader size="display" breadcrumb="Super Admin › Dashboard" title="System overview" subtitle={isLoading ? undefined : subtitle} />

      {isError ? (
        <ErrorState title="Couldn’t load the system dashboard" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : (
        <>
          <FacilityAlert
            critical={facilities.filter((f) => f.status === 'critical')}
            low={facilities.filter((f) => f.status === 'low')}
            action={{ to: '/super-admin/facilities', label: 'Review facilities' }}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            <StatCard label="Districts" value={districts.length} subtitle={`${dCount('critical')} critical · ${dCount('low')} low`} />
            <StatCard label="Facilities" value={facilities.length} subtitle={`${fCount('no_data')} not updated yet`} />
            <StatCard label="Critical facilities" value={fCount('critical')} tone={fCount('critical') ? 'critical' : undefined} subtitle={fCount('critical') ? 'Restock now' : 'None critical'} />
            <StatCard
              label="Facilities healthy"
              value={`${healthPct}%`}
              tone={healthPct >= 80 ? 'adequate' : healthPct >= 50 ? 'low' : 'critical'}
              subtitle={`${healthy} of ${facilities.length} at normal stock`}
            />
          </div>

          <DistrictBars districts={districts} />

          <section aria-labelledby="districts-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 id="districts-heading" className="text-base font-semibold text-text">Districts</h2>
              <FilterChips
                label="District status"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All', count: districts.length },
                  { value: 'critical', label: 'Critical', status: 'critical', count: dCount('critical') },
                  { value: 'low', label: 'Low', status: 'low', count: dCount('low') },
                  { value: 'adequate', label: 'Normal', status: 'adequate', count: dCount('adequate') },
                ]}
              />
            </div>
            <Table
              columns={districtColumns}
              rows={visible}
              onRowClick={(d) => navigate(`/super-admin/districts/${d.id}`)}
              emptyMessage="No districts in this status."
              mobileCard={(d) => (
                <button type="button" onClick={() => navigate(`/super-admin/districts/${d.id}`)} className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-surface-alt">
                  <div className="min-w-0">
                    <p className="font-medium text-text truncate">{d.name}</p>
                    <p className="text-xs text-text-muted tabular-nums">
                      {plural(d.facilityCount, 'facility', 'facilities')} · {d.counts.critical} critical · {d.counts.low} low
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </button>
              )}
            />
          </section>

          <StockMatrix
            rows={matrixRows}
            base="/super-admin"
            groupByDistrict
          />
        </>
      )}
    </div>
  )
}
