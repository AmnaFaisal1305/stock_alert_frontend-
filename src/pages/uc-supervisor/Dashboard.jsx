import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Building2, AlertCircle, ArrowRight } from 'lucide-react'
import { getDashboard } from '../../lib/api'
import StatCard from '../../components/shared/StatCard'
import FacilityCard from '../../components/shared/FacilityCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { facilityStatus } from '../../lib/status'

export default function UCSupervisorDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const { facilities, counts } = useMemo(() => {
    const facilities = (data?.summary?.byFacility ?? []).map((f) => ({
      id: f.facilityId, name: f.facilityName,
      status: facilityStatus(f.statusCounts), statusCounts: f.statusCounts,
    }))
    const counts = {
      critical: facilities.filter((f) => f.status === 'critical').length,
      low:      facilities.filter((f) => f.status === 'low').length,
      adequate: facilities.filter((f) => f.status === 'adequate').length,
      noData:   facilities.filter((f) => f.status === 'no_data').length,
    }
    return { facilities, counts }
  }, [data])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-20 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-50 border border-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
        Failed to load dashboard. Please try refreshing.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">UC Dashboard</h1>
          <p className="text-sm text-white/70 mt-0.5">
            {facilities.length} facilit{facilities.length !== 1 ? 'ies' : 'y'} across your union councils
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest hidden sm:block">Live · Auto-refreshing</span>
        </div>
      </div>

      {counts.critical > 0 && (
        <div className="bg-danger-bg border border-danger/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <span className="absolute inline-flex h-5 w-5 rounded-full bg-danger/30 animate-ping" />
            <AlertCircle size={22} className="relative text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-danger">
              {counts.critical} facilit{counts.critical > 1 ? 'ies' : 'y'} critically low — immediate action required
            </p>
          </div>
          <Link to="/uc/facilities" className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline flex-shrink-0">
            View <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {counts.low > 0 && counts.critical === 0 && (
        <div className="bg-warning-bg border border-warning/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <AlertTriangle size={20} className="text-warning flex-shrink-0" />
          <p className="text-sm font-bold text-warning-dark flex-1">
            {counts.low} facilit{counts.low > 1 ? 'ies' : 'y'} running low on stock
          </p>
          <Link to="/uc/facilities" className="flex items-center gap-1 text-xs font-semibold text-warning-dark hover:underline flex-shrink-0">
            View <ArrowRight size={12} />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={AlertCircle} label="Critical" value={counts.critical}
          colorClass={counts.critical > 0 ? 'text-danger' : 'text-text-muted'}
          subtitle={counts.critical > 0 ? 'Immediate action' : 'All clear'} />
        <StatCard icon={AlertTriangle} label="Low Stock" value={counts.low}
          colorClass={counts.low > 0 ? 'text-warning-dark' : 'text-text-muted'}
          subtitle={counts.low > 0 ? 'Plan restocking' : 'Levels healthy'} />
        <StatCard icon={CheckCircle2} label="Normal" value={counts.adequate}
          colorClass="text-success-dark" subtitle={`${counts.adequate} running stable`} />
        <StatCard icon={Building2} label="No Data" value={counts.noData}
          colorClass="text-text-muted"
          subtitle={counts.noData > 0 ? 'Not updated yet' : 'All reporting'} />
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Facilities</h2>
          <Link to="/uc/facilities" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight size={11} />
          </Link>
        </div>

        {facilities.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
            <Building2 size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold text-text">No facilities in your union councils</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilities.slice(0, 9).map((f) => (
              <FacilityCard key={f.id} facility={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
