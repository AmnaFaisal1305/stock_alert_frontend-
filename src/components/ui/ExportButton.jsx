import { useState } from 'react'
import { Download } from 'lucide-react'
import Button from './Button'
import { downloadCsv } from '../../lib/csv'
import { localDateStr } from '../../lib/format'

// "Export CSV" for a list. Pass `rows` (what is on screen after filters, all pages) or
// `getRows` (async, for server-paged lists). `name` becomes name-YYYY-MM-DD.csv.
export default function ExportButton({ name, columns, rows, getRows, disabled = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    try {
      downloadCsv(`${name}-${localDateStr()}.csv`, columns, getRows ? await getRows() : rows)
    } catch (e) {
      setError(e.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span role="alert" className="text-xs text-danger-dark">{error}</span>}
      <Button variant="secondary" onClick={run} disabled={disabled || busy || (!getRows && !rows?.length)} aria-label="Export CSV" title="Export CSV">
        <Download size={16} strokeWidth={1.75} />
        {/* icon-only on phones so it fits beside the search box */}
        <span className="hidden sm:inline">{busy ? 'Exporting…' : 'Export CSV'}</span>
      </Button>
    </span>
  )
}
