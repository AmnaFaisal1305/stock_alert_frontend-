import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Search, ArrowRight, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getFacilities, getDashboard } from '../../lib/api'
import { facilityStatus } from '../../lib/status'
import StatusBadge from '../../components/shared/StatusBadge'
import Badge from '../../components/ui/Badge'

export default function UCSupervisorFacilities() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['facilities'],
    queryFn: getFacilities,
  })
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 15_000,
  })

  const facilities = data?.facilities ?? []
  const statusByFacilityId = new Map(
    (dashboardData?.summary?.byFacility ?? []).map((f) => [f.facilityId, facilityStatus(f.statusCounts)])
  )

  const filtered = facilities.filter((f) =>
    f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.ucName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.townName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  function timeAgo(isoStr) {
    if (!isoStr) return null
    const diff = Date.now() - new Date(isoStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Facilities</h1>
          <p className="text-sm text-white/70 mt-0.5">
            {isLoading ? 'Loading…' : `${facilities.length} facilit${facilities.length !== 1 ? 'ies' : 'y'} in your union councils`}
          </p>
        </div>
      </div>

      {!isLoading && !isError && facilities.length > 0 && (
        <div className="relative w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, UC or town…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load facilities. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="bg-white rounded-2xl border border-surface-border overflow-hidden shadow-sm">
          <div className="grid grid-cols-[2fr_1.5fr_1fr_80px_100px] px-5 py-3 bg-slate-50 border-b border-surface-border gap-4 items-center">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Facility</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">UC / Town</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Last Activity</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Status</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Stock</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-text-muted">
              {searchQuery ? `No facilities match "${searchQuery}".` : 'No facilities found.'}
            </div>
          ) : (
            filtered.map((f) => {
              const stockStatus = statusByFacilityId.get(f.id)
              const lastAct = timeAgo(f.lastActivityAt)
              return (
                <div
                  key={f.id}
                  className="grid grid-cols-[2fr_1.5fr_1fr_80px_100px] px-5 py-4 gap-4 items-center border-b border-surface-border last:border-b-0 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={14} className="text-text-muted/60 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-text text-sm truncate">{f.name}</p>
                      {f.facilitySupervisorName && (
                        <p className="text-[10px] text-text-muted font-medium truncate">{f.facilitySupervisorName}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text truncate">{f.ucName ?? '—'}</p>
                    {f.townName && <p className="text-[10px] text-text-muted font-medium truncate">{f.townName}</p>}
                  </div>
                  <span className="text-xs text-text-muted font-medium">
                    {lastAct ?? <span className="italic">Never</span>}
                  </span>
                  <Badge type={f.isActive ? 'active' : 'inactive'} />
                  <div className="flex justify-end">
                    {stockStatus ? (
                      <StatusBadge status={stockStatus} />
                    ) : (
                      <Link
                        to={`/uc/facilities/${f.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        View <ArrowRight size={11} />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
