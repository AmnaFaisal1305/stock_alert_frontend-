import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalytics } from '../../lib/api'
import { displayVaccineName } from '../../lib/vaccineNames'
import Table from '../../components/shared/Table'
import StatCard from '../../components/shared/StatCard'
import DatePicker from '../../components/ui/DatePicker'
import { Package, TrendingDown, AlertTriangle, Clock } from 'lucide-react'

function defaultFrom() {
  const d = new Date()
  d.setMonth(d.getMonth() - 11)
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

const TABS = [
  { id: 'movement',  label: 'Movement'          },
  { id: 'remaining', label: 'Remaining Stock'    },
  { id: 'requests',  label: 'Requests'           },
  { id: 'approvals', label: 'Pending Approvals'  },
]

export default function Analytics() {
  const [from, setFrom]     = useState(defaultFrom)
  const [to, setTo]         = useState(() => new Date().toISOString().split('T')[0])
  const [activeTab, setTab] = useState('movement')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', from, to],
    queryFn: () => getAnalytics({ from, to }),
  })

  const movement        = data?.movement        ?? []
  const remaining       = data?.remaining       ?? []
  const requests        = data?.requests        ?? []
  const pendingApprovals = data?.pendingApprovals ?? []

  const vaccineMovement = useMemo(() => {
    const acc = {}
    for (const row of movement) {
      if (!acc[row.vaccineId]) {
        acc[row.vaccineId] = {
          vaccineName: displayVaccineName(row.vaccineName),
          opening: 0, received: 0, used: 0, wasted: 0,
          adjustmentIncrease: 0, adjustmentDecrease: 0, usedDoses: 0,
        }
      }
      const v = acc[row.vaccineId]
      v.opening            += row.opening ?? 0
      v.received           += row.received
      v.used               += row.used
      v.wasted             += row.wasted
      v.adjustmentIncrease += row.adjustmentIncrease
      v.adjustmentDecrease += row.adjustmentDecrease
      v.usedDoses          += row.usedDoses
    }
    return Object.values(acc).sort((a, b) => a.vaccineName.localeCompare(b.vaccineName))
  }, [movement])

  const totals = useMemo(() => ({
    received:  vaccineMovement.reduce((s, v) => s + v.opening + v.received, 0),
    usedDoses: vaccineMovement.reduce((s, v) => s + v.usedDoses, 0),
    wasted:    vaccineMovement.reduce((s, v) => s + v.wasted,    0),
  }), [vaccineMovement])

  const requestsByMonth = useMemo(() => {
    const acc = {}
    for (const row of requests) {
      if (!acc[row.month]) acc[row.month] = {
        month: row.month, completed: 0, partially_fulfilled: 0,
        submitted: 0, cancelled: 0, declined: 0,
      }
      acc[row.month][row.status] = (acc[row.month][row.status] ?? 0) + row.count
    }
    return Object.values(acc).sort((a, b) => b.month.localeCompare(a.month))
  }, [requests])

  const movementColumns = [
    { key: 'vaccineName', label: 'Vaccine',
      render: (r) => <span className="text-sm font-semibold text-text">{r.vaccineName}</span> },
    { key: 'opening', label: 'Opening (vials)',
      render: (r) => <span className={`text-sm ${r.opening > 0 ? 'text-sky-700 font-semibold' : 'text-text-muted'}`}>{r.opening || '—'}</span> },
    { key: 'received', label: 'Received (vials)',
      render: (r) => <span className="text-sm text-text">{r.received}</span> },
    { key: 'usedDoses', label: 'Used (doses)',
      render: (r) => <span className="text-sm text-text">{r.usedDoses}</span> },
    { key: 'wasted', label: 'Wasted (vials)',
      render: (r) => (
        <span className={`text-sm font-semibold ${r.wasted > 0 ? 'text-amber-600' : 'text-text-muted'}`}>
          {r.wasted}
        </span>
      ) },
    { key: 'adj', label: 'Adj. (net vials)',
      render: (r) => {
        const net = r.adjustmentIncrease - r.adjustmentDecrease
        return (
          <span className={`text-sm font-semibold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-danger' : 'text-text-muted'}`}>
            {net > 0 ? `+${net}` : net === 0 ? '—' : net}
          </span>
        )
      } },
  ]

  const remainingColumns = [
    { key: 'facilityName', label: 'Facility',
      render: (r) => <span className="text-sm font-semibold text-text">{r.facilityName}</span> },
    { key: 'vaccineName', label: 'Vaccine',
      render: (r) => <span className="text-sm text-text">{displayVaccineName(r.vaccineName)}</span> },
    { key: 'storeVials', label: 'Store (vials)',
      render: (r) => <span className="text-sm text-text">{r.storeVials}</span> },
    { key: 'heldVials', label: 'Held (vials)',
      render: (r) => <span className="text-sm text-text">{r.heldVials}</span> },
    { key: 'totalDoses', label: 'Total (doses)',
      render: (r) => <span className="text-sm font-bold text-text">{r.totalDoses}</span> },
  ]

  const requestColumns = [
    { key: 'month', label: 'Month',
      render: (r) => <span className="text-sm font-semibold text-text">{r.month}</span> },
    { key: 'completed', label: 'Completed',
      render: (r) => <span className="text-sm font-semibold text-emerald-600">{r.completed || 0}</span> },
    { key: 'partially_fulfilled', label: 'Partial',
      render: (r) => <span className="text-sm font-semibold text-amber-600">{r.partially_fulfilled || 0}</span> },
    { key: 'submitted', label: 'Open',
      render: (r) => <span className="text-sm font-semibold text-blue-600">{r.submitted || 0}</span> },
    { key: 'cancelled', label: 'Cancelled',
      render: (r) => <span className="text-sm text-text-muted">{r.cancelled || 0}</span> },
    { key: 'declined', label: 'Declined',
      render: (r) => <span className="text-sm font-semibold text-danger">{r.declined || 0}</span> },
  ]

  const approvalsColumns = [
    { key: 'facilityName', label: 'Facility',
      render: (r) => <span className="text-sm font-semibold text-text">{r.facilityName}</span> },
    { key: 'type', label: 'Type',
      render: (r) => (
        <span className="text-sm text-text">
          {r.type === 'stock_correction' ? 'Stock Correction' : 'Threshold Change'}
        </span>
      ) },
    { key: 'count', label: 'Pending',
      render: (r) => <span className="text-sm font-bold text-amber-600">{r.count}</span> },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="bg-primary rounded-2xl px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-white/70 mt-0.5">Stock movement and status overview</p>
        </div>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Date Range</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DatePicker id="analytics-from" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
          <DatePicker id="analytics-to"   label="To"   value={to}   onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {/* Summary stat cards — movement tab only */}
      {activeTab === 'movement' && !isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Received" value={totals.received}  unit="vials" icon={Package} />
          <StatCard label="Used"     value={totals.usedDoses} unit="doses" icon={TrendingDown} />
          <StatCard label="Wasted"   value={totals.wasted}    unit="vials" icon={AlertTriangle} colorClass="text-amber-500" />
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto -mx-1 px-1 pb-0.5">
        <div className="flex gap-1 p-1 bg-slate-200/50 border border-slate-200/80 rounded-xl w-fit min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-primary shadow-sm border border-slate-200'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load analytics data. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {activeTab === 'movement' && (
            <Table
              columns={movementColumns}
              rows={vaccineMovement}
              emptyMessage="No movement recorded in this date range."
            />
          )}
          {activeTab === 'remaining' && (
            <Table
              columns={remainingColumns}
              rows={remaining}
              emptyMessage="No stock data available."
            />
          )}
          {activeTab === 'requests' && (
            <Table
              columns={requestColumns}
              rows={requestsByMonth}
              emptyMessage="No stock requests in this date range."
            />
          )}
          {activeTab === 'approvals' && (
            <Table
              columns={approvalsColumns}
              rows={pendingApprovals}
              emptyMessage="No pending approvals."
            />
          )}
        </>
      )}
    </div>
  )
}
