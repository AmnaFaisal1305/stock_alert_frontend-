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
    <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-surface shadow-lg rounded-xl px-4 py-3 border border-surface-border min-w-[260px] max-w-sm animate-slide-up">
      {icons[type]}
      <p className="text-sm text-text flex-1">{message}</p>
      <button onClick={onClose} className="text-text-muted hover:text-text transition-colors mt-0.5">
        <X size={16} />
      </button>
    </div>
  )
}
