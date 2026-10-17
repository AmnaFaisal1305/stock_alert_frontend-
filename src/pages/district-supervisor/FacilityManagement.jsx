import PageHeader from '../../components/shared/PageHeader'
import FacilityDirectory, { useFacilityList } from '../../components/facilities/FacilityDirectory'
import { plural } from '../../lib/format'

export default function FacilityManagement() {
  const query = useFacilityList()
  const n = query.data?.facilities?.length ?? 0
  return (
    <div>
      <PageHeader
        breadcrumb="District Supervisor › Overview"
        title="Facilities"
        subtitle={n ? `${plural(n, 'facility', 'facilities')} in your district` : undefined}
      />
      <FacilityDirectory base="/district" query={query} />
    </div>
  )
}
