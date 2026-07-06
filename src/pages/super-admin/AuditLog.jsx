import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog } from '../../lib/api'
import Table from '../../components/shared/Table'
import Input from '../../components/ui/Input'

const columns = [
  { key: 'createdAt', label: 'Date / Time', render: (row) => new Date(row.createdAt).toLocaleString() },
  { key: 'action',    label: 'Action',      render: (row) => (
      <span className="font-mono text-xs bg-surface-alt px-2 py-0.5 rounded">{row.action}</span>
    )
  },
  { key: 'entityType',  label: 'Entity'      },
  { key: 'details',     label: 'Details',    render: (row) => (
      <span className="text-xs text-text-muted">
        {row.details ? JSON.stringify(row.details) : '—'}
      </span>
    )
  },
]

export default function AuditLog({ title = 'Audit Log', subtitle = 'System-wide activity history' }) {
  const [dateFilter,   setDateFilter]   = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log'],
    queryFn: getAuditLog,
  })

  const logs = data?.auditLog ?? []

  const filtered = logs.filter((l) => {
    const matchDate   = !dateFilter   || l.createdAt?.startsWith(dateFilter)
    const matchAction = !actionFilter || l.action?.toLowerCase().includes(actionFilter.toLowerCase())
    return matchDate && matchAction
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">{title}</h1>
        <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <Input id="date-filter" label="Filter by date" type="date"
            value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
        <div className="w-56">
          <Input id="action-filter" label="Filter by action" placeholder="e.g. CREATE"
            value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} />
        </div>
      </div>

      {isLoading && <p className="text-text-muted">Loading…</p>}
      {isError   && <p className="text-danger">Failed to load audit log.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={filtered} emptyMessage="No log entries match your filters." />
      )}
    </div>
  )
}
