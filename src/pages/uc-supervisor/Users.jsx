import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../lib/api'
import Badge from '../../components/ui/Badge'
import PageHeader from '../../components/shared/PageHeader'
import Table from '../../components/shared/Table'
import SearchInput from '../../components/shared/SearchInput'
import ErrorState from '../../components/shared/ErrorState'
import { ROLE_LABELS } from '../../lib/navigation'
import { plural } from '../../lib/format'

const dash = <span className="text-text-muted">—</span>

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
  { key: 'uc', label: 'Union council', render: (u) => u.ucName ?? dash },
  { key: 'status', label: 'Status', render: (u) => <Badge type={u.isActive ? 'active' : 'inactive'} /> },
]

export default function UCSupervisorUsers() {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers, staleTime: 30_000 })

  const users = data?.users ?? []
  const active = users.filter((u) => u.isActive).length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      [u.name, u.email, u.facilityName, u.ucName].some((v) => v?.toLowerCase().includes(q))
    )
  }, [users, search])

  return (
    <div>
      <PageHeader
        breadcrumb="UC Supervisor › Team"
        title="Users"
        subtitle={users.length ? `${plural(users.length, 'user')} in your union councils · ${active} active` : 'Staff in your union councils'}
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
            emptyMessage={search ? `No users match “${search}”.` : 'No users in your union councils yet.'}
            mobileCard={(u) => (
              <div className="px-4 py-3.5 flex items-start justify-between gap-3">
                <div className={`min-w-0 ${u.isActive ? '' : 'opacity-60'}`}>
                  <p className="font-medium text-text truncate">{u.name ?? u.email}</p>
                  <p className="text-xs text-text-muted truncate">
                    {[ROLE_LABELS[u.role] ?? u.role, u.facilityName, u.ucName].filter(Boolean).join(' · ')}
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
