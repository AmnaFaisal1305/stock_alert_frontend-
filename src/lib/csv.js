// CSV export for lists and ledgers. columns: [{ label, value: (row) => string | number | null }]
// Cells are quoted when needed; formula-leading characters are prefixed with ' so a
// spreadsheet never runs a name like "=HYPERLINK(...)" as a formula.
export function toCsv(columns, rows) {
  const cell = (v) => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.map((c) => cell(c.label)), ...rows.map((r) => columns.map((c) => cell(c.value(r))))]
    .map((line) => line.join(','))
    .join('\r\n')
}

export function downloadCsv(filename, columns, rows) {
  // BOM so Excel opens UTF-8 (Urdu vaccine names) correctly.
  const blob = new Blob(['﻿' + toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking in the same tick can cancel the download in Chromium.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
