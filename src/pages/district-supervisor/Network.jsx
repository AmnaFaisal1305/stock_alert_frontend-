import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { getFacilities, getDashboard } from '../../lib/api'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { groupByTownUc, FacilityHierarchy } from '../super-admin/DistrictDetail'
import { plural } from '../../lib/format'

export default function DistrictNetwork() {
  const facilitiesQ = useQuery({ queryKey: ['facilities'], queryFn: getFacilities })
  const dashQ = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, staleTime: 15_000 })

  // Merge statusCounts from dashboard summary into facility objects so FacilityHierarchy
  // can render stock status badges without needing the super-admin-only getDistrict endpoint.
  const enriched = useMemo(() => {
    const scMap = new Map(
      (dashQ.data?.summary?.byFacility ?? []).map((f) => [f.facilityId, f.statusCounts])
    )
    return (facilitiesQ.data?.facilities ?? []).map((f) => ({ ...f, statusCounts: scMap.get(f.id) ?? {} }))
  }, [facilitiesQ.data, dashQ.data])

  const towns = useMemo(() => groupByTownUc(enriched), [enriched])
  const totalUCs = towns.reduce((sum, t) => sum + t.ucs.length, 0)

  const isLoading = facilitiesQ.isLoading
  const isError = facilitiesQ.isError

  return (
    <div>
      <PageHeader
        breadcrumb="District Supervisor › Overview"
        title="Network"
        subtitle={!isLoading && enriched.length
          ? `${plural(towns.length, 'town')} · ${plural(totalUCs, 'UC')} · ${plural(enriched.length, 'facility', 'facilities')}`
          : undefined}
      />
      {isError ? (
        <ErrorState title="Couldn't load district network" error={facilitiesQ.error} onRetry={facilitiesQ.refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : towns.length === 0 ? (
        <EmptyState framed icon={Building2} title="No facilities in your district" message="Facilities will appear here once they are added." />
      ) : (
        <FacilityHierarchy towns={towns} base="/district" />
      )}
    </div>
  )
}
