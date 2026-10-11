import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, AlertCircle, AlertTriangle, CheckCircle2, User } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getUnionCouncils, getFacilities, getDashboard } from '../../lib/api'
import StatusBadge from '../../components/shared/StatusBadge'
import StatCard from '../../components/shared/StatCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { facilityStatus } from '../../lib/status'

export default function UCDetail() {
  const { id } = useParams()

  const { data: ucsData, isLoading: ucLoading } = useQuery({
    queryKey: ['ucs'],
    queryFn: () => getUnionCouncils(),
    staleTime: 30_000,
  })

  const { data: facilityData, isLoading: facLoading } = useQuery({
    queryKey: ['facilities', { ucId: id }],
    queryFn: () => getFacilities({ ucId: id }),
    staleTime: 30_000,
  })

  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 30_000,
  })

  const uc = useMemo(
    () => (ucsData?.unionCouncils ?? []).find((u) => u.id === id),
    [ucsData, id]
  )

  const facilities = facilityData?.facilities ?? []

  const statusByFacilityId = useMemo(
    () => new Map(
      (dashData?.summary?.byFacility ?? []).map((f) => [f.facilityId, facilityStatus(f.statusCounts)])
    ),
    [dashData]
  )

  const statusCounts = useMemo(() => {
    const counts = { critical: 0, low: 0, adequate: 0, no_data: 0 }
    for (const f of facilities) {
      const s = statusByFacilityId.get(f.id) ?? 'no_data'
      counts[s] = (counts[s] ?? 0) + 1
    }
    return counts
  }, [facilities, statusByFacilityId])

  const isLoading = ucLoading || facLoading

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <Link
        to="/super-admin/ucs"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary w-fit font-semibold transition-colors"
      >
        <ArrowLeft size={14} /> Back to UC Management
      </Link>

      {isLoading && (
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-50 border border-slate-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
          </div>
        </div>
      )}

      {!isLoading && !uc && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          UC not found. It may have been removed.
        </div>
      )}

      {!isLoading && uc && (
        <>
          {/* Banner */}
          <div className="bg-primary rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-white tracking-tight">{uc.name}</h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    uc.isActive
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/10 text-white/60 border border-white/20'
                  }`}>
                    {uc.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-white/70 mt-0.5">
                  {uc.townName} · {uc.districtName} · {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'}
                </p>
              </div>
              {uc.ucSupervisorName && (
                <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                  <User size={13} className="text-white/70 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">UC Supervisor</p>
                    <p className="text-sm font-bold text-white">{uc.ucSupervisorName}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Critical" value={statusCounts.critical} icon={AlertCircle} colorClass="text-danger" subtitle="Urgent action required" />
            <StatCard label="Low" value={statusCounts.low} icon={AlertTriangle} colorClass="text-warning-dark" subtitle="Attention suggested" />
            <StatCard label="Normal" value={statusCounts.adequate} icon={CheckCircle2} colorClass="text-success-dark" subtitle="All lines healthy" />
            <StatCard label="No Data" value={statusCounts.no_data} icon={Building2} colorClass="text-text-muted" subtitle="Not yet reporting" />
          </div>

          {/* Facility cards */}
          {facilities.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
              <Building2 size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-bold text-text">No facilities found</p>
              <p className="text-xs mt-1">Add facilities under this UC to start logging stocks.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...facilities]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((f) => {
                  const fStatus = statusByFacilityId.get(f.id) ?? 'no_data'
                  const sc = f.statusCounts ?? {}
                  const hasAny = sc.critical > 0 || sc.low > 0 || sc.adequate > 0

                  return (
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
                              <p className="font-bold text-text text-sm leading-tight truncate" title={f.name}>{f.name}</p>
                              <p className="text-[10px] text-text-muted mt-1 font-semibold">
                                {f.facilitySupervisorName ?? 'Unstaffed'}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <StatusBadge status={fStatus} />
                          </div>
                        </div>

                        {hasAny && (
                          <div className="flex gap-1.5 pt-3 border-t border-slate-100 flex-wrap">
                            {sc.critical > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-danger-bg text-danger border border-danger/10">
                                {sc.critical} Critical
                              </span>
                            )}
                            {sc.low > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-warning-bg text-warning-dark border border-warning/10">
                                {sc.low} Low
                              </span>
                            )}
                            {sc.adequate > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-success-bg text-success-dark border border-success/10">
                                {sc.adequate} Healthy
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
