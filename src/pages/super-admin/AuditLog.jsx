import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, getVaccines } from '../../lib/api'
import Table from '../../components/shared/Table'
import Input from '../../components/ui/Input'

function humanizeKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

function formatDetails(row, vaccineNameById) {
  const d = row.details
  if (!d) return '—'

  const vaccineName = (id) => vaccineNameById[id] ?? (id ? `vaccine ${String(id).slice(0, 8)}…` : 'unknown vaccine')

  switch (row.action) {
    case 'STOCK_ENTRY': {
      const verb = d.entryType === 'used' ? 'used' : d.entryType === 'legacy' ? 'recorded (legacy)' : 'received'
      return `${d.quantity} doses ${verb} — ${vaccineName(d.vaccineId)}`
    }
    case 'ADJUST_STOCK':
      return `Stock corrected ${d.delta > 0 ? '+' : ''}${d.delta} (${d.previousBalance} → ${d.newBalance}) — ${vaccineName(d.vaccineId)}`
    case 'SET_THRESHOLD':
      return `Minimum set to ${d.minQuantity} — ${vaccineName(d.vaccineId)}`
    case 'CREATE_VACCINE':
      return `Added "${d.name ?? vaccineName(d.vaccineId)}"`
    case 'DELETE_VACCINE':
      return `Deleted "${d.name ?? vaccineName(d.vaccineId)}"`
    case 'EDIT_VACCINE': {
      const newName = d.newName ?? d.name ?? vaccineName(d.vaccineId)
      return d.oldName ? `Renamed "${d.oldName}" → "${newName}"` : `Renamed to "${newName}"`
    }
    case 'CREATE_USER':
      return `${(d.role ?? '').replace(/_/g, ' ')} — ${d.email}`
    case 'CREATE_DISTRICT':
    case 'EDIT_DISTRICT':
    case 'DEACTIVATE_DISTRICT':
    case 'ACTIVATE_DISTRICT':
    case 'CREATE_FACILITY':
    case 'EDIT_FACILITY':
    case 'DEACTIVATE_FACILITY':
    case 'ACTIVATE_FACILITY':
      return `"${d.name}"`
    default:
      return Object.entries(d).map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(', ')
  }
}

export default function AuditLog({ title = 'Audit Log', subtitle = 'System-wide activity history' }) {
  const [dateFilter,   setDateFilter]   = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log'],
    queryFn: getAuditLog,
  })
  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const vaccineNameById = Object.fromEntries((vaccineData?.vaccines ?? []).map((v) => [v.id, v.name]))

  const logs = data?.auditLog ?? []
  const hasFilters = !!(dateFilter || actionFilter)

  const filtered = logs.filter((l) => {
    const matchDate   = !dateFilter   || l.createdAt?.startsWith(dateFilter)
    const matchAction = !actionFilter || l.action?.toLowerCase().includes(actionFilter.toLowerCase())
    return matchDate && matchAction
  })

  const columns = [
    { key: 'createdAt', label: 'Date / Time', render: (row) => new Date(row.createdAt).toLocaleString() },
    { key: 'actor', label: 'Actor', render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm text-text">{row.actorName ?? '—'}</span>
          {row.actorRole && (
            <span className="text-[10px] text-text-muted uppercase tracking-wide">{row.actorRole.replace(/_/g, ' ')}</span>
          )}
        </div>
      )
    },
    { key: 'action',    label: 'Action',      render: (row) => (
        <span className="font-mono text-xs bg-surface-alt px-2 py-0.5 rounded">{row.action}</span>
      )
    },
    { key: 'entityType',  label: 'Entity'      },
    { key: 'districtName', label: 'District', render: (row) => row.districtName ?? '—' },
    { key: 'facilityName', label: 'Facility', render: (row) => row.facilityName ?? '—' },
    { key: 'details',     label: 'Details',    render: (row) => (
        <span className="text-xs text-text-muted">{formatDetails(row, vaccineNameById)}</span>
      )
    },
  ]

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
        <Table
          columns={columns}
          rows={filtered}
          emptyMessage={hasFilters ? 'No log entries match your filters.' : 'No activity recorded yet.'}
        />
      )}
    </div>
  )
}
