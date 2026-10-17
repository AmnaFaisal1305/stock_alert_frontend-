import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { getAuditLog, getVaccines } from '../../lib/api'
import Select from '../../components/ui/Select'
import ExportButton from '../../components/ui/ExportButton'
import { useUrlFilters } from '../../hooks/useUrlState'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import FilterChips from '../../components/shared/FilterChips'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { displayVaccineName } from '../../lib/vaccineNames'
import { formatDate, formatTime } from '../../lib/format'

// Three visible entry type labels
const FILTER_TYPES = [
  { key: 'all',              label: 'All' },
  { key: 'Received',         label: 'Received' },
  { key: 'Record',           label: 'Record' },
  { key: 'Stock Correction', label: 'Stock Correction' },
]

const dash = <span className="text-text-muted">—</span>
const num  = (v, cls = '') => v != null ? <span className={`tabular-nums ${cls}`}>{v}</span> : dash

export default function StockRegister() {
  const [{ vaccine: selectedVaccineId, type: typeFilter }, setFilters] = useUrlFilters({ vaccine: '', type: 'all' })

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: logData,     isLoading: loadingLog, isError, error, refetch } = useQuery({
    queryKey: ['audit-log', 'register'],
    queryFn: async () => {
      const parts = await Promise.all(
        ['STOCK_ENTRY', 'ADJUST_STOCK', 'STOCK_DAY_END'].map((action) => getAuditLog({ action }))
      )
      return { auditLog: parts.flatMap((p) => p.auditLog ?? []) }
    },
  })

  const vaccines  = vaccineData?.vaccines ?? []
  const logs      = logData?.auditLog    ?? []
  const isLoading = loadingVaccines || loadingLog

  const dpvById = useMemo(
    () => Object.fromEntries(vaccines.map((v) => [v.id, v.dosesPerVial ?? 1])),
    [vaccines],
  )

  const vaccineOptions = useMemo(() => [
    { value: '', label: 'All vaccines' },
    ...vaccines.map((v) => ({ value: v.id, label: displayVaccineName(v.name) })),
  ], [vaccines])

  const rows = useMemo(() => {
    const result = []

    for (const l of logs) {
      const d = l.details ?? {}

      if (l.action === 'STOCK_ENTRY') {
        if (selectedVaccineId && d.vaccineId !== selectedVaccineId) continue
        const et = d.entryType
        result.push({
          _key:         d.vaccineId ?? d.vaccineName ?? '',
          date:         l.createdAt,
          vaccineName:  displayVaccineName(d.vaccineName ?? ''),
          entryType:    (et === 'received' || et === 'opening') ? 'Received' : 'Record',
          manufacturer: d.manufacturer ?? null,
          batchNo:      d.batchNo      ?? null,
          dosesPerVial: d.dosesPerVial ?? null,
          expiryDate:   d.expiryDate   ?? null,
          received:  (et === 'opening' || et === 'received') ? (d.quantity ?? 0) : null,
          used:       et === 'used'     ? (d.quantity ?? 0) : null,
          returned:   et === 'returned' ? (d.quantity ?? 0) : null,
          wasted:     et === 'wasted'   ? (d.quantity ?? 0) : null,
          correction: null,
          balance:    0,
        })

      } else if (l.action === 'ADJUST_STOCK') {
        if (selectedVaccineId && d.vaccineId !== selectedVaccineId) continue
        result.push({
          _key:         d.vaccineId ?? d.vaccineName ?? '',
          date:         l.createdAt,
          vaccineName:  displayVaccineName(d.vaccineName ?? ''),
          entryType:    'Stock Correction',
          manufacturer: null, batchNo: null, dosesPerVial: null, expiryDate: null,
          received: null, used: null, returned: null, wasted: null,
          correction: d.delta ?? 0,
          balance:    0,
        })

      } else if (l.action === 'STOCK_DAY_END') {
        for (const item of (d.items ?? [])) {
          if (selectedVaccineId && item.vaccineId !== selectedVaccineId) continue
          const dpv           = dpvById[item.vaccineId] ?? 1
          const usedDoses     = (item.usedVials      ?? 0) * dpv
          const returnedDoses = (item.returnedVials   ?? 0) * dpv
          const wastedDoses   = (item.wastedVials     ?? 0) * dpv
          if (!usedDoses && !returnedDoses && !wastedDoses) continue
          result.push({
            _key:         item.vaccineId ?? item.vaccineName ?? '',
            date:         l.createdAt,
            vaccineName:  displayVaccineName(item.vaccineName ?? ''),
            entryType:    'Record',
            manufacturer: null, batchNo: null, dosesPerVial: dpv, expiryDate: null,
            received:   null,
            used:       usedDoses     || null,
            returned:   returnedDoses || null,
            wasted:     wastedDoses   || null,
            correction: null,
            balance:    0,
          })
        }
      }
    }

    // Compute per-vaccine running balance oldest→newest, then reverse for display.
    result.sort((a, b) => new Date(a.date) - new Date(b.date))
    const balMap = new Map()
    for (const row of result) {
      let bal = balMap.get(row._key) ?? 0
      bal += row.received   ?? 0
      bal -= row.used       ?? 0
      bal += row.returned   ?? 0
      bal -= row.wasted     ?? 0
      bal += row.correction ?? 0   // signed; negative corrections subtract
      balMap.set(row._key, bal)
      row.balance = bal
    }

    return result.reverse() // newest first for display
  }, [logs, selectedVaccineId, dpvById])

  const filteredRows = useMemo(
    () => typeFilter === 'all' ? rows : rows.filter((r) => r.entryType === typeFilter),
    [rows, typeFilter],
  )

  const chipOptions = useMemo(() => {
    const counts = {}
    rows.forEach((r) => { counts[r.entryType] = (counts[r.entryType] ?? 0) + 1 })
    return FILTER_TYPES
      .filter((t) => t.key === 'all' || counts[t.key])
      .map((t) => ({ value: t.key, label: t.label, count: t.key === 'all' ? rows.length : counts[t.key] }))
  }, [rows])

  const exportColumns = [
    { label: 'Date',             value: (r) => `${formatDate(r.date)} ${formatTime(r.date)}` },
    { label: 'Vaccine',          value: (r) => r.vaccineName },
    { label: 'Entry Type',       value: (r) => r.entryType },
    { label: 'Manufacturer',     value: (r) => r.manufacturer },
    { label: 'Batch',            value: (r) => r.batchNo },
    { label: 'Doses/vial',       value: (r) => r.dosesPerVial },
    { label: 'Expiry',           value: (r) => r.expiryDate },
    { label: 'Received',         value: (r) => r.received },
    { label: 'Used',             value: (r) => r.used },
    { label: 'Returned',         value: (r) => r.returned },
    { label: 'Wasted',           value: (r) => r.wasted },
    { label: 'Stock Correction', value: (r) => r.correction != null ? (r.correction > 0 ? `+${r.correction}` : String(r.correction)) : '' },
    { label: 'Balance',          value: (r) => r.balance },
  ]

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Supervisor › Records"
        title="Stock Register"
        subtitle="All vaccine movements — received, recorded and corrected"
      />

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mb-4">
        <div className="w-full sm:w-64">
          <Select
            id="vaccine-select"
            label="Vaccine"
            options={vaccineOptions}
            value={selectedVaccineId}
            onChange={(e) => setFilters({ vaccine: e.target.value, type: 'all' })}
            disabled={loadingVaccines}
          />
        </div>
        <div className="sm:ml-auto">
          <ExportButton
            name="stock-register"
            rows={filteredRows}
            columns={exportColumns}
            disabled={filteredRows.length === 0}
          />
        </div>
      </div>

      {isError ? (
        <ErrorState title="Couldn't load the register" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : rows.length === 0 ? (
        <EmptyState framed icon={BookOpen} title="No stock movements recorded yet" message="Entries appear here as stock is received, assigned and returned." />
      ) : (
        <div className="flex flex-col gap-3">
          {chipOptions.length > 1 && (
            <FilterChips options={chipOptions} value={typeFilter} onChange={(v) => setFilters({ type: v })} label="Entry type" />
          )}
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs font-medium text-text-muted">
                    <th scope="col" className="px-4 py-3 text-left">Date</th>
                    <th scope="col" className="px-4 py-3 text-left">Vaccine</th>
                    <th scope="col" className="px-4 py-3 text-left">Entry Type</th>
                    <th scope="col" className="px-4 py-3 text-left">Manufacturer</th>
                    <th scope="col" className="px-4 py-3 text-left">Batch</th>
                    <th scope="col" className="px-4 py-3 text-right">Doses/vial</th>
                    <th scope="col" className="px-4 py-3 text-left">Expiry</th>
                    <th scope="col" className="px-4 py-3 text-right">Received</th>
                    <th scope="col" className="px-4 py-3 text-right">Used</th>
                    <th scope="col" className="px-4 py-3 text-right">Returned</th>
                    <th scope="col" className="px-4 py-3 text-right">Wasted</th>
                    <th scope="col" className="px-4 py-3 text-right">Stock Correction</th>
                    <th scope="col" className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center text-text-muted">
                        No entries of this type.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, i) => {
                      const corrPos = row.correction != null && row.correction > 0
                      const corrNeg = row.correction != null && row.correction < 0
                      return (
                        <tr key={`${row.date}-${i}`} className="hover:bg-surface-alt transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-text">{formatDate(row.date)}</span>
                            <span className="block text-xs text-text-muted">{formatTime(row.date)}</span>
                          </td>
                          <td className="px-4 py-3 font-medium text-text whitespace-nowrap" dir="auto">{row.vaccineName || dash}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              row.entryType === 'Received'         ? 'bg-success-bg text-success-dark' :
                              row.entryType === 'Stock Correction' ? 'bg-warning-bg text-warning-dark' :
                                                                     'bg-surface-chip text-text'
                            }`}>{row.entryType}</span>
                          </td>
                          <td className="px-4 py-3 text-text">{row.manufacturer ?? dash}</td>
                          <td className="px-4 py-3 text-text">{row.batchNo ?? dash}</td>
                          <td className="px-4 py-3 text-right">{row.dosesPerVial ?? dash}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.expiryDate ? formatDate(row.expiryDate) : dash}</td>
                          <td className="px-4 py-3 text-right text-success-dark">{num(row.received)}</td>
                          <td className="px-4 py-3 text-right text-danger-dark">{num(row.used)}</td>
                          <td className="px-4 py-3 text-right">{num(row.returned)}</td>
                          <td className="px-4 py-3 text-right text-warning-dark">{num(row.wasted)}</td>
                          <td className="px-4 py-3 text-right">
                            {row.correction != null
                              ? <span className={`tabular-nums font-medium ${corrPos ? 'text-success-dark' : corrNeg ? 'text-danger-dark' : 'text-text'}`}>
                                  {corrPos ? `+${row.correction}` : row.correction}
                                </span>
                              : dash}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium tabular-nums ${row.balance < 0 ? 'text-danger-dark' : 'text-text'}`}>
                            {row.balance}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
