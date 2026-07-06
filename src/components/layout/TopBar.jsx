import { useAuth } from '../../context/AuthContext'

const ROLE_LABELS = {
  super_admin:         'Super Admin',
  district_supervisor: 'District Supervisor',
  facility_supervisor: 'Facility Supervisor',
  facility_worker:     'Facility Worker',
}

export default function TopBar() {
  const { user } = useAuth()

  return (
    <header className="h-14 bg-surface border-b border-surface-border flex items-center justify-between px-6">
      <div />
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <span className="text-sm text-text-muted">{user.email}</span>
        </div>
      )}
    </header>
  )
}
