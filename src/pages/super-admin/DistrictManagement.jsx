import { useState, useMemo } from 'react'
import { Plus, Pencil, ChevronDown, Building2, Map as MapIcon, Eye, Power, PowerOff } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDistricts, getDistrict, getDashboard,
  createDistrict, updateDistrict, deleteDistrict, activateDistrict,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import SearchInput from '../../components/shared/SearchInput'
import Pagination from '../../components/shared/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import FilterChips from '../../components/shared/FilterChips'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import Table from '../../components/shared/Table'
import EntityCard from '../../components/shared/EntityCard'
import StatusBadge from '../../components/shared/StatusBadge'
import RowActions from '../../components/ui/RowActions'
import ViewToggle from '../../components/ui/ViewToggle'
import { SummaryDialog } from '../../components/ui/ReviewDialog'
import { useViewMode } from '../../hooks/useViewMode'
import { useUrlFilters } from '../../hooks/useUrlState'
import ExportButton from '../../components/ui/ExportButton'
import { facilityStatus, districtStatus, statusConfig, FILTERS } from '../../lib/status'
import { formatDate } from '../../lib/format'
import { groupByTownUc, FacilityHierarchy } from './DistrictDetail'

const FILTER_STATUS = { Critical: 'critical', Low: 'low', Normal: 'adequate' }
const ROW_GRID = 'sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.7fr)_auto]'

