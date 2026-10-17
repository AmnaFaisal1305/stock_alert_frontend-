import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getFacilities, getDashboard } from '../../lib/api'
import { useDebounce } from '../../hooks/useDebounce'
import PageHeader from '../../components/shared/PageHeader'
import Table from '../../components/shared/Table'
import SearchInput from '../../components/shared/SearchInput'
import FilterChips from '../../components/shared/FilterChips'
import Pagination from '../../components/shared/Pagination'
import ErrorState from '../../components/shared/ErrorState'
import { plural } from '../../lib/format'
import { STATUS_FILTERS, facilityStatusMap, countByStatus, facilityColumns, FacilityMobileCard } from './facilityTable'

const PER_PAGE = 10

export default function UCSupervisorFacilities() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search)
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') ?? 'all'
  const setFilter = (v) => { setParams(v === 'all' ? {} : { filter: v }); setPage(1) }

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['facilities'], queryFn: getFacilities })
  const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, staleTime: 15_000 })

  const facilities = data?.facilities ?? []
  const { statusOf, counts, columns } = useMemo(() => {
    const map = facilityStatusMap(dashboard)
    const statusOf = (f) => map.get(f.id) ?? 'no_data'
    return { statusOf, counts: countByStatus(facilities, statusOf), columns: facilityColumns(statusOf) }
  }, [dashboard, facilities])

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return facilities
      .filter((f) => (filter === 'all' || statusOf(f) === filter) &&
        (!q || [f.name, f.ucName, f.townName].some((v) => v?.toLowerCase().includes(q))))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [facilities, debounced, filter, statusOf])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div>
      <PageHeader
        breadcrumb="UC Supervisor › Overview"
        title="Facilities"
        subtitle={facilities.length ? `${plural(facilities.length, 'facility', 'facilities')} in your union councils` : undefined}
      />

      {isError ? (
        <ErrorState title="Couldn’t load facilities" error={error} onRetry={refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <SearchInput value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search facility, UC or town…" />
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
            emptyMessage={search ? `No facilities match “${search}”.` : 'No facilities in this view.'}
            mobileCard={(f) => <FacilityMobileCard f={f} status={statusOf(f)} />}
          />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
