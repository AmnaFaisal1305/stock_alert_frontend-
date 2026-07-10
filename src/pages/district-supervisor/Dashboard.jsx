import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Building2, AlertCircle } from 'lucide-react'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/shared/StatCard'
import FacilityCard from '../../components/shared/FacilityCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { worstStatus } from '../../lib/status'

export default function DistrictDashboard() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const { districtName, facilities, counts } = useMemo(() => {
    const myRows = (data?.facilities ?? []).filter((r) => r.districtId === user.districtId)
    const districtName = myRows[0]?.districtName ?? 'Your District'
    const facilities = (data?.summary?.byFacility ?? []).map((f) => ({
      id: f.facilityId, name: f.facilityName,
      status: worstStatus(f.statusCounts), statusCounts: f.statusCounts,
    }))
    const counts = {
      total:    facilities.length,
      adequate: facilities.filter((f) => f.status === 'adequate').length,
      low:      facilities.filter((f) => f.status === 'low' || f.status === 'no_data').length,
      critical: facilities.filter((f) => f.status === 'critical').length,
    }
    return { districtName, facilities, counts }
  }, [data, user.districtId])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-50 border border-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
        Failed to load district dashboard. Please try refreshing.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">District Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Monitoring {districtName} AKUH Network Facilities
        </p>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Facilities"
          value={counts.total}
          icon={Building2}
          colorClass="text-primary"
          subtitle="Managed facilities"
        />
        <StatCard
          label="Adequate Level"
          value={counts.adequate}
          icon={CheckCircle2}
          colorClass="text-success-dark"
          subtitle={counts.adequate === counts.total ? 'All systems healthy' : `${counts.adequate} running stable`}
        />
        <StatCard
          label="Low Stock Warning"
          value={counts.low}
          icon={AlertTriangle}
          colorClass={counts.low > 0 ? 'text-warning-dark' : 'text-text-muted'}
          subtitle={counts.low > 0 ? 'Action suggested' : 'Levels healthy'}
        />
        <StatCard
          label="Critical Low"
          value={counts.critical}
          icon={AlertCircle}
          colorClass={counts.critical > 0 ? 'text-danger' : 'text-text-muted'}
          subtitle={counts.critical > 0 ? 'Requires immediate action' : 'All clear'}
        />
      </div>

      {/* Facilities Cards Section */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Facilities &amp; Vaccine Health</h2>
          <span className="text-[10px] font-bold text-text-muted bg-white border border-surface-border px-2.5 py-1 rounded-lg">
            {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'} listed
          </span>
        </div>

        {facilities.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
            <Building2 size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold text-text">No facilities listed</p>
            <p className="text-xs mt-1">Please register facilities in Facility Management to configure monitoring thresholds.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilities.map((f) => (
              <FacilityCard key={f.id} facility={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
