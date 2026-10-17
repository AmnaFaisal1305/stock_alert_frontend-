import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../lib/api'
import Badge from '../../components/ui/Badge'
import ViewToggle from '../../components/ui/ViewToggle'
import PageHeader from '../../components/shared/PageHeader'
import Table from '../../components/shared/Table'
import ErrorState from '../../components/shared/ErrorState'
import EntityCard from '../../components/shared/EntityCard'
import RoleTag from '../../components/shared/RoleTag'
import { ROLE_LABELS, ROLE_ACCENT, ROLE_ICON } from '../../lib/navigation'
import { plural } from '../../lib/format'
import { useViewMode } from '../../hooks/useViewMode'

const columns = [
  {
    key: 'name', label: 'Name',
    render: (u) => (
      <div className={u.isActive ? '' : 'opacity-60'}>
        <p className="font-medium text-text">{u.name ?? u.email}</p>
        <p className="text-xs text-text-muted">{u.email}</p>
      </div>
    ),
  },
  { key: 'role', label: 'Role', render: (u) => <RoleTag role={u.role} /> },
  { key: 'zmid', label: 'ZMID', render: (u) => u.zmid ?? <span className="text-text-muted">—</span> },
  { key: 'status', label: 'Status', render: (u) => <Badge type={u.isActive ? 'active' : 'inactive'} /> },
]

const gridCard = (u) => (
  <EntityCard
    icon={ROLE_ICON[u.role]}
    accent={u.isActive ? ROLE_ACCENT[u.role] : 'no_data'}
    title={u.name ?? u.email}
    subtitle={u.email}
    badge={<Badge type={u.isActive ? 'active' : 'inactive'} />}
    meta={[
      { label: 'Role', value: <RoleTag role={u.role} /> },
      { label: 'ZMID', value: u.zmid },
    ]}
  />
)

export default function FacilityHeadUsers() {
  const [view, setView] = useViewMode('head-users')
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const users = data?.users ?? []
  const active = users.filter((u) => u.isActive).length

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Head › Team"
        title="Users"
        subtitle={users.length ? `${plural(users.length, 'person', 'people')} at your facility · ${active} active` : 'Staff at your facility'}
        actions={<ViewToggle value={view} onChange={setView} />}
      />
      {isError ? (
        <ErrorState title="Couldn’t load users" error={error} onRetry={refetch} />
      ) : (
        <Table
          columns={columns}
          rows={users}
          loading={isLoading}
          view={view}
          gridCard={gridCard}
          emptyMessage="No staff accounts at this facility yet."
          mobileCard={(u) => (
            <div className="px-4 py-3.5 flex items-start justify-between gap-3">
              <div className={`min-w-0 ${u.isActive ? '' : 'opacity-60'}`}>
                <p className="font-medium text-text truncate">{u.name ?? u.email}</p>
                <p className="text-xs text-text-muted truncate">{ROLE_LABELS[u.role] ?? u.role} · {u.email}</p>
              </div>
              <Badge type={u.isActive ? 'active' : 'inactive'} />
            </div>
          )}
        />
      )}
    </div>
  )
}
