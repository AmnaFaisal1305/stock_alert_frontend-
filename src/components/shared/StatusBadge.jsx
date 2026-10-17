import { statusConfig, workflowStatusConfig } from '../../lib/status'

// kind="stock" (critical/low/adequate/no_data) or kind="workflow" (request stages, approvals).
export default function StatusBadge({ status, kind = 'stock', label }) {
  const c = kind === 'workflow' ? workflowStatusConfig(status) : statusConfig(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} aria-hidden="true" />
      {label ?? c.label}
    </span>
  )
}
