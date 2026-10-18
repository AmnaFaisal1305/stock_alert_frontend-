// Downloadable analytics reports (Client Requirements §7, Q24: built in the frontend).
// Pivots the dashboard/analytics `movement` rows into the two reports the client asked
// for — Monthly and Vaccinator-wise — and writes them as .xlsx / .pdf.
// Heavy libs (xlsx, jspdf) are dynamically imported so they stay out of the initial bundle.

// All movement figures are in vials except `usedDoses` (doses). See the backend API reference → /api/analytics.
function sumInto(target, row) {
  target.opening            += row.opening            ?? 0
  target.received           += row.received           ?? 0
  target.assigned           += row.assigned           ?? 0
  target.used               += row.used               ?? 0
  target.returned           += row.returned           ?? 0
  target.wasted             += row.wasted             ?? 0
  target.adjustmentIncrease += row.adjustmentIncrease ?? 0
  target.adjustmentDecrease += row.adjustmentDecrease ?? 0
  target.usedDoses          += row.usedDoses          ?? 0
}

function emptyBucket() {
  return {
    opening: 0, received: 0, assigned: 0, used: 0, returned: 0,
    wasted: 0, adjustmentIncrease: 0, adjustmentDecrease: 0, usedDoses: 0,
  }
}

// Monthly: one row per (month × vaccine), summed across facilities and workers.
export function buildMonthlyRows(movement) {
  const acc = {}
  for (const r of movement) {
    const key = `${r.month}||${r.vaccineId}`
    if (!acc[key]) acc[key] = { month: r.month, vaccine: r.vaccineName, ...emptyBucket() }
    sumInto(acc[key], r)
  }
  return Object.values(acc).sort(
    (a, b) => b.month.localeCompare(a.month) || a.vaccine.localeCompare(b.vaccine),
  )
}

// Vaccinator-wise: one row per (vaccinator × vaccine). Only rows attributed to a worker
// (store-side rows have workerId null and are excluded).
export function buildVaccinatorRows(movement) {
  const acc = {}
  for (const r of movement) {
    if (!r.workerId) continue
    const key = `${r.workerId}||${r.vaccineId}`
    if (!acc[key]) acc[key] = { vaccinator: r.workerName ?? '—', vaccine: r.vaccineName, ...emptyBucket() }
    sumInto(acc[key], r)
  }
  return Object.values(acc).sort(
    (a, b) => a.vaccinator.localeCompare(b.vaccinator) || a.vaccine.localeCompare(b.vaccine),
  )
}

const netAdj = (r) => r.adjustmentIncrease - r.adjustmentDecrease

const MONTHLY_COLUMNS = [
  { key: 'month',     label: 'Month' },
  { key: 'vaccine',   label: 'Vaccine' },
  { key: 'opening',   label: 'Opening (vials)' },
  { key: 'received',  label: 'Received (vials)' },
  { key: 'assigned',  label: 'Assigned (vials)' },
  { key: 'used',      label: 'Used (vials)' },
  { key: 'usedDoses', label: 'Used (doses)' },
  { key: 'returned',  label: 'Returned (vials)' },
  { key: 'wasted',    label: 'Wasted (vials)' },
  { key: 'adj',       label: 'Adj. (net vials)', get: netAdj },
]

const VACCINATOR_COLUMNS = [
  { key: 'vaccinator', label: 'Vaccinator' },
  { key: 'vaccine',    label: 'Vaccine' },
  { key: 'assigned',   label: 'Assigned (vials)' },
  { key: 'used',       label: 'Used (vials)' },
  { key: 'usedDoses',  label: 'Used (doses)' },
  { key: 'returned',   label: 'Returned (vials)' },
  { key: 'wasted',     label: 'Wasted (vials)' },
]

const cell = (col, row) => (col.get ? col.get(row) : row[col.key])
const aoa = (cols, rows) => [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => cell(c, r)))]

function fileBase(from, to) {
  return `stock-report_${from || 'start'}_to_${to || 'today'}`
}

export async function exportAnalyticsExcel({ movement, from, to }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb, XLSX.utils.aoa_to_sheet(aoa(MONTHLY_COLUMNS, buildMonthlyRows(movement))), 'Monthly',
  )
  XLSX.utils.book_append_sheet(
    wb, XLSX.utils.aoa_to_sheet(aoa(VACCINATOR_COLUMNS, buildVaccinatorRows(movement))), 'Vaccinator-wise',
  )
  XLSX.writeFile(wb, `${fileBase(from, to)}.xlsx`)
}

export async function exportAnalyticsPdf({ movement, from, to }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape' })
  const title = `Stock Report  ${from || 'start'} → ${to || 'today'}`

  doc.setFontSize(13)
  doc.text(title, 14, 14)

  doc.setFontSize(10)
  doc.text('Monthly', 14, 24)
  const monthly = buildMonthlyRows(movement)
  autoTable(doc, {
    startY: 27,
    head: [MONTHLY_COLUMNS.map((c) => c.label)],
    body: monthly.map((r) => MONTHLY_COLUMNS.map((c) => cell(c, r))),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [0, 98, 65] },
  })

  const vaccinator = buildVaccinatorRows(movement)
  const afterMonthly = doc.lastAutoTable?.finalY ?? 30
  doc.text('Vaccinator-wise', 14, afterMonthly + 8)
  autoTable(doc, {
    startY: afterMonthly + 11,
    head: [VACCINATOR_COLUMNS.map((c) => c.label)],
    body: vaccinator.map((r) => VACCINATOR_COLUMNS.map((c) => cell(c, r))),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [0, 98, 65] },
  })

  doc.save(`${fileBase(from, to)}.pdf`)
}
