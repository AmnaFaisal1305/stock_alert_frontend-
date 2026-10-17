import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../lib/api'
import Badge from '../../components/ui/Badge'
import PageHeader from '../../components/shared/PageHeader'
import Table from '../../components/shared/Table'
import ErrorState from '../../components/shared/ErrorState'
import { ROLE_LABELS } from '../../lib/navigation'
import { plural } from '../../lib/format'

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
  { key: 'role', label: 'Role', render: (u) => ROLE_LABELS[u.role] ?? u.role },
  { key: 'zmid', label: 'ZMID', render: (u) => u.zmid ?? <span className="text-text-muted">—</span> },
  { key: 'status', label: 'Status', render: (u) => <Badge type={u.isActive ? 'active' : 'inactive'} /> },
]

export default function FacilityHeadUsers() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const users = data?.users ?? []
  const active = users.filter((u) => u.isActive).length

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Head › Team"
        title="Users"
        subtitle={users.length ? `${plural(users.length, 'person', 'people')} at your facility · ${active} active` : 'Staff at your facility'}
      />
      {isError ? (
        <ErrorState title="Couldn’t load users" error={error} onRetry={refetch} />
      ) : (
        <Table
          columns={columns}
          rows={users}
          loading={isLoading}
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
