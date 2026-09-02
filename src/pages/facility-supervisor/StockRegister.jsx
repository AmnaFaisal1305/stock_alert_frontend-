import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, getVaccines } from '../../lib/api'
import Select from '../../components/ui/Select'
import { BookOpen, Syringe } from 'lucide-react'
import { displayVaccineName } from '../../lib/vaccineNames'

const ENTRY_TYPE_PILLS = [
  { key: 'all',      label: 'All',       activeClass: 'bg-primary text-white border-primary'     },
  { key: 'received', label: 'Received',  activeClass: 'bg-success text-white border-success'     },
  { key: 'used',     label: 'Consumed',  activeClass: 'bg-danger text-white border-danger'       },
  { key: 'returned', label: 'Returned',  activeClass: 'bg-warning text-white border-warning'     },
  { key: 'ADJUST_STOCK', label: 'Corrected', activeClass: 'bg-slate-500 text-white border-slate-500' },
]

export default function StockRegister() {
  const [selectedVaccineId, setSelectedVaccineId] = useState('')
  const [entryTypeFilter, setEntryTypeFilter] = useState('all')

  const { data: vaccineData, isLoading: loadingVaccines } = useQuery({
    queryKey: ['vaccines'],
    queryFn: getVaccines,
  })
  const { data: logData, isLoading: loadingLog } = useQuery({
    queryKey: ['audit-log'],
    queryFn: getAuditLog,
  })

  const vaccines = vaccineData?.vaccines ?? []
  const logs     = logData?.auditLog    ?? []
  const isLoading = loadingVaccines || loadingLog

  const vaccineOptions = vaccines.map((v) => ({ value: v.id, label: displayVaccineName(v.name) }))
  const selectedName   = vaccines.find((v) => v.id === selectedVaccineId)?.name ?? ''

  const entries = useMemo(() => {
    if (!selectedVaccineId) return []

    const relevant = logs
      .filter((l) =>
        (l.action === 'STOCK_ENTRY' || l.action === 'ADJUST_STOCK') &&
        l.details?.vaccineId === selectedVaccineId
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    let balance = 0
    return relevant.map((l) => {
      const d = l.details ?? {}
      let received = null
      let issued   = null

      if (l.action === 'STOCK_ENTRY') {
        if (d.entryType === 'received') {
          received  = d.quantity ?? 0
          balance  += received
        } else if (d.entryType === 'used') {
          issued   = d.quantity ?? 0
          balance -= issued
        } else if (d.entryType === 'returned') {
          received  = d.quantity ?? 0
          balance  += received
        }
      } else if (l.action === 'ADJUST_STOCK') {
        const delta = d.delta ?? 0
        if (delta > 0) { received = delta;          balance += delta }
        else           { issued   = Math.abs(delta); balance -= Math.abs(delta) }
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
  }, [logs, selectedVaccineId])

  const filteredEntries = useMemo(() => {
    if (entryTypeFilter === 'all') return entries
    return entries.filter((e) => e.entryType === entryTypeFilter)
  }, [entries, entryTypeFilter])

  const pillCounts = useMemo(() => {
    const counts = { all: entries.length, received: 0, used: 0, returned: 0, ADJUST_STOCK: 0 }
    entries.forEach((e) => { if (e.entryType in counts) counts[e.entryType]++ })
    return counts
  }, [entries])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Stock Register</h1>
          <p className="text-sm text-white/70 mt-0.5">EPI inward &amp; outward vaccine ledger</p>
        </div>
        <BookOpen size={22} className="text-white/30 flex-shrink-0" />
      </div>

      {/* Vaccine selector */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-sm">
        <Select
          id="vaccine-select"
          label="Select Vaccine"
          placeholder="Choose a vaccine to view its register…"
          options={vaccineOptions}
          value={selectedVaccineId}
          onChange={(e) => { setSelectedVaccineId(e.target.value); setEntryTypeFilter('all') }}
          disabled={loadingVaccines}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* No vaccine selected */}
      {!isLoading && !selectedVaccineId && (
        <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
          <Syringe size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold text-text">No vaccine selected</p>
          <p className="text-xs mt-1">Select a vaccine above to view its inward &amp; outward ledger.</p>
        </div>
      )}

      {/* Register table */}
      {!isLoading && selectedVaccineId && (
        <div className="flex flex-col gap-3">
          {/* Sub-header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Syringe size={14} className="text-primary flex-shrink-0" />
              <span className="text-sm font-bold text-text">{displayVaccineName(selectedName)}</span>
            </div>
            <span className="text-[10px] font-bold text-text-muted bg-white border border-surface-border px-2.5 py-1 rounded-lg">
              {filteredEntries.length}{entryTypeFilter !== 'all' ? ` of ${entries.length}` : ''} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {/* Entry Type filter pills */}
          {entries.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {ENTRY_TYPE_PILLS.map(({ key, label, activeClass }) => (
                <button
                  key={key}
                  onClick={() => setEntryTypeFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                    entryTypeFilter === key
                      ? activeClass
                      : 'bg-white border-surface-border text-text-muted hover:text-text hover:border-slate-300'
                  }`}
                >
                  {label}
                  <span className="opacity-75">({pillCounts[key] ?? 0})</span>
                </button>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm border-collapse">

                {/* Column headers */}
                <thead>
                  {/* Row 1: group labels */}
                  <tr className="bg-slate-50 border-b border-surface-border">
                    <th rowSpan={2} className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-3 text-left border-r border-surface-border whitespace-nowrap align-middle">
                      Date &amp; Time
                    </th>
                    <th rowSpan={2} className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-3 text-left border-r border-surface-border whitespace-nowrap align-middle">
                      Entry Type
                    </th>
                    <th colSpan={4} className="text-[10px] font-bold text-primary uppercase tracking-widest px-4 py-2 text-center border-r border-surface-border border-b border-surface-border">
                      Article Particulars
                    </th>
                    <th colSpan={3} className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-2 text-center border-r border-surface-border border-b border-surface-border">
                      Quantity
                    </th>
                    <th rowSpan={2} className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-3 text-left align-middle">
                      Remarks
                    </th>
                  </tr>
                  {/* Row 2: sub-column labels */}
                  <tr className="bg-slate-50 border-b border-surface-border">
                    <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-2 text-left whitespace-nowrap">
                      Manufacturer
                    </th>
                    <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-2 text-left whitespace-nowrap">
                      Batch No
                    </th>
                    <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-2 text-center whitespace-nowrap">
                      Doses / Vial
                    </th>
                    <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-2 text-left border-r border-surface-border whitespace-nowrap">
                      Expiry Date
                    </th>
                    <th className="text-[10px] font-bold text-success-dark uppercase tracking-widest px-4 py-2 text-center bg-success-bg/20 whitespace-nowrap">
                      Received
                    </th>
                    <th className="text-[10px] font-bold text-danger uppercase tracking-widest px-4 py-2 text-center bg-danger-bg/20 whitespace-nowrap">
                      Consumed
                    </th>
                    <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 py-2 text-center border-r border-surface-border whitespace-nowrap">
                      Balance
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-surface-border">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-14 text-center text-sm text-text-muted">
                        {entries.length === 0
                          ? 'No stock entries recorded for this vaccine yet.'
                          : `No ${ENTRY_TYPE_PILLS.find((p) => p.key === entryTypeFilter)?.label.toLowerCase()} entries found.`}
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((row, i) => {
                      const entryTypeMeta = (() => {
                        switch (row.entryType) {
                          case 'received':  return { label: 'Received', cls: 'bg-success-bg text-success-dark' }
                          case 'used':      return { label: 'Consumed', cls: 'bg-danger-bg text-danger' }
                          case 'returned':  return { label: 'Returned', cls: 'bg-warning-bg text-warning-dark' }
                          default:          return { label: 'Corrected', cls: 'bg-slate-100 text-text-muted' }
                        }
                      })()
                      return (
                      <tr key={i} className="hover:bg-slate-50/40 transition-colors">

                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs font-semibold text-text">
                            {new Date(row.date).toLocaleDateString('en-US', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                          <p className="text-[10px] text-text-muted font-medium mt-0.5">
                            {new Date(row.date).toLocaleTimeString('en-US', {
                              hour: 'numeric', minute: '2-digit', hour12: true,
                            })}
                          </p>
                        </td>

                        {/* Entry Type */}
                        <td className="px-4 py-3 border-r border-surface-border">
                          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded ${entryTypeMeta.cls}`}>
                            {entryTypeMeta.label}
                          </span>
                        </td>

                        {/* Manufacturer */}
                        <td className="px-4 py-3 text-xs font-medium text-text">
                          {row.manufacturer ?? <span className="text-text-muted">—</span>}
                        </td>

                        {/* Batch No */}
                        <td className="px-4 py-3 text-xs font-medium text-text">
                          {row.batchNo ?? <span className="text-text-muted">—</span>}
                        </td>

                        {/* Doses per vial */}
                        <td className="px-4 py-3 text-xs font-medium text-text text-center">
                          {row.dosesPerVial ?? <span className="text-text-muted">—</span>}
                        </td>

                        {/* Expiry date */}
                        <td className="px-4 py-3 text-xs font-medium text-text whitespace-nowrap">
                          {row.expiryDate ?? <span className="text-text-muted">—</span>}
                        </td>

                        {/* Received */}
                        <td className="px-4 py-3 text-center border-l border-surface-border bg-success-bg/5">
                          {row.received != null
                            ? <span className="text-success-dark font-bold text-sm">+{row.received}</span>
                            : <span className="text-text-muted text-xs">—</span>}
                        </td>

                        {/* Issued */}
                        <td className="px-4 py-3 text-center bg-danger-bg/5">
                          {row.issued != null
                            ? <span className="text-danger font-bold text-sm">{row.issued}</span>
                            : <span className="text-text-muted text-xs">—</span>}
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-3 text-center border-r border-surface-border">
                          <span className={`font-bold text-sm tabular-nums ${
                            row.balance > 0 ? 'text-text' : row.balance === 0 ? 'text-text-muted' : 'text-danger'
                          }`}>
                            {row.balance}
                          </span>
                        </td>

                        {/* Remarks */}
                        <td className="px-4 py-3 text-xs font-medium text-text capitalize">
                          {row.remarks ?? <span className="text-text-muted">—</span>}
                        </td>

                      </tr>
                      )
                    })
                  )}
                </tbody>

              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
