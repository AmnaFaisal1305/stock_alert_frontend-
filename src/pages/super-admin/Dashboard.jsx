import { useMemo, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Map as MapIcon, AlertCircle, AlertTriangle, Building2, Activity, TrendingUp, ArrowRight, LayoutGrid, Table2 } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { getDashboard, getDistricts } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../hooks/useTheme'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import { facilityStatus, districtStatus, statusConfig, gaugeHex } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'

// Status colours for Recharts (concrete hex — SVG attributes can't resolve CSS vars).
const C = {
  adequate: gaugeHex('adequate'),
  low:      gaugeHex('low'),
  critical: gaugeHex('critical'),
  no_data:  gaugeHex('no_data'),
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-surface-border rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
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
    <div className="bg-surface border border-surface-border rounded-xl shadow-lg px-3.5 py-3 text-xs min-w-[160px]">
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
      <div className="border-t border-surface-border mt-2 pt-2 flex justify-between">
        <span className="text-text-muted">Total</span>
        <span className="font-bold text-text tabular-nums">{total}</span>
      </div>
    </div>
  )
}

const FILTERS = [
  { key: 'all',      label: 'All'      },
  { key: 'critical', label: 'Critical' },
  { key: 'low',      label: 'Low'      },
  { key: 'adequate', label: 'Normal'   },
]

