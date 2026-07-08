import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDistrict } from '../../lib/api'
import StatusBadge from '../../components/shared/StatusBadge'
import StatCard from '../../components/shared/StatCard'
import Badge from '../../components/ui/Badge'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { worstStatus } from '../../lib/status'

export default function DistrictDetail() {
  const { id } = useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['district', id],
    queryFn: () => getDistrict(id),
  })

  const district = data?.district

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <Link to="/super-admin/districts" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary w-fit font-semibold transition-colors">
        <ArrowLeft size={14} /> Back to districts
      </Link>

      {isLoading && (
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-50 border border-slate-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load district details. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && district && (
        <>
          {/* Header Info */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-text tracking-tight">{district.name}</h1>
                <Badge type={district.isActive ? 'active' : 'inactive'} />
              </div>
              <p className="text-sm text-text-muted mt-0.5">
                {district.facilityCount} {district.facilityCount === 1 ? 'facility' : 'facilities'} registered
              </p>
            </div>
          </div>

          {/* Stats Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Critical"
              value={district.statusCounts?.critical ?? 0}
              icon={AlertCircle}
              colorClass="text-danger"
              subtitle="Urgent action required"
            />
            <StatCard
              label="Low"
              value={district.statusCounts?.low ?? 0}
              icon={AlertTriangle}
              colorClass="text-warning-dark"
              subtitle="Attention suggested"
            />
            <StatCard
              label="OK"
              value={district.statusCounts?.adequate ?? 0}
              icon={CheckCircle2}
              colorClass="text-success-dark"
              subtitle="All lines healthy"
            />
            <StatCard
              label="No Data"
              value={district.statusCounts?.no_data ?? 0}
              icon={Building2}
              colorClass="text-text-muted"
              subtitle="Not yet reporting"
            />
          </div>

          {/* Facilities Cards List */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Facilities Vaccine Health</h2>
              <span className="text-[10px] font-bold text-text-muted bg-white border border-surface-border px-2.5 py-1 rounded-lg">
                {(district.facilities ?? []).length} facilities listed
              </span>
            </div>

            {(district.facilities ?? []).length === 0 ? (
              <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
                <Building2 size={36} className="mx-auto mb-3 opacity-20" />
                <p className="font-bold text-text">No facilities found</p>
                <p className="text-xs mt-1">Please add facilities under this district to start logging stocks.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {district.facilities.map((f) => (
                  <Link
                    key={f.id}
                    to={`/super-admin/facilities/${f.id}`}
                    className="bg-white rounded-2xl border border-surface-border p-5 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-red-50 text-primary mt-0.5 flex-shrink-0">
                            <Building2 size={16} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-text text-sm leading-tight truncate" title={f.name}>{f.name}</h3>
                            <p className="text-[10px] text-text-muted mt-1 font-semibold">{f.facilitySupervisorName ?? 'Unstaffed'}</p>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <StatusBadge status={worstStatus(f.statusCounts)} />
                        </div>
                      </div>

                      {f.statusCounts && (f.statusCounts.critical > 0 || f.statusCounts.low > 0 || f.statusCounts.adequate > 0) && (
                        <div className="flex gap-1.5 pt-3.5 border-t border-slate-100 flex-wrap">
                          {f.statusCounts.critical > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-danger-bg text-danger border border-danger/10">
                              {f.statusCounts.critical} Critical
                            </span>
                          )}
                          {f.statusCounts.low > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-warning-bg text-warning-dark border border-warning/10">
                              {f.statusCounts.low} Low
                            </span>
                          )}
                          {f.statusCounts.adequate > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-success-bg text-success-dark border border-success/10">
                              {f.statusCounts.adequate} Healthy
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
