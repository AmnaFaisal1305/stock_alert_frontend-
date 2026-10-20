import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { getStockRegister, getVaccines } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../lib/navigation'
import Select from '../../components/ui/Select'
import DatePicker from '../../components/ui/DatePicker'
import Button from '../../components/ui/Button'
import ExportButton from '../../components/ui/ExportButton'
import { useUrlFilters } from '../../hooks/useUrlState'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import Pagination from '../../components/shared/Pagination'
import FilterChips from '../../components/shared/FilterChips'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { formatDate, formatTime, plural } from '../../lib/format'

const PER_PAGE = 100

const ENTRY_TYPE = { opening: 'Received', received: 'Received', used: 'Used', wasted: 'Wasted', returned: 'Returned', correction: 'Stock Correction' }

// Entry-type chips → the API's `kind` list (the server counts opening rows as received).
const TYPE_FILTERS = [
  { value: '',           label: 'All' },
  { value: 'received',   label: 'Received',         kind: 'received' },
  { value: 'used',       label: 'Used',             kind: 'used' },
  { value: 'wasted',     label: 'Wasted',           kind: 'wasted' },
  { value: 'returned',   label: 'Returned',         kind: 'returned' },
  { value: 'correction', label: 'Stock Correction', kind: 'correction' },
]

const dash = <span className="text-text-muted">—</span>
const num  = (v, cls = '') => v != null ? <span className={`tabular-nums ${cls}`}>{v}</span> : dash

// The API answers in vials; the register shows doses.
function toRow(e) {
  const dpv   = e.dosesPerVial ?? 1
  const doses = (v) => v != null ? v * dpv : null
  return {
    id:           e.id,
    date:         e.occurredAt,
    vaccineName:  e.vaccineName ?? '',
    entryType:    ENTRY_TYPE[e.kind] ?? e.kind,
    workerName:   e.workerName,
    manufacturer: e.manufacturer,
    batchNo:      e.batchNo,
    dosesPerVial: e.dosesPerVial,
    expiryDate:   e.expiryDate,
    received:     doses(e.vials?.in),
    used:         doses(e.vials?.used),
    wasted:       doses(e.vials?.wasted),
    returned:     doses(e.vials?.returned),
    correction:   doses(e.vials?.correction),
    balance:      doses(e.balanceVials),
  }
}

