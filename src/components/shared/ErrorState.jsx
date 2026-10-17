import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button'

// Inline load failure: say what failed, show the server's reason, offer Retry.
export default function ErrorState({ title = 'Couldn’t load this data', error, onRetry, className = '' }) {
  const detail = typeof error === 'string' ? error : error?.message
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-card bg-danger-bg px-4 py-3.5 ${className}`}>
      <AlertCircle size={18} strokeWidth={1.75} className="text-danger-dark flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-danger-dark">{title}</p>
        {detail && <p className="text-xs text-danger-dark/80 mt-0.5 break-words">{detail}</p>}
      </div>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  )
}
