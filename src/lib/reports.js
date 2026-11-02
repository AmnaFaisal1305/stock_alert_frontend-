// Downloadable analytics reports (Client Requirements §7, Q24: built in the frontend).
// Pivots the dashboard/analytics `movement` rows into the two reports the client asked
// for — Monthly and Vaccinator-wise — and writes them as .xlsx / .pdf.
// Heavy libs (xlsx, jspdf) are dynamically imported so they stay out of the initial bundle.

// All movement figures are in vials except `usedDoses` (doses). See the backend API reference → /api/analytics.
function sumInto(target, row) {
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
    received: 0, assigned: 0, used: 0, returned: 0,
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

// Stock balance: one row per (facility × vaccine) with the period's start and end stock (Round 44
// `balances`), so start + received + added − deleted − used − wasted = end. A pair with no
// balance row has no ledger entries: 0 / 0.
export function buildBalanceRows(balances = [], movement = []) {
  const acc = {}
  const row = (r) => (acc[`${r.facilityId}||${r.vaccineId}`] ??= {
    facility: r.facilityName ?? '—', vaccine: r.vaccineName, start: 0, end: 0, ...emptyBucket(),
  })
  for (const b of balances) {
    const t = row(b)
    t.start += b.startVials ?? 0
    t.end   += b.endVials ?? 0
  }
  for (const r of movement) sumInto(row(r), r)
  return Object.values(acc).sort(
    (a, b) => a.facility.localeCompare(b.facility) || a.vaccine.localeCompare(b.vaccine),
  )
}

// Vials near expiry per antigen (Round 47 `expiry`, current figures): one total row per vaccine,
// then, when several facilities are in scope, a row per facility x vaccine. Zero rows are left out.
export function buildExpiryRows(expiry = []) {
  const rows = expiry.filter((r) => (r.nearExpiryVials ?? 0) + (r.expiredVials ?? 0) > 0)
  const facilities = new Set(rows.map((r) => r.facilityId))
  const totals = {}
  for (const r of rows) {
    const t = (totals[r.vaccineId] ??= {
      vaccine: r.vaccineName, facility: facilities.size > 1 ? 'All facilities' : (r.facilityName ?? '—'), near: 0, expired: 0,
    })
    t.near    += r.nearExpiryVials ?? 0
    t.expired += r.expiredVials ?? 0
  }
  const byVaccine = Object.values(totals).sort((a, b) => b.near - a.near || a.vaccine.localeCompare(b.vaccine))
  if (facilities.size <= 1) return byVaccine
  const detail = rows
    .map((r) => ({ vaccine: r.vaccineName, facility: r.facilityName ?? '—', near: r.nearExpiryVials ?? 0, expired: r.expiredVials ?? 0 }))
    .sort((a, b) => a.vaccine.localeCompare(b.vaccine) || a.facility.localeCompare(b.facility))
  return [...byVaccine, ...detail]
}

const EXPIRY_COLUMNS = [
  { key: 'vaccine',  label: 'Vaccine' },
  { key: 'facility', label: 'Facility' },
  { key: 'near',     label: 'Near expiry, next 2 months (vials)' },
  { key: 'expired',  label: 'Expired, still on hand (vials)' },
]

const BALANCE_COLUMNS = [
  { key: 'facility', label: 'Facility' },
  { key: 'vaccine',  label: 'Vaccine' },
  { key: 'start',    label: 'Start of period (vials)' },
  { key: 'received', label: 'Received (vials)' },
  { key: 'adjustmentIncrease', label: 'Stock correction: add (vials)' },
  { key: 'adjustmentDecrease', label: 'Stock correction: delete (vials)' },
  { key: 'used',     label: 'Used (vials)' },
  { key: 'wasted',   label: 'Wasted (vials)' },
  { key: 'end',      label: 'End of period (vials)' },
]

const MONTHLY_COLUMNS = [
  { key: 'month',     label: 'Month' },
  { key: 'vaccine',   label: 'Vaccine' },
  { key: 'received',  label: 'Received (vials)' },
  { key: 'assigned',  label: 'Assigned (vials)' },
  { key: 'used',      label: 'Used (vials)' },
  { key: 'usedDoses', label: 'Used (doses)' },
  { key: 'returned',  label: 'Returned (vials)' },
  { key: 'wasted',    label: 'Wasted (vials)' },
  { key: 'adjustmentIncrease', label: 'Stock correction: add (vials)' },
  { key: 'adjustmentDecrease', label: 'Stock correction: delete (vials)' },
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

function fileBase(from, to, vaccineName) {
  const v = vaccineName ? `_${vaccineName.replace(/[^\w-]+/g, '-')}` : ''
  return `stock-report${v}_${from || 'start'}_to_${to || 'today'}`
}

export async function exportAnalyticsExcel({ movement, balances, expiry, from, to, vaccineName }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  if (balances) {
    XLSX.utils.book_append_sheet(
      wb, XLSX.utils.aoa_to_sheet(aoa(BALANCE_COLUMNS, buildBalanceRows(balances, movement))), 'Stock balance',
    )
  }
  if (expiry) {
    XLSX.utils.book_append_sheet(
      wb, XLSX.utils.aoa_to_sheet(aoa(EXPIRY_COLUMNS, buildExpiryRows(expiry))), 'Vials near expiry',
    )
  }
  XLSX.utils.book_append_sheet(
    wb, XLSX.utils.aoa_to_sheet(aoa(MONTHLY_COLUMNS, buildMonthlyRows(movement))), 'Monthly',
  )
  XLSX.utils.book_append_sheet(
    wb, XLSX.utils.aoa_to_sheet(aoa(VACCINATOR_COLUMNS, buildVaccinatorRows(movement))), 'Vaccinator-wise',
  )
  XLSX.writeFile(wb, `${fileBase(from, to, vaccineName)}.xlsx`)
}

export async function exportAnalyticsPdf({ movement, balances, expiry, from, to, vaccineName }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape' })
  const title = `Stock Report${vaccineName ? ` · ${vaccineName}` : ''}  ${from || 'start'} → ${to || 'today'}`

  doc.setFontSize(13)
  doc.text(title, 14, 14)

  doc.setFontSize(10)
  let y = 24
  if (balances) {
    doc.text('Stock balance', 14, y)
    autoTable(doc, {
      startY: y + 3,
      head: [BALANCE_COLUMNS.map((c) => c.label)],
      body: buildBalanceRows(balances, movement).map((r) => BALANCE_COLUMNS.map((c) => cell(c, r))),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [0, 98, 65] },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 8
  }
  if (expiry) {
    const rows = buildExpiryRows(expiry)
    doc.text('Vials near expiry (on hand now)', 14, y)
    autoTable(doc, {
      startY: y + 3,
      head: [EXPIRY_COLUMNS.map((c) => c.label)],
      body: rows.length ? rows.map((r) => EXPIRY_COLUMNS.map((c) => cell(c, r))) : [['No vials expire in the next two months', '', '', '']],
      styles: { fontSize: 7 },
      headStyles: { fillColor: [0, 98, 65] },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 8
  }
  doc.text('Monthly', 14, y)
  const monthly = buildMonthlyRows(movement)
  autoTable(doc, {
    startY: y + 3,
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

  doc.save(`${fileBase(from, to, vaccineName)}.pdf`)
}