export default function StockRegister() {
  const { user } = useAuth()
  const [url, setUrl] = useUrlFilters({ vaccine: '', from: '', to: '', type: '' })
  const [page, setPage] = useState(1)
  // cursors[i] is the `before` value that loads page i + 1; only pages already reached are known.
  const [cursors, setCursors] = useState([null])
  const set = (patch) => {
    setUrl(patch)
    setPage(1)
    setCursors([null])
  }

  const params = { vaccineId: url.vaccine, from: url.from, to: url.to, kind: TYPE_FILTERS.find((t) => t.value === url.type)?.kind }
  const before = cursors[page - 1]

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  // Under the ['audit-log'] prefix so every stock mutation's existing invalidation refreshes it.
  const regQ = useQuery({
    queryKey: ['audit-log', 'register', params, before],
    queryFn: () => getStockRegister({ ...params, limit: PER_PAGE, before }),
    placeholderData: keepPreviousData,
  })

  const vaccineOptions = useMemo(() => [
    { value: '', label: 'All vaccines' },
    ...(vaccineData?.vaccines ?? []).map((v) => ({ value: v.id, label: v.name })),
  ], [vaccineData])

  const rows = useMemo(() => (regQ.data?.entries ?? []).map(toRow), [regQ.data])

  // Cursor pages only open in order, so a page past the furthest one reached stays locked.
  const total = regQ.data?.total ?? 0
  const nextCursor = regQ.isPlaceholderData ? null : regQ.data?.nextCursor
  const totalPages = Math.ceil(total / PER_PAGE)
  const maxPage = Math.min(totalPages, cursors.length + (page === cursors.length && nextCursor ? 1 : 0))
  const goTo = (p) => {
    if (p > maxPage) return
    if (p === cursors.length + 1) setCursors((c) => [...c, nextCursor])
    setPage(p)
  }

  async function exportRows() {
    const all = []
    let cursor = null
    do {
      const res = await getStockRegister({ ...params, limit: 500, before: cursor })
      all.push(...(res.entries ?? []))
      cursor = res.nextCursor
    } while (cursor)
    return all.map(toRow)
  }

  const exportColumns = [
    { label: 'Date',             value: (r) => `${formatDate(r.date)} ${formatTime(r.date)}` },
    { label: 'Vaccine',          value: (r) => r.vaccineName },
    { label: 'Entry Type',       value: (r) => r.entryType },
    { label: 'Vaccinator',           value: (r) => r.workerName },
    { label: 'Manufacturer',     value: (r) => r.manufacturer },
    { label: 'Batch',            value: (r) => r.batchNo },
    { label: 'Doses per vial',       value: (r) => r.dosesPerVial },
    { label: 'Expiry',           value: (r) => r.expiryDate },
    { label: 'Received',         value: (r) => r.received },
    { label: 'Used',             value: (r) => r.used },
    { label: 'Wasted',           value: (r) => r.wasted },
    { label: 'Returned',         value: (r) => r.returned },
    { label: 'Stock Correction', value: (r) => r.correction != null ? (r.correction > 0 ? `+${r.correction}` : String(r.correction)) : '' },
    { label: 'Balance',          value: (r) => r.balance },
  ]

  const hasFilters = !!(url.vaccine || url.from || url.to || url.type)
  const isLoading  = loadingVaccines || regQ.isLoading

  return (
    <div>
      <div className="sticky -top-5 sm:-top-6 z-20 bg-surface-alt -mt-5 pt-5 sm:-mt-6 sm:pt-6">
        <PageHeader
          breadcrumb={`${ROLE_LABELS[user.role]} › Records`}
          title="Stock Register"
          subtitle="Every movement of the facility’s stock: received, used, returned, wasted and corrected. Figures in doses."
        />
      </div>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-3 mb-4">
        <div className="w-full sm:w-64">
          <Select
            id="vaccine-select"
            label="Vaccine"
            options={vaccineOptions}
            value={url.vaccine}
            onChange={(e) => set({ vaccine: e.target.value })}
            disabled={loadingVaccines}
          />
        </div>
        <div className="w-[calc(50%-0.375rem)] sm:w-44">
          <DatePicker id="register-from" label="From" value={url.from} max={url.to || undefined} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div className="w-[calc(50%-0.375rem)] sm:w-44">
          <DatePicker id="register-to" label="To" value={url.to} min={url.from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </div>
        {hasFilters && <Button variant="ghost" onClick={() => set({ vaccine: '', from: '', to: '', type: '' })}>Clear</Button>}
        <div className="ml-auto flex items-end gap-3">
          <p className="text-sm text-text-muted tabular-nums pb-2">{plural(total, 'entry', 'entries')}</p>
          <ExportButton name="stock-register" columns={exportColumns} getRows={exportRows} disabled={rows.length === 0} />
        </div>
      </div>

      <div className="mb-4">
        <FilterChips label="Entry type" options={TYPE_FILTERS} value={url.type} onChange={(type) => set({ type })} />
      </div>

      {regQ.isError ? (
        <ErrorState title="Couldn't load the register" error={regQ.error} onRetry={regQ.refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : rows.length === 0 ? (
        hasFilters
          ? <EmptyState framed icon={BookOpen} title="No movements match these filters" message="Try another vaccine or date range." />
          : <EmptyState framed icon={BookOpen} title="No stock movements recorded yet" message="Entries appear here as stock is received, used, returned, wasted or corrected." />
      ) : (
        <div className="flex flex-col gap-3">
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-xs font-medium text-text-muted">
                    <th scope="col" className="px-1 py-1.5 text-left">Date</th>
                    <th scope="col" className="px-1 py-1.5 text-left">Vaccine</th>
                    <th scope="col" className="px-1 py-1.5 text-left">Entry Type</th>
                    <th scope="col" className="px-1 py-1.5 text-left">Vaccinator</th>
                    <th scope="col" className="px-1 py-1.5 text-left">Manufacturer</th>
                    <th scope="col" className="px-1 py-1.5 text-left">Batch</th>
                    <th scope="col" className="px-1 py-1.5 text-left">Expiry</th>
                    <th scope="col" className="px-1 py-1.5 text-right whitespace-nowrap">Doses per vial</th>
                    <th scope="col" className="px-1 py-1.5 text-right">Received</th>
                    <th scope="col" className="px-1 py-1.5 text-right">Used</th>
                    <th scope="col" className="px-1 py-1.5 text-right">Wasted</th>
                    <th scope="col" className="px-1 py-1.5 text-right">Returned</th>
                    <th scope="col" className="px-1 py-1.5 text-right">Stock Correction</th>
                    <th scope="col" className="px-1 py-1.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((row) => {
                    const corrPos = row.correction != null && row.correction > 0
                    const corrNeg = row.correction != null && row.correction < 0
                    return (
                      <tr key={row.id} className="hover:bg-surface-alt transition-colors">
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <span className="text-text">{formatDate(row.date)}</span>
                          <span className="block text-xs text-text-muted">{formatTime(row.date)}</span>
                        </td>
                        <td className="px-1 py-1.5 font-medium text-text" dir="auto">{row.vaccineName || dash}</td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            row.entryType === 'Received'         ? 'bg-success-bg text-success-dark' :
                            row.entryType === 'Stock Correction' ? 'bg-warning-bg text-warning-dark' :
                                                                   'bg-surface-chip text-text'
                          }`}>{row.entryType}</span>
                        </td>
                        <td className="px-1 py-1.5 text-text">{row.workerName ?? dash}</td>
                        <td className="px-1 py-1.5 text-text">{row.manufacturer ?? dash}</td>
                        <td className="px-1 py-1.5 text-text">{row.batchNo ?? dash}</td>
                        <td className="px-1 py-1.5 whitespace-nowrap">{row.expiryDate ? formatDate(row.expiryDate) : dash}</td>
                        <td className="px-1 py-1.5 text-right">{row.dosesPerVial ?? dash}</td>
                        <td className="px-1 py-1.5 text-right text-success-dark">{num(row.received)}</td>
                        <td className="px-1 py-1.5 text-right text-danger-dark">{num(row.used)}</td>
                        <td className="px-1 py-1.5 text-right text-warning-dark">{num(row.wasted)}</td>
                        <td className="px-1 py-1.5 text-right text-text">{num(row.returned)}</td>
                        <td className="px-1 py-1.5 text-right">
                          {row.correction != null
                            ? <span className={`tabular-nums font-medium ${corrPos ? 'text-success-dark' : corrNeg ? 'text-danger-dark' : 'text-text'}`}>
                                {corrPos ? `+${row.correction}` : row.correction}
                              </span>
                            : dash}
                        </td>
                        <td className={`px-1 py-1.5 text-right font-medium tabular-nums ${row.balance < 0 ? 'text-danger-dark' : 'text-text'}`}>
                          {row.balance ?? dash}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination currentPage={page} totalPages={totalPages} maxPage={maxPage} onPageChange={goTo} />
        </div>
      )}

    </div>
  )
}
