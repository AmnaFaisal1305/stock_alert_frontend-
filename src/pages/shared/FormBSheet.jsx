import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSheet, saveSheet, getFacilities } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import Toast from '../../components/ui/Toast'
import { Printer, Save } from 'lucide-react'

// Columns a facility supervisor / head may write = C–G; a UC supervisor = C–J.
// Column I is always computed (= H − G) so it can never fail the server's I = H−G check.
const EDITABLE_BY_ROLE = {
  facility_supervisor: ['c', 'd', 'e', 'f', 'g'],
  facility_head:       ['c', 'd', 'e', 'f', 'g'],
  uc_supervisor:       ['c', 'd', 'e', 'f', 'g', 'h', 'j'],
}

// Data columns, in sheet order. B/I are never directly editable.
const DATA_COLS = [
  { key: 'b', letter: 'B', head: 'Opening Balance',                         unit: 'Doses/Nos.' },
  { key: 'c', letter: 'C', head: 'Received',                                unit: 'Doses/Nos.' },
  { key: 'd', letter: 'D', head: 'Children Vaccinated / Doses Administered', unit: 'Doses/Nos.' },
  { key: 'e', letter: 'E', head: 'Vials Used',                              unit: 'Vials/Nos.' },
  { key: 'f', letter: 'F', head: 'Unusable Vials',                          unit: 'Vials/Nos.' },
  { key: 'g', letter: 'G', head: 'Closing Balance',                         unit: 'Vials/Nos.' },
  { key: 'h', letter: 'H', head: 'Max. Stock Level',                        unit: 'Vials/Nos.' },
  { key: 'i', letter: 'I', head: 'Request (I = H − G)',                     unit: 'Vials/Nos.' },
  { key: 'j', letter: 'J', head: 'Replenishment',                           unit: 'Vials/Nos.' },
]

const SIG_FIELDS = [
  { key: 'preparedBy',     label: 'Prepared By' },
  { key: 'medicalOfficer', label: 'Medical Officer / In-charge (Signature)' },
  { key: 'signatureDate',  label: 'Date' },
]

function ym(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthOptions() {
  const now = new Date()
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { value: ym(d), label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
  })
}

