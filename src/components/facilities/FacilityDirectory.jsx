// Searchable, status-filtered facility list for the UC and district Facilities pages.
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFacilities, getDashboard } from '../../lib/api'
import { useDebounce } from '../../hooks/useDebounce'
import { useUrlFilters } from '../../hooks/useUrlState'
import ExportButton from '../ui/ExportButton'
import { statusConfig } from '../../lib/status'
import Table from '../shared/Table'
import SearchInput from '../shared/SearchInput'
import FilterChips from '../shared/FilterChips'
import Pagination from '../shared/Pagination'
import ErrorState from '../shared/ErrorState'
import Select from '../ui/Select'
import ViewToggle from '../ui/ViewToggle'
import { useViewMode } from '../../hooks/useViewMode'
import { STATUS_FILTERS, facilityStatusMap, countByStatus, facilityColumns, FacilityMobileCard, FacilityGridCard } from './facilityTable'

export function useFacilityList() {
  return useQuery({ queryKey: ['facilities'], queryFn: getFacilities })
}

export default function FacilityDirectory({ base, query }) {
  const [{ q: search, status: filter, uc: ucFilter }, setFilters] = useUrlFilters({ q: '', status: 'all', uc: '' })
  const setSearch = (q) => setFilters({ q })
  const setUcFilter = (uc) => setFilters({ uc })
  const [page, setPage] = useState(1)
  const [view, setView] = useViewMode(`facilities${base.replace('/', '-')}`)
  const PER_PAGE = view === 'grid' ? 12 : 10
  const debounced = useDebounce(search)
  const setFilter = (v) => { setFilters({ status: v }); setPage(1) }

  const { data, isLoading, isError, error, refetch } = query
  const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, staleTime: 15_000 })

  const facilities = data?.facilities
  const { statusOf, counts, columns } = useMemo(() => {
    const map = facilityStatusMap(dashboard)
    const statusOf = (f) => map.get(f.id) ?? 'no_data'
    return { statusOf, counts: countByStatus(facilities ?? [], statusOf), columns: facilityColumns(statusOf, base) }
  }, [dashboard, facilities, base])

  const ucOptions = useMemo(() => {
    const seen = new Map()
    for (const f of facilities ?? []) {
      if (f.ucId && !seen.has(f.ucId)) seen.set(f.ucId, f.ucName ?? f.ucId)
    }
    if (seen.size < 2) return []
    return [
      { value: '', label: 'All union councils' },
      ...[...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([v, l]) => ({ value: v, label: l })),
    ]
  }, [facilities])

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return (facilities ?? [])
      .filter((f) =>
        (filter === 'all' || statusOf(f) === filter) &&
        (!ucFilter || f.ucId === ucFilter) &&
        (!q || [f.name, f.ucName, f.townName].some((v) => v?.toLowerCase().includes(q))))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [facilities, debounced, filter, ucFilter, statusOf])

  if (isError) return <ErrorState title="Couldn't load facilities" error={error} onRetry={refetch} />

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-wrap items-center gap-3 lg:flex-1 min-w-0">
          <div className="flex-1 min-w-[12rem]">
            <SearchInput value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search facility, UC or town…" />
          </div>
          {ucOptions.length > 0 && (
            <div className="w-full sm:w-56 shrink-0">
              <Select
                id="uc-filter"
                options={ucOptions}
                value={ucFilter}
                onChange={(e) => { setUcFilter(e.target.value); setPage(1) }}
                placeholder="All union councils"
              />
            </div>
          )}
          <ViewToggle value={view} onChange={(v) => { setView(v); setPage(1) }} />
          <ExportButton
            name="facilities"
            rows={filtered}
            columns={[
              { label: 'Facility', value: (f) => f.name },
              { label: 'Union council', value: (f) => f.ucName },
              { label: 'Town', value: (f) => f.townName },
              { label: 'Facility Supervisor', value: (f) => f.facilitySupervisorName },
              { label: 'Stock status', value: (f) => statusConfig(statusOf(f)).label },
              { label: 'Last activity', value: (f) => f.lastActivityAt },
              { label: 'Active', value: (f) => (f.isActive === false ? 'No' : 'Yes') },
            ]}
          />
        </div>
        <FilterChips
          label="Stock status"
          value={filter}
          onChange={setFilter}
          options={STATUS_FILTERS.map((o) => ({ ...o, count: counts[o.value] }))}
        />
      </div>
      <Table
        columns={columns}
        rows={rows}
        loading={isLoading}
        view={view}
        gridCard={(f) => <FacilityGridCard f={f} status={statusOf(f)} base={base} />}
        emptyMessage={search ? `No facilities match “${search}”.` : 'No facilities in this view.'}
        mobileCard={(f) => <FacilityMobileCard f={f} status={statusOf(f)} base={base} />}
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
