import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, AlertCircle, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDistrict, getFacilities } from '../../lib/api'
import StatusBadge from '../../components/shared/StatusBadge'
import StatCard from '../../components/shared/StatCard'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { facilityStatus } from '../../lib/status'

export default function DistrictDetail() {
  const { id } = useParams()

  const { data: districtData, isLoading: loadingDistrict, isError } = useQuery({
    queryKey: ['district', id],
    queryFn: () => getDistrict(id),
  })
  const { data: facilitiesData, isLoading: loadingFacilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: getFacilities,
  })

  const district = districtData?.district
  const isLoading = loadingDistrict || loadingFacilities

  // Merge statusCounts (from district endpoint) with hierarchy data (from facilities endpoint)
  // then group: Town → UC → Facilities
  const towns = useMemo(() => {
    const allFacilities = (facilitiesData?.facilities ?? []).filter((f) => f.districtId === id)
    const statusById = new Map((district?.facilities ?? []).map((f) => [f.id, f.statusCounts]))

    const townMap = new Map()
    for (const f of allFacilities) {
      const townKey = f.townId ?? '__none__'
      if (!townMap.has(townKey)) {
        townMap.set(townKey, { id: townKey, name: f.townName ?? '—', ucs: new Map() })
      }
      const town = townMap.get(townKey)
      const ucKey = f.ucId ?? '__none__'
      if (!town.ucs.has(ucKey)) {
        town.ucs.set(ucKey, { id: ucKey, name: f.ucName ?? '—', facilities: [] })
      }
      town.ucs.get(ucKey).facilities.push({ ...f, statusCounts: statusById.get(f.id) })
    }

    return Array.from(townMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((town) => ({
        ...town,
        ucs: Array.from(town.ucs.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((uc) => ({
            ...uc,
            facilities: [...uc.facilities].sort((a, b) => a.name.localeCompare(b.name)),
          })),
      }))
  }, [facilitiesData, district, id])

  const totalUCs = towns.reduce((sum, t) => sum + t.ucs.length, 0)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <Link
        to="/super-admin/districts"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary w-fit font-semibold transition-colors"
      >
        <ArrowLeft size={14} /> Back to districts
      </Link>

      {isLoading && (
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-50 border border-slate-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          {/* Banner */}
          <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-white tracking-tight">{district.name}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  district.isActive
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/10 text-white/60 border border-white/20'
                }`}>
                  {district.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-white/70 mt-0.5">
                {towns.length} {towns.length === 1 ? 'town' : 'towns'} · {totalUCs} {totalUCs === 1 ? 'UC' : 'UCs'} · {district.facilityCount} {district.facilityCount === 1 ? 'facility' : 'facilities'}
              </p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Critical" value={district.statusCounts?.critical ?? 0} icon={AlertCircle} colorClass="text-danger" subtitle="Urgent action required" />
            <StatCard label="Low" value={district.statusCounts?.low ?? 0} icon={AlertTriangle} colorClass="text-warning-dark" subtitle="Attention suggested" />
            <StatCard label="Normal" value={district.statusCounts?.adequate ?? 0} icon={CheckCircle2} colorClass="text-success-dark" subtitle="All lines healthy" />
            <StatCard label="No Data" value={district.statusCounts?.no_data ?? 0} icon={Building2} colorClass="text-text-muted" subtitle="Not yet reporting" />
          </div>

          {/* Town → UC → Facility hierarchy */}
          {towns.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-surface-border bg-white rounded-2xl text-text-muted shadow-sm">
              <Building2 size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-bold text-text">No facilities found</p>
              <p className="text-xs mt-1">Add facilities under this district to start logging stocks.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {towns.map((town) => (
                <div key={town.id}>
                  {/* Town heading */}
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      <MapPin size={13} />
                    </div>
                    <h2 className="text-sm font-bold text-text">{town.name}</h2>
                    <div className="flex-1 h-px bg-surface-border" />
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {town.ucs.length} {town.ucs.length === 1 ? 'UC' : 'UCs'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-6 pl-5 border-l-2 border-surface-border">
                    {town.ucs.map((uc) => (
                      <div key={uc.id}>
                        {/* UC heading */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-primary/30 flex-shrink-0" />
                          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">{uc.name}</h3>
                          <span className="text-[10px] text-text-muted bg-white border border-surface-border px-2 py-0.5 rounded font-semibold">
                            {uc.facilities.length} {uc.facilities.length === 1 ? 'facility' : 'facilities'}
                          </span>
                        </div>

                        {/* Facility cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                          {uc.facilities.map((f) => (
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
                                    <StatusBadge status={facilityStatus(f.statusCounts)} />
                                  </div>
                                </div>

                                {f.statusCounts && (f.statusCounts.critical > 0 || f.statusCounts.low > 0 || f.statusCounts.adequate > 0) && (
                                  <div className="flex gap-1.5 pt-3 border-t border-slate-100 flex-wrap">
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
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
