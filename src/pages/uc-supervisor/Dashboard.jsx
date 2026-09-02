import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, AlertCircle, CheckCircle2, Building2,
  ArrowRight, Search, X, ChevronDown, Check, MapPin, Layers,
} from 'lucide-react'
import { getDashboard, getFacilities } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/shared/StatCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { facilityStatus, statusConfig } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'

function timeAgo(isoStr) {
  if (!isoStr) return null
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function UCSupervisorDashboard() {
  const { user } = useAuth()
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const { data: facilityData } = useQuery({
    queryKey: ['facilities'],
    queryFn:  getFacilities,
    staleTime: 30_000,
  })

  const facilityCount = data?.summary?.facilityCount ?? (data?.summary?.byFacility ?? []).length

  const { byFacility, counts } = useMemo(() => {
    const byFacility = (data?.summary?.byFacility ?? []).map((f) => ({
      id: f.facilityId, name: f.facilityName,
      status: facilityStatus(f.statusCounts), statusCounts: f.statusCounts,
    }))
    const counts = {
      critical: byFacility.filter((f) => f.status === 'critical').length,
      low:      byFacility.filter((f) => f.status === 'low').length,
      adequate: byFacility.filter((f) => f.status === 'adequate').length,
    }
    return { byFacility, counts }
  }, [data])

  const statusByFacilityId = useMemo(
    () => new Map(byFacility.map((f) => [f.id, f.status])),
    [byFacility]
  )

  const facilities = facilityData?.facilities ?? []

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (search) {
        const q = search.toLowerCase()
        const ok = f.name?.toLowerCase().includes(q) ||
          (f.ucName   ?? '').toLowerCase().includes(q) ||
          (f.townName ?? '').toLowerCase().includes(q)
        if (!ok) return false
      }
      if (statusFilter) {
        const st = statusByFacilityId.get(f.id) ?? 'no-data'
        if (st !== statusFilter) return false
      }
      return true
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [facilities, search, statusFilter, statusByFacilityId])

  // Vaccine matrix
  const { vaccineColumns, facilityRows } = useMemo(() => {
    const rawRows = data?.facilities ?? []
    const vaccineMap = new Map()
    rawRows.forEach((r) => {
      if (!vaccineMap.has(r.vaccineId)) vaccineMap.set(r.vaccineId, displayVaccineName(r.vaccineName))
    })
    const vaccineColumns = [...vaccineMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const facilityMap = new Map()
    rawRows.forEach((r) => {
      if (!facilityMap.has(r.facilityId))
        facilityMap.set(r.facilityId, { id: r.facilityId, name: r.facilityName, vaccines: new Map() })
      facilityMap.get(r.facilityId).vaccines.set(r.vaccineId, r)
    })
    const facilityRows = [...facilityMap.values()].sort((a, b) => a.name.localeCompare(b.name))
    return { vaccineColumns, facilityRows }
  }, [data])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-24 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-slate-50 border border-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
        Failed to load dashboard. Please try refreshing.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header banner */}
      <div className="bg-primary rounded-2xl px-6 py-5">
        <p className="text-sm text-white/70 font-semibold">
          {user.ucNames?.length ? user.ucNames.join(' · ') : 'UC Supervisor Dashboard'}
        </p>
        <p className="text-white font-bold text-lg mt-1">{user.name}</p>
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="bg-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-xl font-bold text-white">{facilityCount}</span>
            <span className="text-xs font-semibold text-white/70">Facilities</span>
          </div>
        </div>
      </div>

      {/* Alert banners */}
      {counts.critical > 0 && (
        <div className="bg-danger-bg border border-danger/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <span className="absolute inline-flex h-5 w-5 rounded-full bg-danger/30 animate-ping" />
            <AlertCircle size={22} className="relative text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-danger">
              {counts.critical} facilit{counts.critical > 1 ? 'ies' : 'y'} critically low — immediate action required
            </p>
            <p className="text-xs text-danger/70 mt-0.5">Restock as soon as possible to avoid service interruption</p>
          </div>
          <Link to="/uc/facilities" className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline flex-shrink-0">
            View Facilities <ArrowRight size={12} />
          </Link>
        </div>
      )}
      {counts.low > 0 && counts.critical === 0 && (
        <div className="bg-warning-bg border border-warning/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <AlertTriangle size={20} className="text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-warning-dark">
              {counts.low} facilit{counts.low > 1 ? 'ies' : 'y'} running low on stock
            </p>
            <p className="text-xs text-warning-dark/70 mt-0.5">Plan restocking before levels become critical</p>
          </div>
          <Link to="/uc/facilities" className="flex items-center gap-1 text-xs font-semibold text-warning-dark hover:underline flex-shrink-0">
            View Facilities <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Vaccine Stock Status — 3 stat cards */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Vaccine Stock Status</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Critical"
            value={counts.critical}
            icon={AlertCircle}
            colorClass={counts.critical > 0 ? 'text-danger' : 'text-text-muted'}
            unit={`${counts.critical} critical facilit${counts.critical !== 1 ? 'ies' : 'y'}`}
            subtitle={counts.critical > 0 ? 'Requires immediate action' : 'All clear'}
          />
          <StatCard
            label="Low Stock"
            value={counts.low}
            icon={AlertTriangle}
            colorClass={counts.low > 0 ? 'text-warning-dark' : 'text-text-muted'}
            unit={`${counts.low} facilit${counts.low !== 1 ? 'ies' : 'y'} low on stock`}
            subtitle={counts.low > 0 ? 'Action suggested' : 'Levels healthy'}
          />
          <StatCard
            label="Normal"
            value={counts.adequate}
            icon={CheckCircle2}
            colorClass="text-success-dark"
            unit={`${counts.adequate} facilit${counts.adequate !== 1 ? 'ies' : 'y'} stable`}
            subtitle="Stock levels healthy"
          />
        </div>
      </div>

      {/* Facility Performance */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Facility Performance</h2>
          <Link to="/uc/facilities" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight size={11} />
          </Link>
        </div>

        {/* Search + Status filter pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-56">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search facilities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
            />
          </div>

          {[
            { value: '',         label: 'All'      },
            { value: 'critical', label: 'Critical' },
            { value: 'low',      label: 'Low Stock'},
            { value: 'adequate', label: 'Normal'   },
            { value: 'no-data',  label: 'No Data'  },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={[
                'px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                statusFilter === opt.value
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-text-muted border-surface-border hover:border-primary/40 hover:text-text',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}

          {(search || statusFilter) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setStatusFilter('') }}
              className="text-xs font-bold text-text-muted hover:text-primary transition-colors px-1"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
          <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_80px] px-5 py-3 bg-slate-50 border-b border-surface-border gap-4 items-center">
            {['Facility', 'Town', 'UC', 'Supervisor', 'Last Activity', 'Status'].map((h) => (
              <span key={h} className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{h}</span>
            ))}
          </div>

          {filteredFacilities.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-text-muted">
              {search ? `No facilities match "${search}".` : 'No facilities found.'}
            </div>
          ) : (
            filteredFacilities.map((f) => {
              const stockStatus = statusByFacilityId.get(f.id)
              const stockCfg   = stockStatus ? statusConfig(stockStatus) : null
              const lastAct    = timeAgo(f.lastActivityAt)
              return (
                <div
                  key={f.id}
                  className={`grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_80px] px-5 py-4 gap-4 items-center border-b border-surface-border last:border-b-0 hover:bg-slate-50/60 transition-colors border-l-4 ${
                    stockStatus === 'critical' ? 'border-l-danger' : stockStatus === 'low' ? 'border-l-warning' : 'border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={13} className="text-text-muted/60 flex-shrink-0" />
                    <Link to={`/uc/facilities/${f.id}`} className="font-bold text-text text-sm truncate hover:text-primary transition-colors">
                      {f.name}
                    </Link>
                  </div>
                  <p className="text-xs font-medium text-text-muted truncate">{f.townName ?? '—'}</p>
                  <p className="text-xs font-medium text-text-muted truncate">{f.ucName ?? '—'}</p>
                  <p className="text-xs font-medium text-text truncate">{f.facilitySupervisorName ?? <span className="text-text-muted italic">Unstaffed</span>}</p>
                  <p className="text-xs text-text-muted font-medium">{lastAct ?? <span className="italic">Never</span>}</p>
                  <div>
                    {stockCfg ? (
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${stockCfg.bg} ${stockCfg.text}`}>
                        {stockCfg.label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-muted">—</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Vaccine Live Stock Matrix */}
      {vaccineColumns.length > 0 && facilityRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Vaccine Live Stock &amp; Consumption</h2>
          <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + vaccineColumns.length * 150}px` }}>
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
                <tbody className="divide-y divide-surface-border">
                  {facilityRows.map((fRow) => (
                    <tr key={fRow.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text whitespace-nowrap border-r border-surface-border sticky left-0 bg-white z-10">
                        {fRow.name}
                      </td>
                      {vaccineColumns.map((v) => {
                        const cell = fRow.vaccines.get(v.id)
                        if (!cell) return <td key={v.id} className="px-4 py-3 text-center text-text-muted bg-slate-50/50">—</td>
                        const bg = cell.status === 'critical' ? 'bg-danger-bg/40' : cell.status === 'low' ? 'bg-warning-bg/40' : cell.status === 'adequate' ? 'bg-success-bg/30' : 'bg-slate-50/50'
                        return (
                          <td key={v.id} className={`px-4 py-3 text-center ${bg}`}>
                            <p className="font-bold text-text tabular-nums">{cell.quantity ?? '—'}</p>
                            {(cell.criticalDoses != null || cell.criticalVials != null) && (
                              <p className="text-[10px] text-text-muted/70 mt-0.5">
                                Min: {cell.criticalDoses ?? '—'} doses / {cell.criticalVials ?? '—'} vials
                              </p>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
