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
    <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-surface shadow-lg rounded-xl px-4 py-3 border border-surface-border min-w-[260px] max-w-sm animate-toast-in motion-reduce:animate-none">
      {icons[type]}
      <p className="text-sm text-text flex-1">{message}</p>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="w-11 h-11 -m-2.5 -mt-1.5 flex items-center justify-center text-text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        <X size={16} />
      </button>
    </div>
  )
}
