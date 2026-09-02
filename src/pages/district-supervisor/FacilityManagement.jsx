import { useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search, Building2, ChevronLeft, ChevronRight, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getFacilities, getDashboard } from '../../lib/api'
import { facilityStatus } from '../../lib/status'
import Table from '../../components/shared/Table'

export default function FacilityManagement() {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('filter') ?? 'all'
  function setStatusFilter(val) { setSearchParams(val === 'all' ? {} : { filter: val }); setCurrentPage(1) }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['facilities'],
    queryFn: getFacilities,
  })

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 15_000,
  })

  const facilities = data?.facilities ?? []

  const statusByFacilityId = new Map(
    (dashboardData?.summary?.byFacility ?? []).map((f) => [f.facilityId, facilityStatus(f.statusCounts)])
  )

  const statusCounts = { critical: 0, low: 0, adequate: 0, no_data: 0 }
  for (const f of facilities) {
    const s = statusByFacilityId.get(f.id) ?? 'no_data'
    if (s in statusCounts) statusCounts[s]++
  }

  const filteredFacilities = facilities.filter((f) => {
    const matchesSearch = f.name?.toLowerCase().includes(searchQuery.toLowerCase())
    const fStatus = statusByFacilityId.get(f.id) ?? 'no_data'
    const matchesStatus = statusFilter === 'all' ? true : fStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredFacilities.length / itemsPerPage)
  const paginatedFacilities = filteredFacilities.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const columns = [
    {
      key: 'name',
      label: 'Facility Name',
      render: (row) => (
        <RouterLink to={`/district/facilities/${row.id}`} className="font-bold text-text hover:text-primary transition-colors flex items-center gap-2">
          <Building2 size={14} className="text-text-muted/70 flex-shrink-0" />
          <span>{row.name}</span>
        </RouterLink>
      ),
    },
    {
      key: 'ucName',
      label: 'Union Council / Town',
      render: (row) => (
        <div>
          <p className="text-xs font-semibold text-text">{row.ucName ?? '—'}</p>
          {row.townName && <p className="text-[10px] text-text-muted font-medium">{row.townName}</p>}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date Added',
      render: (row) => (
        <span className="text-xs font-semibold text-text-muted">
          {new Date(row.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          })}
        </span>
      ),
    },
    {
      key: 'supervisor',
      label: 'Supervisor Assigned',
      render: (row) => (
        row.facilitySupervisorName ? (
          <span className="text-xs font-bold text-text">{row.facilitySupervisorName}</span>
        ) : (
          <span className="text-[10px] font-bold text-text-muted/70 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">Unstaffed</span>
        )
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex gap-1.5 justify-end">
          <RouterLink
            to={`/district/facilities/${row.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline px-2.5 py-1.5"
          >
            View Stock <ArrowRight size={13} strokeWidth={2.2} />
          </RouterLink>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">Facility Management</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {!isLoading && `No. of Facilities = ${facilities.length}`}
            {isLoading && 'Loading facilities...'}
          </p>
        </div>
      </div>

      {/* Search + Filter row */}
      {!isLoading && !isError && facilities.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          <div className="relative w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search facility by name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all',      label: 'All',     count: facilities.length,      activeClass: 'bg-primary text-white border-primary'     },
              { key: 'critical', label: 'Critical', count: statusCounts.critical,  activeClass: 'bg-danger text-white border-danger'       },
              { key: 'low',      label: 'Low',      count: statusCounts.low,       activeClass: 'bg-warning text-white border-warning'     },
              { key: 'adequate', label: 'Normal',    count: statusCounts.adequate,  activeClass: 'bg-success text-white border-success'     },
              { key: 'no_data',  label: 'No Data',  count: statusCounts.no_data,   activeClass: 'bg-slate-500 text-white border-slate-500' },
            ].map(({ key, label, count, activeClass }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                  statusFilter === key
                    ? activeClass
                    : 'bg-white border-surface-border text-text-muted hover:text-text hover:border-slate-300'
                }`}
              >
                {key === 'critical' && <AlertCircle size={11} />}
                {key === 'low'      && <AlertTriangle size={11} />}
                {key === 'adequate' && <CheckCircle2 size={11} />}
                {key === 'all'      && <Building2 size={11} />}
                {label}
                <span className="opacity-75">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load facilities. Please try refreshing.
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <div className="flex flex-col gap-3">
          <Table
            columns={columns}
            rows={paginatedFacilities}
            emptyMessage={searchQuery ? `No clinics match "${searchQuery}"` : 'No clinics configured yet.'}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-4 mt-2 rounded-2xl border border-surface-border shadow-sm">
              <div className="flex flex-1 justify-between sm:hidden">
                <button className="text-xs font-semibold text-text-muted px-3 py-1.5 border border-surface-border rounded-lg disabled:opacity-40" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Previous</button>
                <button className="text-xs font-semibold text-text-muted px-3 py-1.5 border border-surface-border rounded-lg disabled:opacity-40" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <p className="text-xs text-text-muted font-semibold">
                  Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
                  <span className="font-extrabold text-text">{totalPages}</span>
                </p>
                <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm border border-slate-200 bg-slate-50 p-0.5 gap-1">
                  <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1
                    return (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                          p === currentPage ? 'bg-primary text-white shadow-sm shadow-primary/10' : 'text-text-muted hover:bg-white'
                        }`}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-55 disabled:hover:bg-transparent transition-all cursor-pointer">
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
