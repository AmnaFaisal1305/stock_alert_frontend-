import { Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const ROLE_LABELS = {
  super_admin:         'Super Admin',
  district_supervisor: 'District Supervisor',
  facility_supervisor: 'Facility Supervisor',
  facility_worker:     'Facility Worker',
}

export default function TopBar({ onMenuClick }) {
  const { user } = useAuth()

  return (
    <header className="h-14 bg-surface border-b border-surface-border flex items-center justify-between px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="p-1.5 -ml-1.5 rounded-lg text-text-muted hover:bg-surface-alt hover:text-text transition-colors lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full whitespace-nowrap">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <span className="text-sm text-text-muted truncate max-w-[40vw] sm:max-w-none">{user.email}</span>
        </div>
      )}
    </header>
  )
}