// ── Inline expanded panel — Town → UC → Facility hierarchy ──────────────────
function DistrictExpandedPanel({ districtId }) {
  const { data: districtData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['district', districtId],
    queryFn: () => getDistrict(districtId),
  })

  if (isLoading) return <div className="border-t border-surface-border"><SkeletonRows rows={3} /></div>
  if (isError) return <div className="border-t border-surface-border p-4"><ErrorState title="Couldn’t load district details" error={error} onRetry={refetch} /></div>

  const facilities = districtData?.district?.facilities ?? []
  if (facilities.length === 0) {
    return <EmptyState className="border-t border-surface-border" icon={Building2} title="No facilities in this district yet" />
  }
  return (
    <div className="border-t border-surface-border bg-surface-alt px-4 sm:px-5 py-5">
      <FacilityHierarchy towns={groupByTownUc(facilities)} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DistrictManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [open, setOpen]           = useState(false)
  const [name, setName]           = useState('')
  const [province, setProvince]   = useState('')
  const [formError, setFormError] = useState('')

  const [renaming, setRenaming]         = useState(null)
  const [renameValue, setRenameValue]   = useState('')
  const [renameError, setRenameError]   = useState('')

  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateError, setDeactivateError]   = useState('')

  const [toast, setToast]           = useState(null)
  const [created, setCreated]       = useState(null)
  const [view, setView]             = useViewMode('admin-districts')
  const [{ q: searchQuery, status: statusParam }, setFilters] = useUrlFilters({ q: '', status: '' })
  const [currentPage, setPage]      = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const debouncedSearch = useDebounce(searchQuery)
  const statusFilterIndex = Math.max(0, FILTERS.findIndex((f) => (FILTER_STATUS[f.label] ?? '') === statusParam))
  const activeFilterLabel = FILTERS[statusFilterIndex].label
  function setStatusFilter(label) { setFilters({ status: FILTER_STATUS[label] ?? '' }); setPage(1) }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
  })

  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: () => createDistrict({ name, province: province.trim() || 'Sindh' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setCreated({ name, province: province.trim() || 'Sindh' })
      setOpen(false); setName(''); setProvince(''); setFormError('')
    },
    onError: (err) => setFormError(err.message),
  })

  const renameMutation = useMutation({
    mutationFn: () => updateDistrict(renaming.id, renameValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setRenaming(null); setRenameError('')
      setToast({ message: 'District renamed.', type: 'success' })
    },
    onError: (err) => setRenameError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deleteDistrict(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      setToast({ message: `${deactivateTarget?.name} deactivated.`, type: 'success' })
      setDeactivateTarget(null); setDeactivateError('')
    },
    onError: (err) => setDeactivateError(err.message),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateDistrict(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
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

  const activeFilter = FILTERS[statusFilterIndex]
  const filtered = districts.filter((d) => {
    if (!d.name?.toLowerCase().includes(debouncedSearch.toLowerCase())) return false
    const status = districtStatusMap.get(d.id) ?? 'no_data'
    if (statusFilterIndex !== 0 && status === 'no_data') return false
    return activeFilter.match(status)
  })

  const ITEMS_PER_PAGE = view === 'grid' ? 12 : 10
  const totalPages     = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated      = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const isObserver = user?.role === 'observer'
  const rowActions = (row, { withView = false } = {}) => (
    <RowActions
      actions={[
        withView && { icon: Eye, label: 'View district', to: `/super-admin/districts/${row.id}` },
        !isObserver && { icon: Pencil, label: 'Rename', onClick: () => { setRenaming(row); setRenameValue(row.name); setRenameError('') } },
        !isObserver && (row.isActive
          ? { icon: PowerOff, label: 'Deactivate', danger: true, onClick: () => { setDeactivateTarget(row); setDeactivateError('') } }
          : { icon: Power, label: 'Activate', onClick: () => activateMutation.mutate(row.id), disabled: activateMutation.isPending }),
      ]}
    />
  )

  const gridCard = (row) => {
    const status = districtStatusMap.get(row.id) ?? 'no_data'
    return (
      <EntityCard
        icon={MapIcon}
        accent={row.isActive ? status : 'no_data'}
        title={row.name}
        subtitle={`${row.province ?? 'Sindh'} · added ${formatDate(row.createdAt)}`}
        badge={<Badge type={row.isActive ? 'active' : 'inactive'} />}
        meta={[
          { label: 'Stock', value: <StatusBadge status={status} /> },
          { label: 'District Supervisor', value: row.supervisorName ?? '—' },
          { label: 'Email', value: row.supervisorEmail ?? '—' },
        ]}
        actions={rowActions(row, { withView: true })}
      />
    )
  }

  const emptyMessage = searchQuery || statusFilterIndex !== 0
    ? `No districts match${searchQuery ? ` “${searchQuery}”` : ''}${statusFilterIndex !== 0 ? ` with status “${activeFilterLabel}”` : ''}.`
    : 'No districts registered yet.'

  return (
    <div>
      <PageHeader
        breadcrumb="Super Admin › Network"
        title="Districts"
        subtitle={isLoading ? undefined : `${districts.length} ${districts.length === 1 ? 'district' : 'districts'} in the system`}
        actions={!isObserver && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} strokeWidth={1.75} /> Add district
          </Button>
        )}
      />

      {isError ? (
        <ErrorState title="Couldn’t load districts" error={error} onRetry={refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          {districts.length > 0 && (
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-center gap-3 lg:flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <SearchInput
                    value={searchQuery}
                    onChange={(e) => { setFilters({ q: e.target.value }); setPage(1) }}
                    placeholder="Search district by name…"
                  />
                </div>
                <ViewToggle value={view} onChange={setView} className="lg:order-last" />
                <div className="lg:order-last">
                  <ExportButton
                    name="districts"
                    rows={filtered}
                    columns={[
                      { label: 'District', value: (d) => d.name },
                      { label: 'Province', value: (d) => d.province ?? 'Sindh' },
                      { label: 'Stock status', value: (d) => statusConfig(districtStatusMap.get(d.id) ?? 'no_data').label },
                      { label: 'District Supervisor', value: (d) => d.supervisorName },
                      { label: 'Supervisor email', value: (d) => d.supervisorEmail },
                      { label: 'Active', value: (d) => (d.isActive ? 'Active' : 'Inactive') },
                      { label: 'Added', value: (d) => formatDate(d.createdAt) },
                    ]}
                  />
                </div>
              </div>
              <FilterChips
                label="District status"
                value={FILTERS[statusFilterIndex].label}
                onChange={setStatusFilter}
                options={FILTERS.map((f, i) => ({ value: f.label, label: f.label, status: FILTER_STATUS[f.label], count: filterCounts[i] }))}
              />
            </div>
          )}

          {view === 'grid' ? (
            <Table columns={[]} rows={paginated} loading={isLoading} view="grid" gridCard={gridCard} emptyMessage={emptyMessage} />
          ) : (
          <Card padding={false}>
            <div className={`hidden sm:grid ${ROW_GRID} gap-6 px-5 py-3 border-b border-surface-border text-xs font-medium text-text-muted`}>
              <span>District</span>
              <span>District Supervisor</span>
              <span>Supervisor email</span>
              <span className="sr-only">Actions</span>
            </div>

            {isLoading ? (
              <SkeletonRows rows={4} />
            ) : paginated.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-text-muted">{emptyMessage}</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {paginated.map((row) => {
                  const isExpanded = expandedId === row.id
                  const panelId = `district-panel-${row.id}`
                  return (
                    <li key={row.id}>
                      <div className={`px-4 sm:px-5 py-3.5 grid gap-2 ${ROW_GRID} sm:gap-6 sm:items-center`}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.id)}
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          className="flex items-start gap-2 text-left min-w-0 group"
                        >
                          <ChevronDown size={16} strokeWidth={1.75} className={`mt-0.5 flex-shrink-0 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-text group-hover:text-primary truncate">{row.name}</span>
                              <Badge type={row.isActive ? 'active' : 'inactive'} />
                            </span>
                            <span className="block text-xs text-text-muted mt-0.5">{row.province ?? 'Sindh'} · added {formatDate(row.createdAt)}</span>
                          </span>
                        </button>
                        <p className="text-sm text-text truncate pl-6 sm:pl-0">
                          <span className="sm:hidden text-text-muted">Supervisor: </span>
                          {row.supervisorName ?? <span className="text-text-muted">—</span>}
                        </p>
                        <p className="text-sm text-text truncate pl-6 sm:pl-0">{row.supervisorEmail ?? <span className="text-text-muted">—</span>}</p>
                        <div className="flex items-center gap-1 sm:justify-end pl-4 sm:pl-0">{!isObserver && rowActions(row)}</div>
                      </div>
                      {isExpanded && <div id={panelId}><DistrictExpandedPanel districtId={row.id} /></div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────── */}
      <Modal open={open} onClose={() => { setOpen(false); setName(''); setProvince(''); setFormError('') }} title="Add district">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (/[<>]/.test(name)) { setFormError('Names cannot contain < or > characters.'); return } mutation.mutate() }}>
          <Input
            id="district-name"
            label="District name"
            placeholder="e.g. South District"
            value={name}
            onChange={(e) => { setName(e.target.value); setFormError('') }}
            required
          />
          <Input
            id="district-province"
            label="Province"
            placeholder="e.g. Sindh"
            value={province}
            onChange={(e) => { setProvince(e.target.value); setFormError('') }}
          />
          {formError && (
            <p role="alert" className="text-sm text-danger-dark">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => { setOpen(false); setName(''); setProvince(''); setFormError('') }}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create district'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Rename modal ─────────────────────────────────────────────── */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename — ${renaming?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (/[<>]/.test(renameValue)) { setRenameError('Names cannot contain < or > characters.'); return } renameMutation.mutate() }}>
          <Input
            id="rename-district"
            label="District name"
            value={renameValue}
            onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }}
            required
          />
          {renameError && (
            <p role="alert" className="text-sm text-danger-dark">{renameError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>
              {renameMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
        title="Deactivate district?"
        message={`Deactivate ${deactivateTarget?.name ?? 'this district'}? Facility supervisors and staff under it will be blocked until it is activated again.`}
        confirmLabel="Deactivate"
        isPending={deactivateMutation.isPending}
        error={deactivateError}
      />

      <SummaryDialog
        open={!!created}
        onClose={() => setCreated(null)}
        title="District created"
        message={<>Add towns and union councils under <span className="font-medium">{created?.name}</span>, then assign a district supervisor.</>}
        rows={created ? [{ label: 'Name', value: created.name }, { label: 'Province', value: created.province }] : []}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
