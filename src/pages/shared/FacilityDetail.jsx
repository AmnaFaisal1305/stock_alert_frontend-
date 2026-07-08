import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Syringe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getFacility } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/shared/StatusBadge'
import StatCard from '../../components/shared/StatCard'
import Badge from '../../components/ui/Badge'
import SkeletonCard from '../../components/shared/SkeletonCard'

export default function FacilityDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => getFacility(id),
  })

  const facility = data?.facility
  const backTo = user?.role === 'super_admin' ? '/super-admin/districts' : '/district/facilities'

  return (
    <div className="flex flex-col gap-6">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary w-fit">
        <ArrowLeft size={14} /> Back
      </Link>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      )}
      {isError && <p className="text-danger">Failed to load facility.</p>}

      {!isLoading && !isError && facility && (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-text">{facility.name}</h1>
                <Badge type={facility.isActive ? 'active' : 'inactive'} />
              </div>
              <p className="text-sm text-text-muted mt-0.5">
                {facility.districtName} District · {facility.facilitySupervisorName ?? 'Unstaffed'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Critical" value={facility.statusCounts?.critical ?? 0} icon={Syringe} colorClass="text-danger" />
            <StatCard label="Low"      value={facility.statusCounts?.low ?? 0}      icon={Syringe} colorClass="text-warning" />
            <StatCard label="OK"       value={facility.statusCounts?.adequate ?? 0} icon={Syringe} colorClass="text-success" />
            <StatCard label="No Data"  value={facility.statusCounts?.no_data ?? 0}  icon={Syringe} colorClass="text-text-muted" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Vaccines</h2>
            {(facility.vaccines ?? []).length === 0 ? (
              <p className="text-text-muted text-sm">No vaccines configured for this facility yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {facility.vaccines.map((v) => (
                  <div key={v.vaccineId} className="bg-surface rounded-xl border border-surface-border p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-text truncate">{v.vaccineName}</p>
                      <StatusBadge status={v.status} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-text">{v.quantity ?? '—'}</span>
                      <span className="text-xs text-text-muted">/ {v.minQuantity || '∞'} doses</span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {v.recordedAt ? `Last recorded ${new Date(v.recordedAt).toLocaleDateString()}` : 'Never recorded'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
