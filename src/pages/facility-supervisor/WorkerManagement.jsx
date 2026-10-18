import { Syringe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../lib/api'
import Badge from '../../components/ui/Badge'
import ViewToggle from '../../components/ui/ViewToggle'
import ExportButton from '../../components/ui/ExportButton'
import PageHeader from '../../components/shared/PageHeader'
import Table from '../../components/shared/Table'
import ErrorState from '../../components/shared/ErrorState'
import EntityCard from '../../components/shared/EntityCard'
import { plural } from '../../lib/format'
import { useViewMode } from '../../hooks/useViewMode'

// Read-only since Round 37: only the Super Admin creates or changes accounts.
export default function WorkerManagement() {
  const [view, setView] = useViewMode('facility-workers')

  const { data: userData, isLoading, isError, error, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const workers     = userData?.users ?? []
  const activeCount = workers.filter((w) => w.isActive).length

  const gridCard = (w) => (
    <EntityCard
      icon={Syringe}
      accent={w.isActive ? 'primary' : 'no_data'}
      title={w.name ?? w.email}
      subtitle={w.email}
      badge={<Badge type={w.isActive ? 'active' : 'inactive'} />}
      meta={[
        { label: 'ZMID', value: w.zmid },
        { label: 'Phone', value: w.phone },
        { label: 'CNIC', value: w.cnic },
      ]}
    />
  )

  const columns = [
    {
      key: 'name', label: 'Vaccinator',
      render: (w) => (
        <div className={w.isActive ? '' : 'opacity-60'}>
          <p className="font-medium text-text">{w.name ?? w.email}</p>
          <p className="text-xs text-text-muted">{w.email}</p>
        </div>
      ),
    },
    { key: 'zmid', label: 'ZMID', render: (w) => w.zmid ?? <span className="text-text-muted">—</span> },
    { key: 'phone', label: 'Phone', render: (w) => w.phone ?? <span className="text-text-muted">—</span> },
    { key: 'cnic', label: 'CNIC', render: (w) => w.cnic ?? <span className="text-text-muted">—</span> },
    { key: 'status', label: 'Status', render: (w) => <Badge type={w.isActive ? 'active' : 'inactive'} /> },
  ]

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Supervisor › Team"
        title="Vaccinators"
        subtitle={workers.length ? `${plural(workers.length, 'vaccinator')} · ${activeCount} active` : 'Vaccinators at your facility'}
        actions={
          <>
            <ViewToggle value={view} onChange={setView} />
            <ExportButton
              name="vaccinators"
              rows={workers}
              columns={[
                { label: 'Name', value: (w) => w.name },
                { label: 'Email', value: (w) => w.email },
                { label: 'ZMID', value: (w) => w.zmid },
                { label: 'Phone', value: (w) => w.phone },
                { label: 'CNIC', value: (w) => w.cnic },
                { label: 'Status', value: (w) => (w.isActive ? 'Active' : 'Inactive') },
              ]}
            />
          </>
        }
      />

      {isError ? (
        <ErrorState title="Couldn’t load vaccinators" error={error} onRetry={refetch} />
      ) : (
        <Table
          columns={columns}
          rows={workers}
          loading={isLoading}
          view={view}
          gridCard={gridCard}
          emptyMessage="No vaccinators yet."
          mobileCard={(w) => (
            <div className="px-4 py-3.5 flex items-start justify-between gap-3">
              <div className={`min-w-0 ${w.isActive ? '' : 'opacity-60'}`}>
                <p className="font-medium text-text truncate">{w.name ?? w.email}</p>
                <p className="text-xs text-text-muted truncate">{[w.zmid, w.phone].filter(Boolean).join(' · ') || w.email}</p>
              </div>
              <Badge type={w.isActive ? 'active' : 'inactive'} />
            </div>
          )}
        />
      )}
    </div>
  )
}
