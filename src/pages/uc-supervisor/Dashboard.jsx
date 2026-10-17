import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { buttonClasses } from '../../components/ui/Button'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { FacilityBoard } from '../../components/facilities/FacilityOverview'
import { useFacilityList } from '../../components/facilities/FacilityDirectory'
import { plural } from '../../lib/format'

export default function UCSupervisorDashboard() {
  const { user } = useAuth()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  const facilitiesQ = useFacilityList()
  const facilities = facilitiesQ.data?.facilities ?? []

  return (
    <div>
      <PageHeader
        size="display"
        breadcrumb="UC Supervisor › Dashboard"
        title={user.ucNames?.length ? user.ucNames.join(' · ') : 'My union councils'}
        subtitle={facilities.length ? `${plural(facilities.length, 'facility', 'facilities')} in your union councils` : undefined}
        actions={<Link to="/uc/stock-requests" className={buttonClasses()}>Stock requests</Link>}
      />

      {isError || facilitiesQ.isError ? (
        <ErrorState title="Couldn’t load the dashboard" error={error ?? facilitiesQ.error} onRetry={() => { refetch(); facilitiesQ.refetch() }} />
      ) : isLoading || facilitiesQ.isLoading ? (
        <Card padding={false}><SkeletonRows rows={6} /></Card>
      ) : (
        <FacilityBoard
          facilities={facilities}
          dashboard={data}
          base="/uc"
          alertAction={{ to: '/uc/stock-requests', label: 'Open stock requests' }}
        />
      )}
    </div>
  )
}
