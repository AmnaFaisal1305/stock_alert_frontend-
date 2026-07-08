import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2 } from 'lucide-react'
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
    <div className="flex flex-col gap-6">
      <Link to="/super-admin/districts" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary w-fit">
        <ArrowLeft size={14} /> Back to districts
      </Link>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      )}
      {isError && <p className="text-danger">Failed to load district.</p>}

      {!isLoading && !isError && district && (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-text">{district.name}</h1>
                <Badge type={district.isActive ? 'active' : 'inactive'} />
              </div>
              <p className="text-sm text-text-muted mt-0.5">
                {district.facilityCount} facilit{district.facilityCount === 1 ? 'y' : 'ies'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Critical" value={district.statusCounts?.critical ?? 0} icon={Building2} colorClass="text-danger" />
            <StatCard label="Low"      value={district.statusCounts?.low ?? 0}      icon={Building2} colorClass="text-warning" />
            <StatCard label="OK"       value={district.statusCounts?.adequate ?? 0} icon={Building2} colorClass="text-success" />
            <StatCard label="No Data"  value={district.statusCounts?.no_data ?? 0} icon={Building2} colorClass="text-text-muted" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Facilities</h2>
            {(district.facilities ?? []).length === 0 ? (
              <p className="text-text-muted text-sm">No facilities in this district yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {district.facilities.map((f) => (
                  <Link
                    key={f.id}
                    to={`/super-admin/facilities/${f.id}`}
                    className="bg-white rounded-2xl border border-surface-border p-5 flex flex-col gap-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <div className="p-2 rounded-lg bg-red-50 text-primary mt-0.5">
                          <Building2 size={16} />
                        </div>
                        <p className="font-bold text-text truncate text-sm leading-tight">{f.name}</p>
                      </div>
                      <StatusBadge status={worstStatus(f.statusCounts)} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-muted border-t border-slate-50 pt-2.5 mt-1 font-medium">
                      <span>{f.facilitySupervisorName ?? 'Unstaffed'}</span>
                      <Badge type={f.isActive ? 'active' : 'inactive'} />
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
