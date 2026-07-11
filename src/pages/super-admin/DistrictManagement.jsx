import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Search, Map as MapIcon,
  ChevronLeft, ChevronRight, ChevronDown, Building2, User, Mail, Loader2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDistricts, getDistrict, getDashboard,
  createDistrict, updateDistrict, deleteDistrict, activateDistrict,
} from '../../lib/api'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'
import StatusBadge from '../../components/shared/StatusBadge'
import { facilityStatus, districtStatus, statusConfig, FILTERS } from '../../lib/status'

// ── Inline facility sub-table — rendered below each expanded district row ────
function DistrictExpandedPanel({ districtId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['district', districtId],
    queryFn: () => getDistrict(districtId),
  })

  if (isLoading) {
    return (
      <div className="border-t border-primary/10 bg-slate-50 px-8 py-5 flex items-center gap-2 text-text-muted text-sm">
        <Loader2 size={14} className="animate-spin flex-shrink-0" />
        Loading facilities…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="border-t border-primary/10 bg-slate-50 px-8 py-4 text-xs font-semibold text-danger">
        Failed to load facilities.
      </div>
    )
  }

  const facilities = data?.district?.facilities ?? []

  return (
    <div className="border-t border-primary/10 bg-slate-50/80">
      {/* Sub-panel header */}
      <div className="px-8 pt-4 pb-3 flex items-center gap-3">
        <div className="w-0.5 h-4 bg-primary rounded-full flex-shrink-0" />
        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
          {facilities.length} {facilities.length === 1 ? 'Facility' : 'Facilities'}
        </span>
      </div>

      {facilities.length === 0 ? (
        <div className="px-8 pb-5 flex items-center gap-3 text-text-muted">
          <Building2 size={16} className="opacity-30 flex-shrink-0" />
          <p className="text-sm font-medium">No facilities registered under this district.</p>
        </div>
      ) : (
        <div className="mx-6 mb-5 rounded-xl border border-surface-border overflow-hidden bg-white shadow-sm">

          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1.4fr_1.8fr_90px_1fr] px-5 py-2.5 bg-slate-50 border-b border-surface-border gap-5 items-center">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Facility Name</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Facility Supervisor</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Supervisor Email</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Vaccines</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Stock Status</span>
          </div>

          {/* Facility rows */}
          {facilities.map((f) => {
            const fStatus     = worstStatus(f.statusCounts)
            const cfg         = statusConfig(fStatus)
            const sc          = f.statusCounts ?? {}
            const totalTypes  = (sc.critical ?? 0) + (sc.low ?? 0) + (sc.adequate ?? 0) + (sc.no_data ?? 0)
            const hasAny      = sc.critical > 0 || sc.low > 0 || sc.adequate > 0 || sc.no_data > 0

            return (
              <Link
                key={f.id}
                to={`/super-admin/facilities/${f.id}`}
                className="grid grid-cols-[2fr_1.4fr_1.8fr_90px_1fr] px-5 py-3.5 gap-5 items-center border-b border-surface-border last:border-b-0 hover:bg-primary/[0.03] transition-colors duration-100 group"
              >
                {/* Facility name + status accent dot */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-md flex-shrink-0 ${cfg.bg}`}>
                    <Building2 size={13} className={cfg.text} strokeWidth={2.2} />
                  </div>
                  <span
                    className="font-semibold text-sm text-text truncate group-hover:text-primary transition-colors"
                    title={f.name}
                  >
                    {f.name}
                  </span>
                </div>

                {/* Supervisor name */}
                <span className={`text-sm truncate ${f.facilitySupervisorName ? 'text-text font-medium' : 'text-text-muted italic'}`}>
                  {f.facilitySupervisorName ?? '—'}
                </span>

                {/* Supervisor email */}
                <span className={`text-sm truncate ${f.facilitySupervisorEmail ? 'text-text' : 'text-text-muted italic'}`}>
                  {f.facilitySupervisorEmail ?? '—'}
                </span>

                {/* Total vaccine types */}
                <div className="text-center">
                  <span className="text-sm font-bold text-text tabular-nums">{totalTypes}</span>
                  <p className="text-[10px] text-text-muted font-medium leading-none mt-0.5">types</p>
                </div>

                {/* Stock status chips */}
                <div className="flex flex-wrap gap-1">
                  {sc.critical > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-bg text-danger border border-danger/10 tabular-nums">
                      {sc.critical} Critical
                    </span>
                  )}
                  {sc.low > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-warning-bg text-warning-dark border border-warning/10 tabular-nums">
                      {sc.low} Low
                    </span>
                  )}
                  {sc.adequate > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success-bg text-success-dark border border-success/10 tabular-nums">
                      {sc.adequate} OK
                    </span>
                  )}
                  {!hasAny && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-alt text-text-muted border border-surface-border">
                      No Data
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DistrictManagement() {
  const queryClient = useQueryClient()

  const [open, setOpen]           = useState(false)
  const [name, setName]           = useState('')
  const [formError, setFormError] = useState('')

  const [renaming, setRenaming]         = useState(null)
  const [renameValue, setRenameValue]   = useState('')
  const [renameError, setRenameError]   = useState('')

  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateError, setDeactivateError]   = useState('')

  const [toast, setToast]         = useState(null)
  const [searchQuery, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState(0)
  const [currentPage, setPage]     = useState(1)
  const [expandedId, setExpandedId] = useState(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
  })

  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: () => createDistrict(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      setOpen(false); setName(''); setFormError('')
      setToast({ message: 'District created successfully.', type: 'success' })
    },
    onError: (err) => setFormError(err.message),
  })

  const renameMutation = useMutation({
    mutationFn: () => updateDistrict(renaming.id, renameValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      setRenaming(null); setRenameError('')
      setToast({ message: 'District renamed.', type: 'success' })
    },
    onError: (err) => setRenameError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deleteDistrict(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      setToast({ message: `${deactivateTarget?.name} deactivated.`, type: 'success' })
      setDeactivateTarget(null); setDeactivateError('')
    },
    onError: (err) => setDeactivateError(err.message),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateDistrict(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      const target = districts.find((d) => d.id === id)
      setToast({ message: `${target?.name ?? 'District'} activated.`, type: 'success' })
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  const districts = data?.districts ?? []

  // Build a district→status map from dashboard facility rollup (same logic as Dashboard.jsx)
  const districtStatusMap = useMemo(() => {
    const map = new Map()
    for (const f of (dashData?.summary?.byFacility ?? [])) {
      const fStatus = facilityStatus(f.statusCounts)
      const prev = map.get(f.districtId)
      if (!prev) { map.set(f.districtId, [fStatus]); continue }
      prev.push(fStatus)
    }
    const result = new Map()
    for (const [id, statuses] of map) {
      result.set(id, districtStatus(statuses))
    }
    return result
  }, [dashData])

  const filterCounts = useMemo(() =>
    FILTERS.map((f, i) => districts.filter((d) => {
      const status = districtStatusMap.get(d.id) ?? 'no_data'
      if (i !== 0 && status === 'no_data') return false
      return f.match(status)
    }).length),
    [districts, districtStatusMap]
  )

  const activeFilter = FILTERS[statusFilter]
  const filtered = districts.filter((d) => {
    if (!d.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    const status = districtStatusMap.get(d.id) ?? 'no_data'
    if (statusFilter !== 0 && status === 'no_data') return false
    return activeFilter.match(status)
  })

  const ITEMS_PER_PAGE = 10
  const totalPages     = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated      = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* ── Maroon banner header ─────────────────────────────────────── */}
      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">District Management</h1>
          <p className="text-sm text-white/70 mt-0.5">
            {!isLoading
              ? `${districts.length} ${districts.length === 1 ? 'district' : 'districts'} registered under system`
              : 'Loading districts list…'}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 bg-white text-primary font-bold text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-white/90 active:scale-[0.98] transition-all flex-shrink-0"
        >
          <Plus size={15} strokeWidth={2.5} /> Add District
        </button>
      </div>

      {/* ── Search + Status filters ──────────────────────────────────── */}
      {!isLoading && !isError && districts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search district by name…"
              value={searchQuery}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-surface-border rounded-xl p-1 shadow-sm">
            {FILTERS.map((f, i) => {
              const active = statusFilter === i
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
                  onClick={() => { setStatusFilter(i); setPage(1) }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${colorClass}`}
                >
                  {f.label}
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md tabular-nums ${badgeClass}`}>
                    {filterCounts[i]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load districts. Please try refreshing.
        </div>
      )}

      {/* ── Districts table ──────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">

            {/* Column headers */}
            <div className="grid grid-cols-[2.5fr_1.4fr_2fr_240px] px-6 py-3.5 bg-slate-50 border-b border-surface-border gap-6 items-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">District Name</span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">District Supervisor</span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Supervisor Email</span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Actions</span>
            </div>

            {paginated.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-text-muted">
                {searchQuery || statusFilter !== 0
                  ? `No districts match${searchQuery ? ` "${searchQuery}"` : ''}${statusFilter !== 0 ? ` with status "${FILTERS[statusFilter].label}"` : ''}.`
                  : 'No districts registered yet.'}
              </div>
            )}

            {/* Data rows */}
            {paginated.map((row) => {
              const isExpanded = expandedId === row.id
              return (
                <div key={row.id} className="border-b border-surface-border last:border-b-0">

                  {/* Main row */}
                  <div className={[
                    'grid grid-cols-[2.5fr_1.4fr_2fr_240px] px-6 py-4 gap-6 items-center transition-colors duration-150',
                    isExpanded ? 'bg-primary/[0.04]' : 'hover:bg-slate-50/60',
                  ].join(' ')}>

                    {/* District name + active badge + date + activate/deactivate */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapIcon size={14} className="text-text-muted/60 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-text text-sm truncate">{row.name}</p>
                          <Badge type={row.isActive ? 'active' : 'inactive'} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-text-muted font-medium">
                            {new Date(row.createdAt).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                          <span className="text-text-muted/30 text-[10px]">·</span>
                          {row.isActive ? (
                            <button
                              onClick={() => { setDeactivateTarget(row); setDeactivateError('') }}
                              className="text-[10px] font-bold text-danger hover:underline"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => activateMutation.mutate(row.id)}
                              disabled={activateMutation.isPending}
                              className="text-[10px] font-bold text-success-dark hover:underline disabled:opacity-50"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className={`text-sm truncate ${row.supervisorName ? 'text-text font-medium' : 'text-text-muted italic'}`}>
                      {row.supervisorName ?? '—'}
                    </span>

                    <span className={`text-sm truncate ${row.supervisorEmail ? 'text-text' : 'text-text-muted italic'}`}>
                      {row.supervisorEmail ?? '—'}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => toggleExpand(row.id)}
                        className={[
                          'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all duration-150',
                          isExpanded
                            ? 'bg-primary text-white'
                            : 'text-primary hover:bg-primary/5',
                        ].join(' ')}
                      >
                        <ChevronDown
                          size={13}
                          strokeWidth={2.5}
                          className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                        {isExpanded ? 'Collapse' : 'View Details'}
                      </button>

                      <Button variant="ghost" size="sm" onClick={() => { setRenaming(row); setRenameValue(row.name); setRenameError('') }}>
                        <Pencil size={12} /> Rename
                      </Button>
                    </div>
                  </div>

                  {/* Inline expanded facilities panel */}
                  {isExpanded && <DistrictExpandedPanel districtId={row.id} />}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-surface-border shadow-sm">
              <p className="text-xs text-text-muted font-semibold hidden sm:block">
                Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
                <span className="font-extrabold text-text">{totalPages}</span>
              </p>
              <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-slate-200 bg-slate-50 p-0.5 gap-1">
                <button
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        p === currentPage
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-text-muted hover:bg-white'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          )}
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────── */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create District">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
          <Input
            id="district-name"
            label="District Name"
            placeholder="e.g. South District"
            value={name}
            onChange={(e) => { setName(e.target.value); setFormError('') }}
            required
          />
          {formError && (
            <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Rename modal ─────────────────────────────────────────────── */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename — ${renaming?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); renameMutation.mutate() }}>
          <Input
            id="rename-district"
            label="District Name"
            value={renameValue}
            onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }}
            required
          />
          {renameError && (
            <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">
              {renameError}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>
              {renameMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Deactivate modal ─────────────────────────────────────────── */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Deactivate District" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Deactivate <span className="font-bold">{deactivateTarget?.name}</span>? Facility supervisors and staff under this district will be blocked until reactivated.
          </p>
          {deactivateError && (
            <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{deactivateError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => deactivateMutation.mutate(deactivateTarget.id)}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
