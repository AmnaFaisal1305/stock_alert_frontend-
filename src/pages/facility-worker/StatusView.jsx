import { useQuery } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, Syringe } from 'lucide-react'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { statusConfig } from '../../lib/status'

function SummaryPill({ icon: Icon, label, count, colorClass }) {
  return (
    <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border shadow-sm transition-all hover:scale-105 duration-200 ${colorClass}`}>
      <Icon size={13} strokeWidth={2.2} />
      <span>{count} {label}</span>
    </div>
  )
}

function StockCard({ row }) {
  const hasData     = row.quantity !== null
  const outOfStock  = row.quantity === 0
  const pct         = row.minQuantity > 0
    ? Math.min(Math.round(((row.quantity ?? 0) / row.minQuantity) * 100), 100)
    : (hasData ? 100 : 0)
  const cfg         = statusConfig(row.status)
  const borderColor = cfg.borderL
  const barColor    = cfg.dot
  const ringClass   = cfg.ring

  return (
    <div className={`bg-white rounded-2xl border border-surface-border border-l-4 ${borderColor} ${ringClass} p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-red-50 text-primary">
            <Syringe size={14} />
          </div>
          <p className="font-bold text-sm text-text truncate">{row.vaccineName}</p>
        </div>
        <StatusBadge status={row.status} />
      </div>

      <div className="space-y-1">
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
          {hasData ? (
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
          ) : (
            <div className="h-full rounded-full border border-dashed border-slate-300 bg-slate-50" />
          )}
        </div>
      </div>

      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-50 mt-1 font-medium">
        {!hasData ? (
          <span className="italic text-text-muted">Not recorded yet</span>
        ) : outOfStock ? (
          <span className="font-extrabold text-danger flex items-center gap-1">
            <AlertCircle size={12} /> Out of Stock
          </span>
        ) : (
          <span className="text-text font-bold text-sm">{row.quantity} <span className="text-xs font-semibold text-text-muted">doses</span></span>
        )}
        <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">Min Threshold: {row.minQuantity}</span>
      </div>
    </div>
  )
}

export default function WorkerStatusView() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 20_000,
  })

  const rows          = (data?.facilities ?? []).filter((r) => r.facilityId === user?.facilityId)
  const facilityName  = rows[0]?.facilityName
  const districtName  = rows[0]?.districtName
  const okCount       = rows.filter((r) => r.status === 'adequate').length
  const lowCount      = rows.filter((r) => r.status === 'low').length
  const criticalCount = rows.filter((r) => r.status === 'critical').length
  const noDataCount   = rows.filter((r) => r.status === 'no_data').length

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pt-6 px-1">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">Stock Catalog Status</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {facilityName
            ? `${facilityName}${districtName ? `, ${districtName} District` : ''}`
            : 'Current stock at your facility'}
        </p>
      </div>

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load status. Please check your connection.
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <SummaryPill icon={CheckCircle2} label="OK" count={okCount}
            colorClass="bg-success-bg border-success/20 text-success-dark" />
          <SummaryPill icon={AlertTriangle} label="Low" count={lowCount}
            colorClass="bg-warning-bg border-warning/20 text-warning-dark" />
          <SummaryPill icon={AlertCircle} label="Critical" count={criticalCount}
            colorClass="bg-danger-bg border-danger/20 text-danger" />
          <SummaryPill icon={HelpCircle} label="No data" count={noDataCount}
            colorClass="bg-slate-50 border-slate-200 text-text-muted" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {isLoading
          ? [1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} lines={2} />)
          : rows.map((row) => (
              <StockCard key={`${row.facilityId}-${row.vaccineId}`} row={row} />
            ))
        }
      </div>

      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm px-6 max-w-md mx-auto">
          <Syringe size={40} className="mx-auto mb-3 text-text-muted/40 animate-pulse" />
          <p className="font-bold text-text">No Vaccines Configured</p>
          <p className="text-xs text-text-muted/80 mt-1 max-w-[280px] mx-auto leading-relaxed">Please ask your facility supervisor to configure your vaccine catalog and alerts.</p>
        </div>
      )}
    </div>
  )
}
