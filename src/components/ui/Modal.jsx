import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  const dialogRef = useRef(null)

  // Focus first element on open
  useEffect(() => {
    if (open) {
      const firstFocusable = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)?.[0]
      firstFocusable?.focus()
    }
  }, [open])

  // Handle key listeners and focus trapping
  useEffect(() => {
    if (!open) return

    function onKey(e) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div ref={dialogRef} className={`relative bg-white rounded-2xl border border-surface-border shadow-2xl w-full ${maxWidth} z-10 overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-border">
          <h2 className="text-lg font-bold text-text tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close"
          >
            <X size={18} className="text-text-muted" />
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}
