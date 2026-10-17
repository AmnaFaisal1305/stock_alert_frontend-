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

const ENTRY_TYPES = [
  { key: 'all',           label: 'All' },
  { key: 'opening',       label: 'Opening balance' },
  { key: 'received',      label: 'Received' },
  { key: 'used',          label: 'Consumed' },
  { key: 'returned',      label: 'Returned' },
  { key: 'wasted',        label: 'Wasted' },
  { key: 'ADJUST_STOCK',  label: 'Corrected' },
  { key: 'STOCK_DAY_END', label: 'Day end' },
]
const TYPE_LABEL = Object.fromEntries(ENTRY_TYPES.map((t) => [t.key, t.label]))

const dash = <span className="text-text-muted">—</span>

export default function StockRegister() {
  const [{ vaccine: selectedVaccineId, type: entryTypeFilter }, setFilters] = useUrlFilters({ vaccine: '', type: 'all' })
  const setEntryTypeFilter = (type) => setFilters({ type })

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({
    queryKey: ['vaccines'],
    queryFn: getVaccines,
  })
  // Running balance needs the full history, so no `limit`; one call per action keeps it light
  // (the API takes a single action; BACKEND_REQUESTS_SESSION14 B5).
  const { data: logData, isLoading: loadingLog, isError, error, refetch } = useQuery({
    queryKey: ['audit-log', 'register'],
    queryFn: async () => {
      const parts = await Promise.all(['STOCK_ENTRY', 'ADJUST_STOCK', 'STOCK_DAY_END'].map((action) => getAuditLog({ action })))
      return { auditLog: parts.flatMap((p) => p.auditLog ?? []) }
    },
  })

  const vaccines = vaccineData?.vaccines ?? []
  const logs     = logData?.auditLog    ?? []
  const isLoading = loadingVaccines || loadingLog

  const vaccineOptions  = vaccines.map((v) => ({ value: v.id, label: displayVaccineName(v.name) }))
  const selectedVaccine = vaccines.find((v) => v.id === selectedVaccineId)
  const selectedDpv     = selectedVaccine?.dosesPerVial ?? 1

  const entries = useMemo(() => {
    if (!selectedVaccineId) return []

    const relevant = logs
      .filter((l) => {
        if (l.action === 'STOCK_ENTRY' || l.action === 'ADJUST_STOCK') {
          return l.details?.vaccineId === selectedVaccineId
        }
        if (l.action === 'STOCK_DAY_END') {
          return (l.details?.items ?? []).some((i) => i.vaccineId === selectedVaccineId)
        }
        return false
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    let balance = 0
    return relevant.map((l) => {
      const d = l.details ?? {}
      let received = null
      let issued   = null

      if (l.action === 'STOCK_ENTRY') {
        if (d.entryType === 'opening' || d.entryType === 'received') {
          received  = d.quantity ?? 0
          balance  += received
        } else if (d.entryType === 'used') {
          issued   = d.quantity ?? 0
          balance -= issued
        } else if (d.entryType === 'returned') {
          received  = d.quantity ?? 0
          balance  += received
        } else if (d.entryType === 'wasted') {
          issued   = d.quantity ?? 0
          balance -= issued
        }
      } else if (l.action === 'ADJUST_STOCK') {
        const delta = d.delta ?? 0
        if (delta > 0) { received = delta;          balance += delta }
        else           { issued   = Math.abs(delta); balance -= Math.abs(delta) }
      } else if (l.action === 'STOCK_DAY_END') {
        const item = (d.items ?? []).find((i) => i.vaccineId === selectedVaccineId)
        if (item) {
          const dpv = selectedDpv
          const usedDoses     = (item.usedVials    ?? 0) * dpv
          const wastedDoses   = (item.wastedVials  ?? 0) * dpv
          const returnedDoses = (item.returnedVials ?? 0) * dpv
          issued   = usedDoses + wastedDoses
          received = returnedDoses > 0 ? returnedDoses : null
          balance -= issued
          balance += (returnedDoses ?? 0)
        }
      }

      return {
        date:         l.createdAt,
        manufacturer: d.manufacturer  ?? null,
        batchNo:      d.batchNo       ?? null,
        dosesPerVial: d.dosesPerVial  ?? null,
        expiryDate:   d.expiryDate    ?? null,
        received,
        issued,
        balance,
        remarks:      d.remarks       ?? null,
        entryType:    d.entryType     ?? l.action,
      }
    })
  }, [logs, selectedVaccineId, selectedDpv])

  const filteredEntries = useMemo(() => {
    if (entryTypeFilter === 'all') return entries
    return entries.filter((e) => e.entryType === entryTypeFilter)
  }, [entries, entryTypeFilter])

  const chipOptions = useMemo(() => {
    const counts = {}
    entries.forEach((e) => { counts[e.entryType] = (counts[e.entryType] ?? 0) + 1 })
    return ENTRY_TYPES
      .filter((t) => t.key === 'all' || counts[t.key])
      .map((t) => ({ value: t.key, label: t.label, count: t.key === 'all' ? entries.length : counts[t.key] }))
  }, [entries])

  const closing = entries.length ? entries[entries.length - 1].balance : null

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Supervisor › Records"
        title="Stock Register"
        subtitle="Inward and outward ledger for each vaccine, in doses"
      />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 mb-4">
        <div className="w-full sm:w-72">
          <Select
            id="vaccine-select"
            label="Vaccine"
            placeholder="Choose a vaccine…"
            options={vaccineOptions}
            value={selectedVaccineId}
            onChange={(e) => setFilters({ vaccine: e.target.value, type: 'all' })}
            disabled={loadingVaccines}
          />
        </div>
        {closing != null && (
          <p className="text-sm text-text-muted pb-2">
            Closing balance <span className="text-2xl font-light text-text tabular-nums ml-1.5">{closing}</span> doses
          </p>
        )}
        {selectedVaccine && (
          <div className="sm:ml-auto">
            <ExportButton
              name={`stock-register-${selectedVaccine.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              rows={filteredEntries}
              columns={[
                { label: 'Date', value: (r) => `${formatDate(r.date)} ${formatTime(r.date)}` },
                { label: 'Entry', value: (r) => TYPE_LABEL[r.entryType] ?? 'Corrected' },
                { label: 'Manufacturer', value: (r) => r.manufacturer },
                { label: 'Batch', value: (r) => r.batchNo },
                { label: 'Doses/vial', value: (r) => r.dosesPerVial },
                { label: 'Expiry', value: (r) => r.expiryDate },
                { label: 'Received', value: (r) => r.received },
                { label: 'Issued', value: (r) => r.issued },
                { label: 'Balance', value: (r) => r.balance },
                { label: 'Remarks', value: (r) => r.remarks },
              ]}
            />
          </div>
        )}
      </div>

      {isError ? (
        <ErrorState title="Couldn’t load the register" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={5} /></Card>
      ) : !selectedVaccineId ? (
        <EmptyState framed icon={BookOpen} title="Choose a vaccine" message="Its full inward and outward history appears here with a running balance." />
      ) : (
        <div className="flex flex-col gap-3">
          {entries.length > 0 && (
            <FilterChips options={chipOptions} value={entryTypeFilter} onChange={setEntryTypeFilter} label="Entry type" />
          )}
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs font-medium text-text-muted">
                    <th scope="col" className="px-4 py-3 text-left">Date</th>
                    <th scope="col" className="px-4 py-3 text-left">Entry</th>
                    <th scope="col" className="px-4 py-3 text-left">Manufacturer</th>
                    <th scope="col" className="px-4 py-3 text-left">Batch</th>
                    <th scope="col" className="px-4 py-3 text-right">Doses/vial</th>
                    <th scope="col" className="px-4 py-3 text-left">Expiry</th>
                    <th scope="col" className="px-4 py-3 text-right">Received</th>
                    <th scope="col" className="px-4 py-3 text-right">Issued</th>
                    <th scope="col" className="px-4 py-3 text-right">Balance</th>
                    <th scope="col" className="px-4 py-3 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-text-muted">
                        {entries.length === 0 ? 'No stock movements recorded for this vaccine yet.' : 'No entries of this type.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((row, i) => (
                      <tr key={`${row.date}-${i}`} className="hover:bg-surface-alt transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-text">{formatDate(row.date)}</span>
                          <span className="block text-xs text-text-muted">{formatTime(row.date)}</span>
                        </td>
                        <td className="px-4 py-3 text-text whitespace-nowrap">{TYPE_LABEL[row.entryType] ?? 'Corrected'}</td>
                        <td className="px-4 py-3 text-text">{row.manufacturer ?? dash}</td>
                        <td className="px-4 py-3 text-text">{row.batchNo ?? dash}</td>
                        <td className="px-4 py-3 text-right">{row.dosesPerVial ?? dash}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.expiryDate ? formatDate(row.expiryDate) : dash}</td>
                        <td className="px-4 py-3 text-right text-success-dark">{row.received != null ? `+${row.received}` : dash}</td>
                        <td className="px-4 py-3 text-right text-text">{row.issued != null ? `−${row.issued}` : dash}</td>
                        <td className={`px-4 py-3 text-right font-medium ${row.balance < 0 ? 'text-danger-dark' : 'text-text'}`}>{row.balance}</td>
                        <td className="px-4 py-3 text-text capitalize">{row.remarks ?? dash}</td>
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
