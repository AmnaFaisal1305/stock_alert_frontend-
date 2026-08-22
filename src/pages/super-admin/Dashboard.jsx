import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Map as MapIcon, AlertCircle, AlertTriangle, Building2, Activity, TrendingUp, ArrowRight } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { getDashboard, getDistricts } from '../../lib/api'
import SkeletonCard from '../../components/shared/SkeletonCard'
import StatCard from '../../components/shared/StatCard'
import { facilityStatus, districtStatus, statusConfig } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'

// ── Design-token colours ───────────────────────────────────────────────────────
const C = {
  adequate: '#10B981',
  low:      '#F59E0B',
  critical: '#EF4444',
  no_data:  '#CBD5E1',
  primary:  '#006241',
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-bold text-text">{payload[0].name}</p>
      <p className="text-text-muted mt-0.5">
        {payload[0].value} district{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

function StackedBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-3 text-xs min-w-[160px]">
      <p className="font-bold text-text mb-2 truncate">{label}</p>
      {[...payload].reverse().map((p) =>
        p.value > 0 ? (
          <div key={p.name} className="flex items-center justify-between gap-6 mb-1 last:mb-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
              <span className="text-text-muted">{p.name}</span>
            </span>
            <span className="font-bold text-text tabular-nums">{p.value}</span>
          </div>
        ) : null
      )}
      <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between">
        <span className="text-text-muted">Total</span>
        <span className="font-bold text-text tabular-nums">{total}</span>
      </div>
    </div>
  )
}