// shortcut: writable-month set is computed in the browser's timezone; the backend
// decides in Pakistan time and returns 422 on mismatch — handled by the save error toast.
function writableMonths() {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return new Set([ym(now), ym(prev)])
}

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body * { visibility: hidden !important; }
  #form-b-print, #form-b-print * { visibility: visible !important; }
  #form-b-print { position: absolute; left: 0; top: 0; width: 100%; }
  #form-b-print input { border: none !important; background: transparent !important; }
  .no-print { display: none !important; }
}
`

export default function FormBSheet() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const role = user?.role
  const needsPicker = role === 'uc_supervisor' || role === 'super_admin' || role === 'observer'

  const [facilityId, setFacilityId] = useState(user?.facilityId ?? null)
  const [month, setMonth] = useState(ym(new Date()))
  const [edits, setEdits] = useState({})      // { [rowKey]: { col: value } }
  const [sigEdits, setSigEdits] = useState(null)
  const [toast, setToast] = useState(null)

  const { data: facData } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => getFacilities(),
    enabled: needsPicker,
    staleTime: 30_000,
  })
  const facilities = facData?.facilities ?? []

  const { data: sheet, isLoading, isError, error } = useQuery({
    queryKey: ['sheet', facilityId, month],
    queryFn: () => getSheet(facilityId, month),
    enabled: !!facilityId,
  })

  const rows = sheet?.rows ?? []
  const rowByKey = useMemo(() => Object.fromEntries(rows.map((r) => [r.key, r])), [rows])

  const editableCols = EDITABLE_BY_ROLE[role] ?? []
  const isWriter = editableCols.length > 0
  const canSave = isWriter && !!facilityId && writableMonths().has(month)

  function cellValue(row, col) {
    const e = edits[row.key]?.[col]
    if (e !== undefined) return e
    return row[col] != null ? String(row[col]) : ''
  }

  // I = H − G, empty when H < G (matches the server's recompute)
  function computeI(row) {
    const h = cellValue(row, 'h')
    const g = cellValue(row, 'g')
    if (h === '' || g === '') return ''
    const diff = Number(h) - Number(g)
    return diff >= 0 ? String(diff) : ''
  }

  function setCell(key, col, raw) {
    const v = raw.replace(/\D/g, '').slice(0, 9)
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], [col]: v } }))
  }

  function resetDraft() {
    setEdits({})
    setSigEdits(null)
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const outRows = Object.entries(edits)
        .map(([key, cols]) => {
          const payload = { key }
          for (const c of editableCols) if (cols[c] !== undefined) payload[c] = cols[c]
          if (role === 'uc_supervisor') payload.i = computeI(rowByKey[key])
          return payload
        })
        .filter((r) => Object.keys(r).length > 1)
      const body = { month }
      if (outRows.length) body.rows = outRows
      if (sigEdits) body.signatures = { ...(sheet?.signatures ?? {}), ...sigEdits }
      return saveSheet(facilityId, body)
    },
    onSuccess: () => {
      resetDraft()
      qc.invalidateQueries({ queryKey: ['sheet', facilityId, month] })
      setToast({ message: 'Sheet saved.', type: 'success' })
    },
    onError: (e) => setToast({ message: e.message || 'Could not save the sheet.', type: 'error' }),
  })

  const fields = sheet?.fields ?? {}
  const hasDraft = Object.keys(edits).length > 0 || sigEdits !== null

  const td = 'border border-black/70 px-1 py-[3px] text-center align-middle text-[11px] text-black'
  const th = 'border border-black/70 px-1 py-1 text-[10px] font-bold text-black bg-[#d9d9d9] leading-tight'

  function dataCell(row, col) {
    if (col === 'd' && row.kind === 'consumable') return <td key={col} className={`${td} bg-[#2b1d16]`} />
    const editable = canSave && col !== 'b' && col !== 'i' && editableCols.includes(col)
    const value = col === 'i' && role === 'uc_supervisor' ? computeI(row) : cellValue(row, col)
    if (editable) {
      return (
        <td key={col} className={`${td} p-0`}>
          <input
            inputMode="numeric"
            value={value}
            onChange={(ev) => setCell(row.key, col, ev.target.value)}
            className="w-full h-full text-center text-[11px] px-1 py-[3px] bg-white focus:bg-amber-50 focus:outline-none"
          />
        </td>
      )
    }
    return <td key={col} className={td}>{value}</td>
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200">
      <style>{PRINT_CSS}</style>

      {/* Header card — title + controls in one row, matching reference design */}
      <div className="no-print bg-surface rounded-2xl border border-surface-border px-5 py-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-text leading-tight">EPI Form B</h1>
          <p className="text-sm text-text-muted mt-0.5">Monthly consumption &amp; requisition — Routine Immunization</p>
        </div>
        <div className="flex flex-wrap items-end gap-3 shrink-0">
          {needsPicker && (
            <div className="w-56">
              <Select
                id="facility"
                label="Facility"
                placeholder="Choose a facility…"
                options={facilities.map((f) => ({ value: f.id, label: f.name }))}
                value={facilityId ?? ''}
                onChange={(e) => { setFacilityId(e.target.value); resetDraft() }}
              />
            </div>
          )}
          <div className="w-44">
            <Select
              id="month"
              label="Month"
              options={monthOptions()}
              value={month}
              onChange={(e) => { setMonth(e.target.value); resetDraft() }}
            />
          </div>
          {isWriter && !canSave && facilityId && (
            <span className="text-xs text-text-muted font-medium self-center">Read-only: only this and last month can be edited.</span>
          )}
          <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={!sheet}>
            <Printer size={14} className="mr-1.5 inline" /> Print / PDF
          </Button>
          {canSave && (
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={!hasDraft || saveMut.isPending}>
              <Save size={14} className="mr-1.5 inline" />
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {!facilityId && (
        <div className="bg-surface rounded-2xl border border-surface-border px-5 py-10 text-center text-sm text-text-muted">
          Choose a facility to view its sheet.
        </div>
      )}

      {facilityId && isLoading && (
        <div className="h-96 bg-surface-alt border border-surface-border rounded-2xl animate-pulse" />
      )}

      {facilityId && isError && (
        <div className="bg-danger-bg border border-danger/10 text-sm font-semibold text-danger rounded-xl px-4 py-3">
          {error?.status === 403 ? 'You do not have access to this facility’s sheet.' : 'Failed to load the sheet.'}
        </div>
      )}

      {/* The printable paper */}
      {facilityId && !isLoading && !isError && sheet && (
        <div className="overflow-x-auto">
          <div id="form-b-print" className="bg-white text-black mx-auto p-6 rounded-lg shadow-sm border border-surface-border" style={{ minWidth: 900 }}>
            {/* Title */}
            <div className="text-center mb-2">
              <p className="text-[10px] text-left font-semibold">Form-B (EPI)</p>
              <p className="text-base font-bold leading-tight">Expanded Program on Immunization, Government of Pakistan</p>
              <p className="text-xs font-bold underline">Consumption &amp; Requisition Form</p>
              <p className="text-sm font-bold underline">Routine Immunization</p>
            </div>

            {/* Header fields (read-only, from the backend) */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] font-semibold mb-3">
              <span>Health Facility/Store: <u>{fields.facility || '—'}</u></span>
              <span>UC: <u>{fields.uc || '—'}</u></span>
              <span>Tehsil/Taluka: <u>{fields.tehsil || '—'}</u></span>
              <span>District: <u>{fields.district || '—'}</u></span>
              <span>Province: <u>{fields.province || '—'}</u></span>
              <span>Date: <u>{fields.date || '—'}</u> (MM/YY)</span>
            </div>

            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '6%' }} />
                {DATA_COLS.map((c) => <col key={c.key} style={{ width: `${79 / DATA_COLS.length}%` }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={3} className={th}>Product</th>
                  <th rowSpan={2} className={th}>Dose per Vial</th>
                  {DATA_COLS.map((c) => <th key={c.key} className={th}>{c.head}</th>)}
                </tr>
                <tr>
                  {DATA_COLS.map((c) => <th key={c.key} className={`${th} font-semibold`}>{c.unit}</th>)}
                </tr>
                <tr>
                  <th className={th}>A</th>
                  {DATA_COLS.map((c) => <th key={c.key} className={th}>{c.letter}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className={`${td} text-left font-bold whitespace-nowrap pl-1.5`}>{row.name}</td>
                    {row.kind !== 'vaccine'
                      ? <td className={`${td} bg-[#2b1d16]`} />
                      : <td className={td}>{row.dosesPerVial ?? ''}</td>}
                    {DATA_COLS.map((c) => dataCell(row, c.key))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="flex flex-wrap justify-between gap-4 mt-5 text-[11px] font-semibold">
              {SIG_FIELDS.map((s) => {
                const val = sigEdits?.[s.key] ?? sheet.signatures?.[s.key] ?? ''
                return (
                  <div key={s.key} className="flex items-end gap-1">
                    <span>{s.label}</span>
                    {isWriter && canSave ? (
                      <input
                        value={val}
                        onChange={(ev) => setSigEdits((p) => ({ ...(p ?? {}), [s.key]: ev.target.value }))}
                        className="border-b border-black/70 bg-white focus:bg-amber-50 focus:outline-none text-[11px] px-1 w-48"
                      />
                    ) : (
                      <span className="border-b border-black/70 min-w-[12rem] inline-block">{val || ' '}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {sheet.lastUpdatedByName && (
              <p className="text-[10px] text-black/60 mt-3 no-print">
                Last saved by {sheet.lastUpdatedByName}
                {sheet.updatedAt ? ` · ${new Date(sheet.updatedAt).toLocaleString()}` : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
