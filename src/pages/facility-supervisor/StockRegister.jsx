import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { BookOpen } from 'lucide-react'

const ENTRY_TYPES = [
  { key: 'all',           label: 'All' },
  { key: 'opening',       label: 'Opening' },
  { key: 'received',      label: 'Received' },
  { key: 'used',          label: 'Used' },
  { key: 'returned',      label: 'Returned' },
  { key: 'wasted',        label: 'Wasted' },
  { key: 'ADJUST_STOCK',  label: 'Correction' },
  { key: 'STOCK_DAY_END', label: 'Day End' },
]
const TYPE_LABEL = Object.fromEntries(ENTRY_TYPES.map((t) => [t.key, t.label]))

const dash = <span className="text-text-muted">—</span>
const num = (v, cls = '') => v != null ? <span className={`tabular-nums ${cls}`}>{v}</span> : dash

export default function StockRegister() {
  const [{ vaccine: selectedVaccineId, type: entryTypeFilter }, setFilters] = useUrlFilters({ vaccine: '', type: 'all' })

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: logData, isLoading: loadingLog, isError, error, refetch } = useQuery({
    queryKey: ['audit-log', 'register'],
    queryFn: async () => {
      const parts = await Promise.all(['STOCK_ENTRY', 'ADJUST_STOCK', 'STOCK_DAY_END'].map((action) => getAuditLog({ action })))
      return { auditLog: parts.flatMap((p) => p.auditLog ?? []) }
    },
  })

  const vaccines   = vaccineData?.vaccines ?? []
  const logs       = logData?.auditLog    ?? []
  const isLoading  = loadingVaccines || loadingLog

  // dosesPerVial lookup needed to convert STOCK_DAY_END vials → doses
  const dpvById = useMemo(
    () => Object.fromEntries(vaccines.map((v) => [v.id, v.dosesPerVial ?? 1])),
    [vaccines],
  )

  const vaccineOptions = useMemo(() => [
    { value: '', label: 'All vaccines' },
    ...vaccines.map((v) => ({ value: v.id, label: displayVaccineName(v.name) })),
  ], [vaccines])

  // Flatten all audit log entries into one row per movement, expanding STOCK_DAY_END per vaccine.
  const rows = useMemo(() => {
    const result = []

    for (const l of logs) {
      const d = l.details ?? {}

      if (l.action === 'STOCK_ENTRY') {
        if (selectedVaccineId && d.vaccineId !== selectedVaccineId) continue
        const et = d.entryType
        result.push({
          date:         l.createdAt,
          vaccineName:  displayVaccineName(d.vaccineName ?? ''),
          entryType:    et,
          manufacturer: d.manufacturer ?? null,
          batchNo:      d.batchNo      ?? null,
          dosesPerVial: d.dosesPerVial ?? null,
          expiryDate:   d.expiryDate   ?? null,
          received: (et === 'opening' || et === 'received') ? (d.quantity ?? 0) : null,
          used:     et === 'used'     ? (d.quantity ?? 0) : null,
          returned: et === 'returned' ? (d.quantity ?? 0) : null,
          wasted:   et === 'wasted'   ? (d.quantity ?? 0) : null,
        })

      } else if (l.action === 'ADJUST_STOCK') {
        if (selectedVaccineId && d.vaccineId !== selectedVaccineId) continue
        const delta = d.delta ?? 0
        result.push({
          date:         l.createdAt,
          vaccineName:  displayVaccineName(d.vaccineName ?? ''),
          entryType:    'ADJUST_STOCK',
          manufacturer: null, batchNo: null, dosesPerVial: null, expiryDate: null,
          received: delta > 0 ? delta : null,
          used:     delta < 0 ? Math.abs(delta) : null,
          returned: null,
          wasted:   null,
        })

      } else if (l.action === 'STOCK_DAY_END') {
        for (const item of (d.items ?? [])) {
          if (selectedVaccineId && item.vaccineId !== selectedVaccineId) continue
          const dpv = dpvById[item.vaccineId] ?? 1
          const usedDoses     = (item.usedVials     ?? 0) * dpv
          const returnedDoses = (item.returnedVials  ?? 0) * dpv
          const wastedDoses   = (item.wastedVials    ?? 0) * dpv
          if (!usedDoses && !returnedDoses && !wastedDoses) continue
          result.push({
            date:         l.createdAt,
            vaccineName:  displayVaccineName(item.vaccineName ?? ''),
            entryType:    'STOCK_DAY_END',
            manufacturer: null, batchNo: null, dosesPerVial: dpv, expiryDate: null,
            received: null,
            used:     usedDoses     || null,
            returned: returnedDoses || null,
            wasted:   wastedDoses   || null,
          })
        }
      }
    }

    // Newest first
    return result.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [logs, selectedVaccineId, dpvById])

  const filteredRows = useMemo(() => {
    if (entryTypeFilter === 'all') return rows
    return rows.filter((r) => r.entryType === entryTypeFilter)
  }, [rows, entryTypeFilter])

  const chipOptions = useMemo(() => {
    const counts = {}
    rows.forEach((r) => { counts[r.entryType] = (counts[r.entryType] ?? 0) + 1 })
    return ENTRY_TYPES
      .filter((t) => t.key === 'all' || counts[t.key])
      .map((t) => ({ value: t.key, label: t.label, count: t.key === 'all' ? rows.length : counts[t.key] }))
  }, [rows])

  const exportColumns = [
    { label: 'Date',         value: (r) => `${formatDate(r.date)} ${formatTime(r.date)}` },
    { label: 'Vaccine',      value: (r) => r.vaccineName },
    { label: 'Entry',        value: (r) => TYPE_LABEL[r.entryType] ?? r.entryType },
    { label: 'Manufacturer', value: (r) => r.manufacturer },
    { label: 'Batch',        value: (r) => r.batchNo },
    { label: 'Doses/vial',   value: (r) => r.dosesPerVial },
    { label: 'Expiry',       value: (r) => r.expiryDate },
    { label: 'Received',     value: (r) => r.received },
    { label: 'Used',         value: (r) => r.used },
    { label: 'Returned',     value: (r) => r.returned },
    { label: 'Wasted',       value: (r) => r.wasted },
  ]

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Supervisor › Records"
        title="Stock Register"
        subtitle="All vaccine movements — received, used, returned and wasted"
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
            <FilterChips options={chipOptions} value={entryTypeFilter} onChange={(v) => setFilters({ type: v })} label="Entry type" />
          )}
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs font-medium text-text-muted">
                    <th scope="col" className="px-4 py-3 text-left">Date</th>
                    <th scope="col" className="px-4 py-3 text-left">Vaccine</th>
                    <th scope="col" className="px-4 py-3 text-left">Entry</th>
                    <th scope="col" className="px-4 py-3 text-left">Manufacturer</th>
                    <th scope="col" className="px-4 py-3 text-left">Batch</th>
                    <th scope="col" className="px-4 py-3 text-right">Doses/vial</th>
                    <th scope="col" className="px-4 py-3 text-left">Expiry</th>
                    <th scope="col" className="px-4 py-3 text-right">Received</th>
                    <th scope="col" className="px-4 py-3 text-right">Used</th>
                    <th scope="col" className="px-4 py-3 text-right">Returned</th>
                    <th scope="col" className="px-4 py-3 text-right">Wasted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-text-muted">
                        No entries of this type.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, i) => (
                      <tr key={`${row.date}-${i}`} className="hover:bg-surface-alt transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-text">{formatDate(row.date)}</span>
                          <span className="block text-xs text-text-muted">{formatTime(row.date)}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-text whitespace-nowrap" dir="auto">{row.vaccineName || dash}</td>
                        <td className="px-4 py-3 text-text whitespace-nowrap">{TYPE_LABEL[row.entryType] ?? row.entryType}</td>
                        <td className="px-4 py-3 text-text">{row.manufacturer ?? dash}</td>
                        <td className="px-4 py-3 text-text">{row.batchNo ?? dash}</td>
                        <td className="px-4 py-3 text-right">{row.dosesPerVial ?? dash}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.expiryDate ? formatDate(row.expiryDate) : dash}</td>
                        <td className="px-4 py-3 text-right text-success-dark">{num(row.received)}</td>
                        <td className="px-4 py-3 text-right text-danger-dark">{num(row.used)}</td>
                        <td className="px-4 py-3 text-right">{num(row.returned)}</td>
                        <td className="px-4 py-3 text-right text-warning-dark">{num(row.wasted)}</td>
                      </tr>
                    ))
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
