import { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

const icons = {
  success: <CheckCircle size={18} className="text-success" />,
  error:   <XCircle    size={18} className="text-danger"  />,
}

export default function Toast({ message, type = 'success', onClose, duration = 3500 }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [onClose, duration])

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-start gap-3.5 bg-white shadow-xl rounded-xl px-4 py-3.5 border border-surface-border min-w-[280px] max-w-sm animate-toast-in motion-reduce:animate-none"
    >
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <p className="text-sm text-text font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="w-8 h-8 flex items-center justify-center text-text-muted hover:bg-slate-50 hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        <X size={15} />
      </button>
    </div>
  )
}
