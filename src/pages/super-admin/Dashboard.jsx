import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Map as MapIcon, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { getDashboard, getDistricts } from '../../lib/api'
import DistrictCard from '../../components/shared/DistrictCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { worstStatus, FILTERS } from '../../lib/status'

export default function SuperAdminDashboard() {
  const [statusFilter, setStatusFilter] = useState(0)

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

  // Memoized: rebuilding districtMap on every 15s poll render is wasteful
  const { districts, counts } = useMemo(() => {
    const districtNameById = Object.fromEntries(
      (districtData?.districts ?? []).map((d) => [d.id, d.name])
    )

    const districtMap = new Map()
    for (const d of (districtData?.districts ?? [])) {
      districtMap.set(d.id, {
        id: d.id, name: d.name,
        facilityStatuses: [], facilityCount: 0,
        statusCounts: { adequate: 0, low: 0, critical: 0 },
      })
    }
    for (const f of (data?.summary?.byFacility ?? [])) {
      if (!districtMap.has(f.districtId)) {
        districtMap.set(f.districtId, {
          id: f.districtId, name: districtNameById[f.districtId] ?? f.districtId,
          facilityStatuses: [], facilityCount: 0,
          statusCounts: { adequate: 0, low: 0, critical: 0 },
        })
      }
      const d = districtMap.get(f.districtId)
      const fStatus = worstStatus(f.statusCounts)
      d.facilityStatuses.push(fStatus)
      d.facilityCount += 1
      if (fStatus === 'adequate')                          d.statusCounts.adequate += 1
      else if (fStatus === 'low' || fStatus === 'no_data') d.statusCounts.low      += 1
      else if (fStatus === 'critical')                     d.statusCounts.critical  += 1
    }

    const districts = Array.from(districtMap.values()).map((d) => ({
      id: d.id, name: d.name, facilityCount: d.facilityCount,
      status: worstStatus(d.facilityStatuses.length ? d.facilityStatuses : ['no_data']),
      statusCounts: d.statusCounts,
    }))

    const counts = {
      total:    districts.length,
      adequate: districts.filter((d) => d.status === 'adequate').length,
      low:      districts.filter((d) => d.status === 'low').length,
      critical: districts.filter((d) => d.status === 'critical').length,
    }
    return { districts, counts }
  }, [data, districtData])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-5 bg-slate-100 rounded-lg w-48" />
        <div className="h-[88px] bg-slate-50 border border-slate-200 rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[100px] bg-slate-50 border border-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={3} />)}
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* ── Page Header — AKUH maroon banner ───────────────────────── */}
      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            System Dashboard
          </h1>
          <p className="text-sm text-white/70 mt-0.5">
            All districts — system-wide clinical stock status overview
          </p>
        </div>
        {/* Live indicator */}
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

      {/* ── Total Districts Banner ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
        <div className="h-1 bg-primary" />
        <div className="px-6 py-5 flex items-center gap-5">
          <div className="p-3.5 rounded-xl bg-primary/5 flex-shrink-0">
            <MapIcon size={22} className="text-primary" strokeWidth={2.2} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Total Districts
            </p>
            <p className="text-3xl font-extrabold text-text tracking-tight mt-0.5 tabular-nums">
              {counts.total}
            </p>
            <p className="text-xs text-text-muted font-medium mt-0.5">
              {counts.total === 1 ? 'district' : 'districts'} registered in the AKUH network
            </p>
          </div>

          {/* Mini breakdown — hidden on small screens */}
          {counts.total > 0 && (
            <div className="hidden md:flex flex-col items-end gap-2.5 flex-shrink-0">
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success-dark">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  {counts.adequate} OK
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-warning-dark">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  {counts.low} Low
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-danger">
                  <span className="w-2 h-2 rounded-full bg-danger" />
                  {counts.critical} Critical
                </span>
              </div>
              {/* Proportional breakdown bar */}
              <div className="w-48 h-2 rounded-full bg-slate-100 overflow-hidden flex">
                {counts.adequate > 0 && (
                  <div
                    className="h-full bg-success"
                    style={{ width: `${(counts.adequate / counts.total) * 100}%` }}
                  />
                )}
                {counts.low > 0 && (
                  <div
                    className="h-full bg-warning"
                    style={{ width: `${(counts.low / counts.total) * 100}%` }}
                  />
                )}
                {counts.critical > 0 && (
                  <div
                    className="h-full bg-danger"
                    style={{ width: `${(counts.critical / counts.total) * 100}%` }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status Breakdown ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">

        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Status Breakdown</span>
          <span className="text-[10px] font-semibold text-text-muted/70 tabular-nums">
            {counts.total} {counts.total === 1 ? 'district' : 'districts'} total
          </span>
        </div>

        <div className="px-6 py-4 flex items-center divide-x divide-surface-border">

          {/* OK */}
          <div className="flex items-center gap-3 flex-1 pr-6">
            <div className="p-1.5 rounded-md bg-success-bg flex-shrink-0">
              <CheckCircle2 size={13} className="text-success-dark" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text">OK — Adequate</p>
              <p className="text-[11px] text-success-dark font-medium">
                {counts.adequate === counts.total && counts.total > 0 ? 'All systems healthy' : counts.adequate > 0 ? 'Running stable' : '—'}
              </p>
            </div>
            <span className="text-2xl font-extrabold text-text tabular-nums ml-auto">{counts.adequate}</span>
          </div>

          {/* Low */}
          <div className="flex items-center gap-3 flex-1 px-6">
            <div className={`p-1.5 rounded-md flex-shrink-0 ${counts.low > 0 ? 'bg-warning-bg' : 'bg-slate-50'}`}>
              <AlertTriangle size={13} className={counts.low > 0 ? 'text-warning-dark' : 'text-text-muted'} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text">Low Stock</p>
              <p className={`text-[11px] font-medium ${counts.low > 0 ? 'text-warning-dark' : 'text-text-muted'}`}>
                {counts.low > 0 ? 'Action suggested' : 'Levels healthy'}
              </p>
            </div>
            <span className={`text-2xl font-extrabold tabular-nums ml-auto ${counts.low > 0 ? 'text-warning-dark' : 'text-text'}`}>{counts.low}</span>
          </div>

          {/* Critical */}
          <div className={`flex items-center gap-3 flex-1 pl-6 ${counts.critical > 0 ? 'rounded-r-2xl' : ''}`}>
            <div className={`p-1.5 rounded-md flex-shrink-0 ${counts.critical > 0 ? 'bg-danger-bg' : 'bg-slate-50'}`}>
              <AlertCircle size={13} className={counts.critical > 0 ? 'text-danger' : 'text-text-muted'} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text">Critical</p>
              <p className={`text-[11px] font-medium ${counts.critical > 0 ? 'text-danger' : 'text-text-muted'}`}>
                {counts.critical > 0 ? 'Immediate action needed' : 'All clear'}
              </p>
            </div>
            <span className={`text-2xl font-extrabold tabular-nums ml-auto ${counts.critical > 0 ? 'text-danger' : 'text-text'}`}>{counts.critical}</span>
          </div>

        </div>
      </div>

      {/* ── Districts Grid ───────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Districts Status
          </h2>

          <div className="flex items-center gap-1.5 bg-white border border-surface-border rounded-xl p-1 shadow-sm">
            {FILTERS.map((f, i) => {
              const active = statusFilter === i
              const count =
                f.label === 'Critical' ? counts.critical :
                f.label === 'Low'      ? counts.low :
                f.label === 'OK'       ? counts.adequate :
                counts.total
              const colorClass =
                f.label === 'Critical' ? (active ? 'bg-danger text-white' : 'text-danger hover:bg-danger/5') :
                f.label === 'Low'      ? (active ? 'bg-warning text-white' : 'text-warning-dark hover:bg-warning/5') :
                f.label === 'OK'       ? (active ? 'bg-success text-white' : 'text-success-dark hover:bg-success/5') :
                (active ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-50')
              const badgeClass =
                f.label === 'Critical' ? (active ? 'bg-white/20 text-white' : 'bg-danger/10 text-danger') :
                f.label === 'Low'      ? (active ? 'bg-white/20 text-white' : 'bg-warning/10 text-warning-dark') :
                f.label === 'OK'       ? (active ? 'bg-white/20 text-white' : 'bg-success/10 text-success-dark') :
                (active ? 'bg-white/20 text-white' : 'bg-slate-100 text-text-muted')
              return (
                <button
                  key={f.label}
                  onClick={() => setStatusFilter(i)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${colorClass}`}
                >
                  {f.label}
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md tabular-nums ${badgeClass}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {districts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
            <MapIcon size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold text-text">No districts found</p>
            <p className="text-xs mt-1">
              Please register districts in District Management to configure monitor channels.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {districts.filter((d) => {
                if (statusFilter !== 0 && d.status === 'no_data') return false
                return FILTERS[statusFilter].match(d.status)
              }).map((d) => (
                <DistrictCard key={d.id} district={d} />
              ))}
            </div>
            {districts.filter((d) => {
              if (statusFilter !== 0 && d.status === 'no_data') return false
              return FILTERS[statusFilter].match(d.status)
            }).length === 0 && (
              <div className="text-center py-12 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
                <p className="font-bold text-text text-sm">No {FILTERS[statusFilter].label} districts</p>
                <p className="text-xs mt-1">No districts currently match this status filter.</p>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
