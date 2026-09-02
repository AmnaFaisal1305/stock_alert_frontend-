import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../lib/api'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { Users, UserCheck, UserX, Building2, MapPin, Search } from 'lucide-react'

const AVATAR_COLORS = [
  'bg-teal-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-pink-500', 'bg-sky-500',
]

function getAvatarColor(key) {
  return AVATAR_COLORS[(key?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

const ROLE_BADGE = {
  facility_supervisor: 'Facility Supervisor',
  facility_worker:     'Facility Worker',
  uc_supervisor:       'UC Supervisor',
}

function UserCard({ user }) {
  const displayName = user.name ?? user.email
  const initial     = (displayName?.[0] ?? '?').toUpperCase()
  const avatarColor = getAvatarColor(displayName)
  const isActive    = user.isActive

  return (
    <div className={`bg-surface rounded-xl border border-surface-border p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md ${!isActive ? 'opacity-60' : ''}`}>
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Role badge */}
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-text-muted border border-surface-border">
          {ROLE_BADGE[user.role] ?? user.role}
        </span>

        {/* Avatar */}
        <div className="relative">
          <div className={`w-14 h-14 rounded-full ${avatarColor} text-white flex items-center justify-center text-xl font-bold flex-shrink-0 ${
            isActive ? 'ring-2 ring-success ring-offset-2' : 'ring-2 ring-surface-border ring-offset-2'
          }`}>
            {initial}
          </div>
          {isActive && (
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-success border-2 border-surface" />
          )}
        </div>

        {/* Name + email + status */}
        <div className="min-w-0 w-full">
          <p className="text-sm font-semibold text-text truncate" title={displayName}>{displayName}</p>
          <p className="text-xs text-text-muted truncate" title={user.email}>{user.email}</p>
          <span className={`inline-flex items-center gap-1 mt-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            isActive ? 'bg-success-bg text-success-dark' : 'bg-surface-alt text-text-muted'
          }`}>
            {isActive ? <UserCheck size={11} /> : <UserX size={11} />}
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Facility / UC info */}
      <div className="pt-1 border-t border-surface-border flex flex-col gap-1">
        {user.facilityName ? (
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-text-muted flex-shrink-0" />
            <p className="text-xs font-semibold text-text-muted truncate" title={user.facilityName}>
              {user.facilityName}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-text-muted flex-shrink-0" />
            <p className="text-xs text-text-muted italic">Unassigned</p>
          </div>
        )}
        {user.ucName && (
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-text-muted flex-shrink-0" />
            <p className="text-xs text-text-muted truncate" title={user.ucName}>{user.ucName}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UCSupervisorUsers() {
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 30_000,
  })

  const users = data?.users ?? []

  const activeCount   = users.filter((u) => u.isActive).length
  const inactiveCount = users.filter((u) => !u.isActive).length

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter((u) =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.facilityName ?? '').toLowerCase().includes(q) ||
      (u.ucName ?? '').toLowerCase().includes(q)
    )
  }, [users, search])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="bg-primary rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Users</h1>
          <p className="text-sm text-white/70 mt-0.5">
            {isLoading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''} in your union councils`}
          </p>
        </div>
        <Users size={22} className="text-white/30 flex-shrink-0" />
      </div>

      {/* Stats chips */}
      {!isLoading && users.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-semibold text-text-muted bg-surface-alt border border-surface-border px-2.5 py-1 rounded-full">
            <Users size={11} /> {users.length} total
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-success-dark bg-success-bg px-2.5 py-1 rounded-full">
            <UserCheck size={11} /> {activeCount} active
          </span>
          {inactiveCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-text-muted bg-surface-alt border border-surface-border px-2.5 py-1 rounded-full">
              <UserX size={11} /> {inactiveCount} inactive
            </span>
          )}
        </div>
      )}

      {/* Search */}
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

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      )}

      {isError && (
        <div className="bg-danger-bg border border-danger/10 text-xs font-semibold text-danger rounded-xl px-4 py-3">
          Failed to load users. Please try refreshing.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && users.length === 0 && (
        <div className="text-center py-16 border border-dashed border-surface-border rounded-xl text-text-muted">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-text">No users yet</p>
          <p className="text-sm mt-1">Users assigned to your union councils will appear here.</p>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && !isError && users.length > 0 && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-surface-border rounded-xl text-text-muted">
              <Search size={28} className="mx-auto mb-2 opacity-20" />
              <p className="font-semibold text-text text-sm">No matches for "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((u) => (
                <UserCard key={u.id} user={u} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
