import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { getDistrict } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { groupByTownUc, FacilityHierarchy } from '../super-admin/DistrictDetail'
import { plural } from '../../lib/format'

export default function DistrictNetwork() {
  const { user } = useAuth()
  const districtId = user?.districtId

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['district', districtId],
    queryFn: () => getDistrict(districtId),
    enabled: !!districtId,
  })

  const district = data?.district
  const towns = useMemo(() => groupByTownUc(district?.facilities), [district])
  const totalUCs = towns.reduce((sum, t) => sum + t.ucs.length, 0)

  return (
    <div>
      <PageHeader
        breadcrumb="District Supervisor › Overview"
        title="Network"
        subtitle={district
          ? `${plural(towns.length, 'town')} · ${plural(totalUCs, 'UC')} · ${plural(district.facilityCount ?? 0, 'facility', 'facilities')}`
          : undefined}
      />
      {isError ? (
        <ErrorState title="Couldn't load district network" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : !district || towns.length === 0 ? (
        <EmptyState framed icon={Building2} title="No facilities in your district" message="Facilities will appear here once they are added." />
      ) : (
        <FacilityHierarchy towns={towns} base="/district" />
      )}
    </div>
  )
}
