import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../lib/api'
import Table from '../../components/shared/Table'
import Badge from '../../components/ui/Badge'
import { Users, Search } from 'lucide-react'

const ROLE_LABELS = {
  facility_supervisor: 'Facility Supervisor',
  facility_worker:     'Worker',
}

export default function UCSupervisorUsers() {
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 30_000,
  })

  const users = data?.users ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter((u) =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.facilityName ?? '').toLowerCase().includes(q) ||
      (u.ucName ?? '').toLowerCase().includes(q)
    )
  }, [users, search])

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div>
          <p className="font-bold text-text text-sm">{row.name}</p>
          <p className="text-[10px] text-text-muted font-medium mt-0.5">{row.email ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-text-muted">
          {ROLE_LABELS[row.role] ?? row.role}
        </span>
      ),
    },
    {
      key: 'facilityName',
      label: 'Facility',
      render: (row) => (
        <span className="text-xs font-medium text-text">{row.facilityName ?? '—'}</span>
      ),
    },
    {
      key: 'ucName',
      label: 'UC',
      render: (row) => (
        <span className="text-xs font-medium text-text">{row.ucName ?? '—'}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row) => <Badge type={row.isActive ? 'active' : 'inactive'} />,
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Users</h1>
          <p className="text-sm text-white/70 mt-0.5">
            {isLoading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''} in your union councils`}
          </p>
        </div>
        <Users size={22} className="text-white/30 flex-shrink-0" />
      </div>

      {!isLoading && !isError && users.length > 0 && (
        <div className="relative w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, facility or UC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-surface-border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-muted/60"
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load users. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && (
        <Table
          columns={columns}
          rows={filtered}
          emptyMessage={search ? `No users match "${search}".` : 'No users found.'}
        />
      )}
    </div>
  )
}
