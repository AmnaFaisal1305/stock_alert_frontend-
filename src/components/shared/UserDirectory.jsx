// Read-only, searchable staff table for the UC and district Users pages.
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../lib/api'
import Badge from '../ui/Badge'
import PageHeader from './PageHeader'
import Table from './Table'
import SearchInput from './SearchInput'
import ErrorState from './ErrorState'
import { ROLE_LABELS } from '../../lib/navigation'
import { plural } from '../../lib/format'

const dash = <span className="text-text-muted">—</span>
// UC supervisors carry ucNames (several UCs); facility staff carry one ucName.
const ucOf = (u) => u.ucName ?? (u.ucNames?.length ? u.ucNames.join(', ') : null)

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
  { key: 'facility', label: 'Facility', render: (u) => u.facilityName ?? dash },
  { key: 'uc', label: 'Union council', render: (u) => ucOf(u) ?? dash },
  { key: 'status', label: 'Status', render: (u) => <Badge type={u.isActive ? 'active' : 'inactive'} /> },
]

export default function UserDirectory({ breadcrumb, scope }) {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers, staleTime: 30_000 })

  const users = data?.users ?? []
  const active = users.filter((u) => u.isActive).length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => [u.name, u.email, u.facilityName, ucOf(u)].some((v) => v?.toLowerCase().includes(q)))
  }, [users, search])

  return (
    <div>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Users"
        subtitle={users.length ? `${plural(users.length, 'user')} in your ${scope} · ${active} active` : `Staff in your ${scope}`}
      />
      {isError ? (
        <ErrorState title="Couldn’t load users" error={error} onRetry={refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          {users.length > 0 && (
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, facility or UC…" />
          )}
          <Table
            columns={columns}
            rows={filtered}
            loading={isLoading}
            emptyMessage={search ? `No users match “${search}”.` : `No users in your ${scope} yet.`}
            mobileCard={(u) => (
              <div className="px-4 py-3.5 flex items-start justify-between gap-3">
                <div className={`min-w-0 ${u.isActive ? '' : 'opacity-60'}`}>
                  <p className="font-medium text-text truncate">{u.name ?? u.email}</p>
                  <p className="text-xs text-text-muted truncate">
                    {[ROLE_LABELS[u.role] ?? u.role, u.facilityName, ucOf(u)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Badge type={u.isActive ? 'active' : 'inactive'} />
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}
