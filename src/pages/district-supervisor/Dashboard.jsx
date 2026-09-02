import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, AlertCircle, CheckCircle2, Building2,
  User, MapPin, ArrowRight, Search, ChevronDown, Check, X, Layers,
} from 'lucide-react'
import { getDashboard, getFacilities, getTowns, getUnionCouncils } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/shared/StatCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { facilityStatus, statusConfig } from '../../lib/status'
import { displayVaccineName } from '../../lib/vaccineNames'

// ─── Filter Chip ──────────────────────────────────────────────────────────────
function FilterChip({ icon: Icon, placeholder, options, value, onChange, disabled = false }) {
  const [open, setOpen]   = useState(false)
  const [pos,  setPos]    = useState({ top: 0, left: 0, width: 0 })
  const triggerRef        = useRef(null)
  const dropdownRef       = useRef(null)
  const selected          = options.find((o) => o.value === value)
  const isActive          = !!value

  function handleToggle() {
    if (disabled) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 200) })
    setOpen((o) => !o)
  }

  function handleClear(e) {
    e.stopPropagation()
    onChange({ target: { value: '' } })
    setOpen(false)
  }

  function handleSelect(val) {
    onChange({ target: { value: val } })
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setOpen(false)
    }
    function handleScroll() { setOpen(false) }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={[
          'inline-flex items-center gap-2 rounded-xl border text-sm font-semibold transition-all cursor-pointer select-none',
          isActive
            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 pl-3.5 pr-2.5 py-2'
            : 'bg-white text-text-muted border-surface-border hover:border-primary/40 hover:text-text shadow-sm pl-3.5 pr-3 py-2',
          disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
          open && !isActive ? 'border-primary ring-2 ring-primary/10 text-text' : '',
        ].join(' ')}
      >
        <Icon size={13} className={isActive ? 'opacity-90' : 'opacity-60'} />
        <span className={isActive ? 'text-white' : ''}>
          {selected ? selected.label : placeholder}
        </span>
        {isActive ? (
          <span
            onClick={handleClear}
            className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 transition-colors cursor-pointer"
          >
            <X size={10} strokeWidth={2.5} />
          </span>
        ) : (
          <ChevronDown size={13} className={['opacity-60 transition-transform duration-200', open ? 'rotate-180' : ''].join(' ')} />
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* dropdown header */}
          <div className="px-3.5 pt-3 pb-2 border-b border-slate-100">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              {options.length} {placeholder.replace('All ', '')}
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto py-1.5">
            {options.length === 0 ? (
              <p className="px-4 py-3 text-xs text-text-muted italic">No options available</p>
            ) : (
              options.map((opt) => {
                const isSel = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={[
                      'w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer group',
                      isSel ? 'bg-primary/5' : 'hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {/* icon badge */}
                    <div className={[
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                      isSel
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-slate-100 text-text-muted group-hover:bg-primary/10 group-hover:text-primary',
                    ].join(' ')}>
                      <Icon size={13} />
                    </div>

                    {/* label + sublabel */}
                    <div className="flex-1 min-w-0">
                      <p className={['text-sm font-semibold truncate', isSel ? 'text-primary' : 'text-text'].join(' ')}>
                        {opt.label}
                      </p>
                      {opt.sublabel && (
                        <p className="text-[10px] text-text-muted truncate mt-0.5">{opt.sublabel}</p>
                      )}
                    </div>

                    {isSel && <Check size={13} className="text-primary flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </>
  )
}

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

function AlertBanner({ criticalCount, lowCount }) {
  if (criticalCount > 0) {
    return (
      <div className="bg-danger-bg border border-danger/20 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <span className="absolute inline-flex h-5 w-5 rounded-full bg-danger/30 animate-ping" />
          <AlertCircle size={22} className="relative text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-danger">
            {criticalCount} facilit{criticalCount > 1 ? 'ies' : 'y'} critically low — immediate action required
          </p>
          <p className="text-xs text-danger/70 mt-0.5">Restock as soon as possible to avoid service interruption</p>
        </div>
        <Link to="/district/facilities" className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline flex-shrink-0">
          View Facilities <ArrowRight size={12} />
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
        <Link to="/district/facilities" className="flex items-center gap-1 text-xs font-semibold text-warning-dark hover:underline flex-shrink-0">
          View Facilities <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  return null
}

export default function DistrictDashboard() {
  const { user } = useAuth()
  const [townFilter,   setTownFilter]   = useState('')
  const [ucFilter,     setUcFilter]     = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fpTownFilter, setFpTownFilter] = useState('')
  const [fpUcFilter,   setFpUcFilter]   = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', { townId: townFilter || undefined, ucId: ucFilter || undefined }],
    queryFn:  () => getDashboard({ townId: townFilter || undefined, ucId: ucFilter || undefined }),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const { data: facilityData } = useQuery({
    queryKey: ['facilities'],
    queryFn:  getFacilities,
    staleTime: 30_000,
  })

  const { data: townData } = useQuery({
    queryKey: ['towns'],
    queryFn:  getTowns,
    staleTime: 60_000,
  })

  const { data: ucData } = useQuery({
    queryKey: ['ucs'],
    queryFn:  () => getUnionCouncils(),
    staleTime: 60_000,
  })

  const townOptions = (townData?.towns ?? []).filter((t) => t.isActive)
  const ucOptions   = (ucData?.unionCouncils ?? [])
    .filter((uc) => uc.isActive && (!townFilter || uc.townId === townFilter))

  const townCount     = data?.summary?.townCount     ?? 0
  const ucCount       = data?.summary?.ucCount       ?? 0
  const facilityCount = data?.summary?.facilityCount ?? (data?.summary?.byFacility ?? []).length

  const districtName = data?.summary?.districtName ?? user?.districtName ?? null
  const province     = data?.summary?.province     ?? null

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
        const matchesSearch =
          f.name?.toLowerCase().includes(q) ||
          (f.ucName   ?? '').toLowerCase().includes(q) ||
          (f.townName ?? '').toLowerCase().includes(q)
        if (!matchesSearch) return false
      }
      if (statusFilter) {
        const st = statusByFacilityId.get(f.id) ?? 'no-data'
        if (st !== statusFilter) return false
      }
      if (fpTownFilter && f.townId !== fpTownFilter) return false
      if (fpUcFilter   && f.ucId   !== fpUcFilter)   return false
      return true
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [facilities, search, statusFilter, fpTownFilter, fpUcFilter, statusByFacilityId])

  // Vaccine matrix
  const { vaccineColumns, facilityRows } = useMemo(() => {
    const rawRows = data?.facilities ?? []

    const vaccineMap = new Map()
    rawRows.forEach((r) => {
      if (!vaccineMap.has(r.vaccineId)) {
        vaccineMap.set(r.vaccineId, displayVaccineName(r.vaccineName))
      }
    })
    const vaccineColumns = [...vaccineMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const facilityMap = new Map()
    rawRows.forEach((r) => {
      if (!facilityMap.has(r.facilityId)) {
        facilityMap.set(r.facilityId, { id: r.facilityId, name: r.facilityName, vaccines: new Map() })
      }
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
        Failed to load district dashboard. Please try refreshing.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* §1.2 Analytics banner */}
      <div className="bg-primary rounded-2xl px-6 py-5">
        <p className="text-sm text-white/70 font-semibold">
          District: <span className="text-white font-bold">{districtName ?? '—'}</span>
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <User size={12} className="opacity-70" /> {user.name}
          </span>
          {province && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
              <MapPin size={12} className="opacity-70" /> {province}
            </span>
          )}
        </div>
        {/* Stat chips */}
        <div className="flex flex-wrap gap-3 mt-4">
          {[
            { label: 'Towns',      value: townCount },
            { label: 'UCs',        value: ucCount },
            { label: 'Facilities', value: facilityCount },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="text-xl font-bold text-white">{value}</span>
              <span className="text-xs font-semibold text-white/70">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <FilterChip
          icon={MapPin}
          placeholder="All Towns"
          options={townOptions.map((t) => ({ value: t.id, label: t.name }))}
          value={townFilter}
          onChange={(e) => { setTownFilter(e.target.value); setUcFilter('') }}
        />
        <FilterChip
          icon={Layers}
          placeholder="All Union Councils"
          options={ucOptions.map((uc) => ({ value: uc.id, label: uc.name, sublabel: uc.townName ?? undefined }))}
          value={ucFilter}
          onChange={(e) => setUcFilter(e.target.value)}
          disabled={ucOptions.length === 0}
        />
        {(townFilter || ucFilter) && (
          <button
            onClick={() => { setTownFilter(''); setUcFilter('') }}
            className="text-xs font-bold text-text-muted hover:text-primary transition-colors px-1"
          >
            Clear all
          </button>
        )}
      </div>

      {/* §1.2 Alert Banner */}
      <AlertBanner criticalCount={counts.critical} lowCount={counts.low} />

      {/* §1.3 Performance Summary — 3 stat cards */}
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

      {/* §1.4 Facility-Level Performance Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Facility Performance</h2>
          <Link to="/district/facilities" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            Manage <ArrowRight size={11} />
          </Link>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
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

          {/* Status filter pills */}
          {[
            { value: '',          label: 'All' },
            { value: 'critical',  label: 'Critical' },
            { value: 'low',       label: 'Low Stock' },
            { value: 'adequate',  label: 'Normal' },
            { value: 'no-data',   label: 'No Data' },
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

          {/* Town filter */}
          <FilterChip
            icon={MapPin}
            placeholder="All Towns"
            options={townOptions.map((t) => ({ value: t.id, label: t.name }))}
            value={fpTownFilter}
            onChange={(e) => { setFpTownFilter(e.target.value); setFpUcFilter('') }}
          />

          {/* UC filter */}
          <FilterChip
            icon={Layers}
            placeholder="All UCs"
            options={(ucData?.unionCouncils ?? [])
              .filter((uc) => uc.isActive && (!fpTownFilter || uc.townId === fpTownFilter))
              .map((uc) => ({ value: uc.id, label: uc.name, sublabel: uc.townName ?? undefined }))}
            value={fpUcFilter}
            onChange={(e) => setFpUcFilter(e.target.value)}
            disabled={(ucData?.unionCouncils ?? []).filter((uc) => uc.isActive && (!fpTownFilter || uc.townId === fpTownFilter)).length === 0}
          />

          {/* Clear filters */}
          {(search || statusFilter || fpTownFilter || fpUcFilter) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setStatusFilter(''); setFpTownFilter(''); setFpUcFilter('') }}
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
              const stockCfg    = stockStatus ? statusConfig(stockStatus) : null
              const lastAct     = timeAgo(f.lastActivityAt)
              return (
                <div
                  key={f.id}
                  className={`grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_80px] px-5 py-4 gap-4 items-center border-b border-surface-border last:border-b-0 hover:bg-slate-50/60 transition-colors border-l-4 ${
                    stockStatus === 'critical' ? 'border-l-danger' : stockStatus === 'low' ? 'border-l-warning' : 'border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={13} className="text-text-muted/60 flex-shrink-0" />
                    <Link to={`/district/facilities/${f.id}`} className="font-bold text-text text-sm truncate hover:text-primary transition-colors">
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

      {/* §1.5 Vaccine Live Stock & Consumption Matrix */}
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
                        if (!cell) {
                          return (
                            <td key={v.id} className="px-4 py-3 text-center text-text-muted bg-slate-50/50">—</td>
                          )
                        }
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
