import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Truck, Clock } from 'lucide-react'
import { getDashboard, getStockRequests } from '../../lib/api'
import { OPEN_STAGES } from '../../lib/stockRequests'
import { useAuth } from '../../context/AuthContext'
import { buttonClasses } from '../../components/ui/Button'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'
import { FacilityBoard } from '../../components/facilities/FacilityOverview'
import { useFacilityList } from '../../components/facilities/FacilityDirectory'
import { plural } from '../../lib/format'

// Same stages the Stock Requests page lets the UC supervisor send for.
const SEND_STAGES = new Set(['awaiting_both', 'awaiting_sent'])

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
  const { data: reqData } = useQuery({ queryKey: ['stock-requests'], queryFn: () => getStockRequests(), refetchInterval: 30_000 })
  const reqs = reqData?.stockRequests ?? []
  const attention = [
    { icon: Truck, accent: 4, count: reqs.filter((r) => SEND_STAGES.has(r.stage)).length, label: 'requests waiting for you to send stock', to: '/uc/stock-requests' },
    { icon: Clock, accent: 'low', count: reqs.filter((r) => OPEN_STAGES.has(r.stage) && Date.now() - new Date(r.createdAt) > 3 * 86_400_000).length, label: 'requests open for over 3 days', to: '/uc/stock-requests' },
  ]

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
          attention={attention}
        />
      )}
    </div>
  )
}
