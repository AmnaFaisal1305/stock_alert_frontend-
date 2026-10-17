import { useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

// Right-edge slide-over for secondary lists (e.g. "My requests") that shouldn't replace the page.
export default function Drawer({ open, onClose, title, subtitle, children, width = 'sm:w-[460px]' }) {
  const panelRef = useRef(null)
  useFocusTrap(panelRef, open, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[rgb(28_33_30/0.35)]" onClick={onClose} />
      <aside
        ref={panelRef}
        className={`absolute inset-y-0 right-0 w-full ${width} bg-surface shadow-overlay flex flex-col animate-toast-in motion-reduce:animate-none`}
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 -mr-2 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-alt hover:text-text transition-colors"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  )
}