// ── District card config ──────────────────────────────────────────────────────
const STATUS_CFG = {
  adequate: { label: 'OK',       pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', borderL: 'border-l-emerald-400' },
  low:      { label: 'Low',      pill: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',       borderL: 'border-l-amber-400'   },
  critical: { label: 'Critical', pill: 'bg-red-50 text-red-700 ring-1 ring-red-200',             borderL: 'border-l-red-400'     },
  no_data:  { label: 'No Data',  pill: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',      borderL: 'border-l-slate-300'   },
}

const FILTERS = [
  { key: 'all',      label: 'All'      },
  { key: 'critical', label: 'Critical' },
  { key: 'low',      label: 'Low'      },
  { key: 'adequate', label: 'OK'       },
]

// ── Admin Alert Banner ────────────────────────────────────────────────────────
function AdminAlertBanner({ criticalCount, lowCount, criticalDistricts }) {
  if (criticalCount > 0) {
    return (
      <div className="bg-danger-bg border border-danger/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <span className="absolute inline-flex h-5 w-5 rounded-full bg-danger/30 animate-ping" />
          <AlertCircle size={22} className="relative text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-danger">
            {criticalCount} facilit{criticalCount > 1 ? 'ies' : 'y'} critically low
            {criticalDistricts > 0 ? ` across ${criticalDistricts} district${criticalDistricts > 1 ? 's' : ''}` : ''} — immediate action required
          </p>
          <p className="text-xs text-danger/70 mt-0.5">Review affected districts and coordinate restocking as soon as possible</p>
        </div>
        <Link to="/super-admin/districts" className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline flex-shrink-0">
          View Districts <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  if (lowCount > 0) {
    return (
      <div className="bg-warning-bg border border-warning/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <AlertTriangle size={20} className="text-warning flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-warning-dark">
            {lowCount} facilit{lowCount > 1 ? 'ies' : 'y'} running low on stock
          </p>
          <p className="text-xs text-warning-dark/70 mt-0.5">Plan restocking before levels become critical</p>
        </div>
        <Link to="/super-admin/districts" className="flex items-center gap-1 text-xs font-semibold text-warning-dark hover:underline flex-shrink-0">
          View Districts <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  return null
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const [activeFilter, setActiveFilter] = useState('all')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  const { data: districtData } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
  })

  const townCount = data?.summary?.townCount ?? 0
  const ucCount   = data?.summary?.ucCount   ?? 0

  const { counts, fStats, donutData, stackedBarData, districts, vaccineColumns, matrixDistricts } = useMemo(() => {
    const districtNameById = Object.fromEntries(
      (districtData?.districts ?? []).map((d) => [d.id, d.name])
    )

    const districtMap = new Map()
    for (const d of (districtData?.districts ?? [])) {
      districtMap.set(d.id, {
        id: d.id, name: d.name,
        facilityStatuses: [], facilityCount: 0,
        statusCounts: { adequate: 0, low: 0, critical: 0, no_data: 0 },
      })
    }

    const byFacility = data?.summary?.byFacility ?? []
    for (const f of byFacility) {
      if (!districtMap.has(f.districtId)) {
        districtMap.set(f.districtId, {
          id: f.districtId,
          name: districtNameById[f.districtId] ?? f.districtId,
          facilityStatuses: [], facilityCount: 0,
          statusCounts: { adequate: 0, low: 0, critical: 0, no_data: 0 },
        })
      }
      const d       = districtMap.get(f.districtId)
      const fStatus = facilityStatus(f.statusCounts)
      d.facilityStatuses.push(fStatus)
      d.facilityCount += 1
      if      (fStatus === 'adequate') d.statusCounts.adequate += 1
      else if (fStatus === 'low')     d.statusCounts.low      += 1
      else if (fStatus === 'critical')d.statusCounts.critical += 1
      else if (fStatus === 'no_data') d.statusCounts.no_data  += 1
    }

    const districts = Array.from(districtMap.values()).map((d) => ({
      ...d, status: districtStatus(d.facilityStatuses),
    }))

    const counts = {
      total:    districts.length,
      adequate: districts.filter((d) => d.status === 'adequate').length,
      low:      districts.filter((d) => d.status === 'low').length,
      critical: districts.filter((d) => d.status === 'critical').length,
    }

    // Facility-level KPIs
    const fStatuses       = byFacility.map((f) => facilityStatus(f.statusCounts))
    const totalFacilities = byFacility.length
    const criticalCount   = fStatuses.filter((s) => s === 'critical').length
    const lowCount        = fStatuses.filter((s) => s === 'low').length
    const adequateCount   = fStatuses.filter((s) => s === 'adequate').length
    const healthPct       = totalFacilities > 0 ? Math.round((adequateCount / totalFacilities) * 100) : 0
    const fStats          = { totalFacilities, criticalCount, lowCount, adequateCount, healthPct }

    // Donut slices
    const noDataCount = Math.max(0, districts.length - counts.adequate - counts.low - counts.critical)
    const donutData = [
      { name: 'OK',      value: counts.adequate, color: C.adequate },
      { name: 'Low',     value: counts.low,      color: C.low      },
      { name: 'Critical',value: counts.critical, color: C.critical },
      ...(noDataCount > 0 ? [{ name: 'No Data', value: noDataCount, color: C.no_data }] : []),
    ].filter((d) => d.value > 0)

    // Stacked bar — top 10 by criticality
    const stackedBarData = [...districts]
      .filter((d) => d.facilityCount > 0)
      .sort(
        (a, b) =>
          b.statusCounts.critical - a.statusCounts.critical ||
          b.statusCounts.low      - a.statusCounts.low
      )
      .slice(0, 10)
      .map((d) => ({
        name:     d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name,
        OK:       d.statusCounts.adequate,
        Low:      d.statusCounts.low,
        Critical: d.statusCounts.critical,
      }))

    // Vaccine matrix — per-district, per-vaccine
    const rawFacilityRows = data?.facilities ?? []
    const vaccineMap = new Map()
    rawFacilityRows.forEach((r) => {
      if (!vaccineMap.has(r.vaccineId)) {
        vaccineMap.set(r.vaccineId, displayVaccineName(r.vaccineName))
      }
    })
    const vaccineColumns = [...vaccineMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const districtVaccineMap = new Map()
    rawFacilityRows.forEach((r) => {
      const key = r.districtId ?? 'unknown'
      if (!districtVaccineMap.has(key)) {
        const dObj = districtMap.get(key)
        districtVaccineMap.set(key, {
          districtId: key,
          districtName: dObj?.name ?? r.districtName ?? key,
          facilities: new Map(),
        })
      }
      const dEntry = districtVaccineMap.get(key)
      const fKey   = r.facilityId
      if (!dEntry.facilities.has(fKey)) {
        dEntry.facilities.set(fKey, { id: fKey, name: r.facilityName, vaccines: new Map() })
      }
      dEntry.facilities.get(fKey).vaccines.set(r.vaccineId, r)
    })
    const matrixDistricts = [...districtVaccineMap.values()].sort((a, b) => a.districtName.localeCompare(b.districtName))

    return { counts, fStats, donutData, stackedBarData, districts, vaccineColumns, matrixDistricts }
  }, [data, districtData])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-[88px] bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-50 border border-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 h-[340px] bg-slate-50 border border-slate-200 rounded-2xl" />
          <div className="lg:col-span-3 h-[340px] bg-slate-50 border border-slate-200 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map((i) => <div key={i} className="h-28 bg-slate-50 border border-slate-200 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
        Failed to load system dashboard. Please try refreshing.
      </div>
    )
  }

  const stackedH = Math.max(stackedBarData.length * 46 + 20, 120)

  const filteredDistricts = activeFilter === 'all'
    ? districts
    : districts.filter((d) => d.status === activeFilter)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* ── Banner ──────────────────────────────────────────────────────── */}
      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">System Dashboard</h1>
          <p className="text-sm text-white/70 mt-0.5">
            All districts — system-wide clinical stock status overview
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest hidden sm:block">
            Live · Auto-refreshing
          </span>
        </div>
      </div>

      {/* ── Alert Banner ────────────────────────────────────────────────── */}
      <AdminAlertBanner
        criticalCount={fStats.criticalCount}
        lowCount={fStats.lowCount}
        criticalDistricts={counts.critical}
      />

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MapIcon}
          label="Total Districts"
          value={counts.total}
          colorClass="text-primary"
          subtitle={`${counts.adequate} OK · ${counts.low} Low · ${counts.critical} Critical`}
        />
        <StatCard
          icon={Building2}
          label="Total Facilities"
          value={fStats.totalFacilities}
          colorClass="text-secondary"
          subtitle={`Across ${counts.total} district${counts.total !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={AlertCircle}
          label="Critical Facilities"
          value={fStats.criticalCount}
          colorClass={fStats.criticalCount > 0 ? 'text-danger' : 'text-text-muted'}
          subtitle={fStats.criticalCount > 0 ? 'Immediate action required' : 'All clear'}
        />
        <StatCard
          icon={TrendingUp}
          label="Network Health"
          value={`${fStats.healthPct}%`}
          colorClass={fStats.healthPct >= 80 ? 'text-success-dark' : fStats.healthPct >= 50 ? 'text-warning-dark' : 'text-danger'}
          subtitle={`${fStats.adequateCount} of ${fStats.totalFacilities} facilities healthy`}
        />
      </div>

      {/* ── Geography Stats ─────────────────────────────────────────────── */}
      {(townCount > 0 || ucCount > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={MapIcon}
            label="Towns"
            value={townCount}
            colorClass="text-text-muted"
            subtitle="Administrative towns"
          />
          <StatCard
            icon={Building2}
            label="Union Councils"
            value={ucCount}
            colorClass="text-text-muted"
            subtitle="Registered union councils"
          />
        </div>
      )}

      {/* ── Row 1: Donut + Stacked Bar ──────────────────────────────────── */}
      {counts.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Donut — district health distribution */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden flex flex-col">
            <div className="h-1 bg-primary" />
            <div className="px-5 py-3.5 border-b border-surface-border flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
                <Activity size={13} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-text leading-none">District Health</p>
                <p className="text-[10px] text-text-muted mt-0.5">Status distribution across network</p>
              </div>
            </div>
            <div className="flex-1 p-5 flex flex-col">
              <div className="relative h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={90}
                      paddingAngle={donutData.length > 1 ? 3 : 0}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={900}
                      strokeWidth={0}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <ReTooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-4xl font-extrabold text-text tabular-nums leading-none">{counts.total}</p>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1.5">Districts</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-surface-border">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-[11px] font-semibold text-text-muted flex-1 truncate">{d.name}</span>
                    <span className="text-sm font-extrabold text-text tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stacked horizontal bar — top 10 districts by criticality */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden flex flex-col">
            <div className="h-1 bg-primary" />
            <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
                  <Building2 size={13} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text leading-none">Facility Breakdown</p>
                  <p className="text-[10px] text-text-muted mt-0.5">Top {stackedBarData.length} most critical districts</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {[
                  { label: 'Critical', color: C.critical },
                  { label: 'Low',      color: C.low      },
                  { label: 'OK',       color: C.adequate },
                ].map(({ label, color }) => (
                  <span key={label} className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-1 px-3 py-4">
              {stackedBarData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-text-muted">
                  No facility data available yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={stackedH}>
                  <BarChart
                    data={stackedBarData}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                    barSize={16}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 600 }} width={112} tickLine={false} axisLine={false} />
                    <ReTooltip content={<StackedBarTooltip />} cursor={{ fill: '#F8FAFC' }} />
                    <Bar dataKey="Critical" stackId="s" fill={C.critical} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Low"      stackId="s" fill={C.low}      radius={[0, 0, 0, 0]} />
                    <Bar dataKey="OK"       stackId="s" fill={C.adequate} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Vaccine Live Stock & Consumption Matrix ─────────────────────── */}
      {vaccineColumns.length > 0 && matrixDistricts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Vaccine Live Stock &amp; Consumption</h2>
          <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + vaccineColumns.length * 160}px` }}>
                <thead>
                  <tr className="bg-slate-50 border-b border-surface-border">
                    <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-3 text-left whitespace-nowrap border-r border-surface-border sticky left-0 bg-slate-50 z-10">
                      Facility
                    </th>
                    {vaccineColumns.map((v) => (
                      <th key={v.id} className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-3 text-center whitespace-nowrap" dir="rtl">
                        {v.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixDistricts.map((d) => (
                    <>
                      {/* District subheading row */}
                      <tr key={`district-${d.districtId}`} className="bg-primary/5 border-y border-surface-border">
                        <td
                          colSpan={vaccineColumns.length + 1}
                          className="px-4 py-2 text-[10px] font-bold text-primary uppercase tracking-widest sticky left-0 bg-primary/5"
                        >
                          {d.districtName}
                        </td>
                      </tr>
                      {/* Facility rows */}
                      {[...d.facilities.values()].sort((a, b) => a.name.localeCompare(b.name)).map((fRow) => (
                        <tr key={fRow.id} className="border-b border-surface-border hover:bg-slate-50/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-text whitespace-nowrap border-r border-surface-border sticky left-0 bg-white z-10">
                            {fRow.name}
                          </td>
                          {vaccineColumns.map((v) => {
                            const cell = fRow.vaccines.get(v.id)
                            if (!cell) {
                              return <td key={v.id} className="px-4 py-3 text-center text-text-muted bg-slate-50/50">—</td>
                            }
                            const cfg = statusConfig(cell.status)
                            return (
                              <td key={v.id} className={`px-4 py-3 text-center ${cfg.bg}/30`}>
                                <p className="font-bold text-text tabular-nums">{cell.quantity ?? '—'}</p>
                                {cell.consumed != null && (
                                  <p className="text-[10px] text-text-muted mt-0.5">{cell.consumed} consumed</p>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── District Breakdown ──────────────────────────────────────────── */}
      {districts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-text">District Breakdown</p>
              <p className="text-[10px] text-text-muted mt-0.5">
                {filteredDistricts.length} of {districts.length} district{districts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTERS.map(({ key, label }) => {
                const cnt = key === 'all' ? counts.total : key === 'adequate' ? counts.adequate : counts[key]
                const isActive = activeFilter === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={[
                      'px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 border',
                      isActive
                        ? key === 'critical' ? 'bg-red-500 text-white border-red-500'
                          : key === 'low'      ? 'bg-amber-400 text-white border-amber-400'
                          : key === 'adequate' ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-primary text-white border-primary'
                        : 'bg-white text-text-muted border-surface-border hover:text-text hover:border-slate-300',
                    ].join(' ')}
                  >
                    {label}
                    <span className="ml-1 tabular-nums opacity-75">({cnt})</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredDistricts.map((d) => {
              const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.no_data
              return (
                <div
                  key={d.id}
                  className={`bg-white rounded-xl border border-surface-border border-l-4 ${cfg.borderL} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <p className="text-sm font-bold text-text leading-snug line-clamp-2">{d.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.pill}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold text-text-muted mb-2">
                    {d.facilityCount} facilit{d.facilityCount !== 1 ? 'ies' : 'y'}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {d.statusCounts.adequate > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {d.statusCounts.adequate} OK
                      </span>
                    )}
                    {d.statusCounts.low > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {d.statusCounts.low} Low
                      </span>
                    )}
                    {d.statusCounts.critical > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                        {d.statusCounts.critical} Critical
                      </span>
                    )}
                    {d.statusCounts.no_data > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {d.statusCounts.no_data} No Data
                      </span>
                    )}
                    {d.facilityCount === 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                        No facilities
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