// ── Admin Alert Banner ────────────────────────────────────────────────────────
function AdminAlertBanner({ criticalCount, lowCount, criticalDistricts }) {
  if (criticalCount > 0) {
    return (
      <div className="bg-danger-bg border border-danger/20 rounded-2xl px-4 sm:px-5 py-4 flex items-start sm:items-center gap-3 sm:gap-4 flex-wrap">
        <div className="relative flex-shrink-0 mt-0.5 sm:mt-0">
          <span className="absolute inline-flex h-5 w-5 rounded-full bg-danger/30 animate-ping" />
          <AlertCircle size={22} className="relative text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-danger-dark">
            {criticalCount} facilit{criticalCount > 1 ? 'ies' : 'y'} critically low
            {criticalDistricts > 0 ? ` across ${criticalDistricts} district${criticalDistricts > 1 ? 's' : ''}` : ''} — immediate action required
          </p>
          <p className="text-xs text-danger-dark/70 mt-0.5">Review affected districts and coordinate restocking as soon as possible</p>
          <Link to="/super-admin/districts" className="inline-flex items-center gap-1 text-xs font-semibold text-danger-dark hover:underline mt-1 sm:hidden">
            View Districts <ArrowRight size={12} />
          </Link>
        </div>
        <Link to="/super-admin/districts" className="hidden sm:flex items-center gap-1 text-xs font-semibold text-danger-dark hover:underline flex-shrink-0">
          View Districts <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  if (lowCount > 0) {
    return (
      <div className="bg-warning-bg border border-warning/20 rounded-2xl px-4 sm:px-5 py-4 flex items-start sm:items-center gap-3 sm:gap-4 flex-wrap">
        <AlertTriangle size={20} className="text-warning flex-shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-warning-dark">
            {lowCount} facilit{lowCount > 1 ? 'ies' : 'y'} running low on stock
          </p>
          <p className="text-xs text-warning-dark/70 mt-0.5">Plan restocking before levels become critical</p>
          <Link to="/super-admin/districts" className="inline-flex items-center gap-1 text-xs font-semibold text-warning-dark hover:underline mt-1 sm:hidden">
            View Districts <ArrowRight size={12} />
          </Link>
        </div>
        <Link to="/super-admin/districts" className="hidden sm:flex items-center gap-1 text-xs font-semibold text-warning-dark hover:underline flex-shrink-0">
          View Districts <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  return null
}

// ── Card shell (reference: flat, 18px radius, hairline border, no resting shadow) ─
function Panel({ children, className = '' }) {
  return (
    <div className={`bg-surface rounded-card border border-surface-border ${className}`}>
      {children}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const { user } = useAuth()
  const { resolved } = useTheme()
  const [activeFilter, setActiveFilter] = useState('all')
  const [districtView, setDistrictView] = useState('card')

  // Theme-aware chart neutrals (Recharts SVG attrs can't read CSS vars).
  const axisColor   = resolved === 'dark' ? '#9aa39c' : '#94A3B8'
  const gridColor   = resolved === 'dark' ? '#303631' : '#E2E8F0'
  const tickStrong  = resolved === 'dark' ? '#ecefeb' : '#0F172A'

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
      { name: 'Normal',  value: counts.adequate, color: C.adequate },
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
        Normal:   d.statusCounts.adequate,
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
        <div className="h-[88px] bg-surface-alt rounded-card" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-surface border border-surface-border rounded-card" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 h-[340px] bg-surface border border-surface-border rounded-card" />
          <div className="lg:col-span-3 h-[340px] bg-surface border border-surface-border rounded-card" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map((i) => <div key={i} className="h-28 bg-surface border border-surface-border rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-danger-bg border border-danger/20 text-xs font-semibold text-danger-dark rounded-xl px-4 py-3">
        Failed to load system dashboard. Please try refreshing.
      </div>
    )
  }

  const stackedH = Math.max(stackedBarData.length * 46 + 20, 120)

  const filteredDistricts = activeFilter === 'all'
    ? districts
    : districts.filter((d) => d.status === activeFilter)

  return (
    <div className="animate-in fade-in duration-200">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        breadcrumb="Super Admin › System overview"
        title={`${greeting()}${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle="All districts — system-wide clinical stock status overview"
        actions={
          <span className="inline-flex items-center gap-2 bg-success-bg text-success-dark text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Live · Auto-refreshing
          </span>
        }
      />

      <div className="flex flex-col gap-6">

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
            subtitle={`${counts.adequate} Normal · ${counts.low} Low · ${counts.critical} Critical`}
          />
          <StatCard
            icon={Building2}
            label="Total Facilities"
            value={fStats.totalFacilities}
            colorClass="text-text-muted"
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
            <StatCard icon={MapIcon}   label="Towns"          value={townCount} colorClass="text-info"    subtitle="Administrative towns" />
            <StatCard icon={Building2} label="Union Councils"  value={ucCount}   colorClass="text-primary" subtitle="Registered union councils" />
          </div>
        )}

        {/* ── Row 1: Donut + Stacked Bar ──────────────────────────────────── */}
        {counts.total > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Donut — district health distribution */}
            <Panel className="lg:col-span-2 flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary-bg flex items-center justify-center flex-shrink-0">
                  <Activity size={13} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text leading-none">District Health</p>
                  <p className="text-[11px] text-text-muted mt-1">Status distribution across network</p>
                </div>
              </div>
              <div className="flex-1 p-5 flex flex-col">
                <div className="relative h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData} cx="50%" cy="50%"
                        innerRadius={64} outerRadius={90}
                        paddingAngle={donutData.length > 1 ? 3 : 0}
                        dataKey="value" animationBegin={0} animationDuration={900} strokeWidth={0}
                      >
                        {donutData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <ReTooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-4xl font-light text-text tabular-nums leading-none">{counts.total}</p>
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mt-1.5">Districts</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {donutData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 bg-surface-alt rounded-xl px-3 py-2.5 border border-surface-border">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-[11px] font-semibold text-text-muted flex-1 truncate">{d.name}</span>
                      <span className="text-sm font-bold text-text tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            {/* Stacked horizontal bar — top 10 districts by criticality */}
            <Panel className="lg:col-span-3 flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary-bg flex items-center justify-center flex-shrink-0">
                    <Building2 size={13} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text leading-none">Facility Breakdown</p>
                    <p className="text-[11px] text-text-muted mt-1">Top {stackedBarData.length} most critical districts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {[
                    { label: 'Critical', color: C.critical },
                    { label: 'Low',      color: C.low      },
                    { label: 'Normal',   color: C.adequate },
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
                    <BarChart data={stackedBarData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barSize={16} barCategoryGap="35%">
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: axisColor }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: tickStrong, fontWeight: 600 }} width={112} tickLine={false} axisLine={false} />
                      <ReTooltip content={<StackedBarTooltip />} cursor={{ fill: gridColor, fillOpacity: 0.3 }} />
                      <Bar dataKey="Critical" stackId="s" fill={C.critical} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Low"      stackId="s" fill={C.low}      radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Normal"   stackId="s" fill={C.adequate} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
          </div>
        )}

        {/* ── Vaccine Live Stock & Consumption Matrix ─────────────────────── */}
        {vaccineColumns.length > 0 && matrixDistricts.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Vaccine Live Stock &amp; Consumption</p>
            <Panel className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + vaccineColumns.length * 160}px` }}>
                  <thead>
                    <tr className="bg-surface-alt border-b border-surface-border">
                      <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-3 text-left whitespace-nowrap border-r border-surface-border sticky left-0 bg-surface-alt z-10">
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
                      <Fragment key={d.districtId}>
                        <tr className="bg-primary-bg border-y border-surface-border">
                          <td colSpan={vaccineColumns.length + 1} className="px-4 py-2 text-[10px] font-bold text-primary uppercase tracking-widest sticky left-0 bg-primary-bg">
                            {d.districtName}
                          </td>
                        </tr>
                        {[...d.facilities.values()].sort((a, b) => a.name.localeCompare(b.name)).map((fRow) => (
                          <tr key={fRow.id} className="border-b border-surface-border hover:bg-surface-alt/50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-text whitespace-nowrap border-r border-surface-border sticky left-0 bg-surface z-10">
                              {fRow.name}
                            </td>
                            {vaccineColumns.map((v) => {
                              const cell = fRow.vaccines.get(v.id)
                              if (!cell) {
                                return <td key={v.id} className="px-4 py-3 text-center text-text-muted bg-surface-alt/40">—</td>
                              }
                              const cfg = statusConfig(cell.status)
                              return (
                                <td key={v.id} className={`px-4 py-3 text-center ${cfg.bg}/40`}>
                                  <p className="font-bold text-text tabular-nums">{cell.quantity ?? '—'}</p>
                                  {cell.consumed > 0 && (
                                    <p className="text-[10px] text-text-muted mt-0.5">{cell.consumed} consumed</p>
                                  )}
                                  {cell.wasted > 0 && (
                                    <p className="text-[10px] text-warning-dark mt-0.5">{cell.wasted} wasted</p>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* ── District Breakdown ──────────────────────────────────────────── */}
        {districts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div>
                <p className="text-base font-medium text-text">District Breakdown</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {filteredDistricts.length} of {districts.length} district{districts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Card / Table toggle */}
                <div className="flex items-center gap-0.5 bg-surface-chip rounded-lg p-0.5">
                  <button
                    onClick={() => setDistrictView('card')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${districtView === 'card' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'}`}
                  >
                    <LayoutGrid size={12} /> Cards
                  </button>
                  <button
                    onClick={() => setDistrictView('table')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${districtView === 'table' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'}`}
                  >
                    <Table2 size={12} /> Table
                  </button>
                </div>
                {/* Status filter chips (reference: neutral chips, not saturated) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {FILTERS.map(({ key, label }) => {
                    const cnt = key === 'all' ? counts.total : counts[key]
                    const isActive = activeFilter === key
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveFilter(key)}
                        className={[
                          'px-3 py-1 rounded-full text-[11px] font-semibold transition-colors border',
                          isActive
                            ? 'bg-surface-chip text-text border-transparent'
                            : 'bg-surface text-text-muted border-surface-border hover:text-text',
                        ].join(' ')}
                      >
                        {label}
                        <span className="ml-1 tabular-nums opacity-75">({cnt})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {districtView === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredDistricts.map((d) => {
                  const cfg = statusConfig(d.status)
                  return (
                    <div key={d.id} className={`bg-surface rounded-xl border border-surface-border border-l-4 ${cfg.borderL} p-4`}>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <p className="text-sm font-semibold text-text leading-snug line-clamp-2">{d.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-text-muted mb-2">
                        {d.facilityCount} facilit{d.facilityCount !== 1 ? 'ies' : 'y'}
                      </p>
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        {d.statusCounts.adequate > 0 && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig('adequate').bg} ${statusConfig('adequate').text}`}>{d.statusCounts.adequate} Normal</span>
                        )}
                        {d.statusCounts.low > 0 && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig('low').bg} ${statusConfig('low').text}`}>{d.statusCounts.low} Low</span>
                        )}
                        {d.statusCounts.critical > 0 && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig('critical').bg} ${statusConfig('critical').text}`}>{d.statusCounts.critical} Critical</span>
                        )}
                        {d.statusCounts.no_data > 0 && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig('no_data').bg} ${statusConfig('no_data').text}`}>{d.statusCounts.no_data} No Data</span>
                        )}
                        {d.facilityCount === 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-chip text-text-muted">No facilities</span>
                        )}
                      </div>
                      <Link to={`/super-admin/districts/${d.id}`} className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
                        View Details <ArrowRight size={10} />
                      </Link>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Panel className="overflow-hidden">
                <div className="hidden sm:grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_120px] px-5 py-3 bg-surface-alt border-b border-surface-border gap-3 items-center">
                  {['District', 'Status', 'Facilities', 'Critical', 'Low', 'Normal', ''].map((h) => (
                    <span key={h} className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{h}</span>
                  ))}
                </div>
                {filteredDistricts.length === 0 && (
                  <div className="px-6 py-10 text-center text-sm text-text-muted">No districts match current filter.</div>
                )}
                {filteredDistricts.map((d) => {
                  const cfg = statusConfig(d.status)
                  return (
                    <div key={d.id} className="border-b border-surface-border last:border-b-0">
                      {/* Mobile */}
                      <div className="sm:hidden px-4 py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-text truncate">{d.name}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">{d.facilityCount} facilities · {d.statusCounts.critical} Critical · {d.statusCounts.low} Low</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                          <Link to={`/super-admin/districts/${d.id}`} className="text-[10px] font-bold text-primary hover:underline">View</Link>
                        </div>
                      </div>
                      {/* Desktop */}
                      <div className="hidden sm:grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_120px] px-5 py-3 gap-3 items-center hover:bg-surface-alt/60 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapIcon size={13} className="text-text-muted/60 flex-shrink-0" />
                          <span className="font-semibold text-sm text-text truncate">{d.name}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        <span className="text-sm text-text tabular-nums">{d.facilityCount}</span>
                        <span className={`text-sm font-semibold tabular-nums ${d.statusCounts.critical > 0 ? 'text-danger' : 'text-text-muted'}`}>{d.statusCounts.critical}</span>
                        <span className={`text-sm font-semibold tabular-nums ${d.statusCounts.low > 0 ? 'text-warning-dark' : 'text-text-muted'}`}>{d.statusCounts.low}</span>
                        <span className={`text-sm font-semibold tabular-nums ${d.statusCounts.adequate > 0 ? 'text-success-dark' : 'text-text-muted'}`}>{d.statusCounts.adequate}</span>
                        <Link to={`/super-admin/districts/${d.id}`} className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5">
                          View Details <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </Panel>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
