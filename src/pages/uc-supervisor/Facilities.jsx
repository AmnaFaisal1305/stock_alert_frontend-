import PageHeader from '../../components/shared/PageHeader'
import FacilityDirectory, { useFacilityList } from '../../components/facilities/FacilityDirectory'
import { plural } from '../../lib/format'

export default function UCSupervisorFacilities() {
  const query = useFacilityList()
  const n = query.data?.facilities?.length ?? 0
  return (
    <div>
      <PageHeader
        breadcrumb="UC Supervisor › Overview"
        title="Facilities"
        subtitle={n ? `${plural(n, 'facility', 'facilities')} in your union councils` : undefined}
      />
      <FacilityDirectory base="/uc" query={query} />
    </div>
  )
}
