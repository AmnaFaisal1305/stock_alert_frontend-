import { CheckCircle2, WifiOff } from 'lucide-react'
import Button from '../ui/Button'

// Confirmation after a submit: tells the user what happened and offers the next action.
// tone="offline" when the submission was queued for later sync.
export default function ResultPanel({ tone = 'success', title, message, actionLabel, onAction }) {
  const offline = tone === 'offline'
  const Icon = offline ? WifiOff : CheckCircle2
  return (
    <div role="status" className="max-w-md mx-auto mt-10 text-center bg-surface border border-surface-border rounded-card px-6 py-10">
      <span className={`mx-auto w-12 h-12 rounded-full grid place-items-center ${offline ? 'bg-warning-bg text-warning-dark' : 'bg-success-bg text-success-dark'}`}>
        <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-text">{title}</h2>
      <p className="mt-1 text-sm text-text-muted">{message}</p>
      {onAction && <Button variant="secondary" className="mt-6" onClick={onAction}>{actionLabel}</Button>}
    </div>
  )
}
