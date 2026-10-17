import { ROLE_LABELS, ROLE_ACCENT } from '../../lib/navigation'
import { ACCENT } from './StatCard'

// Role name on its category wash, so roles are told apart at a glance in user lists.
export default function RoleTag({ role }) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium whitespace-nowrap ${ACCENT[ROLE_ACCENT[role]] ?? ACCENT[5]}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}
