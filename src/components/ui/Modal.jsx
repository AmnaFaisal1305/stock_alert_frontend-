import { useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, open, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[rgb(28_33_30/0.35)]" onClick={onClose} />
      <div
        ref={dialogRef}
        className={`relative bg-surface rounded-t-card sm:rounded-card shadow-overlay w-full ${maxWidth} flex flex-col max-h-[calc(100dvh-2rem)] animate-toast-in motion-reduce:animate-none`}
      >
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-surface-border flex-shrink-0">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 -mr-2 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-alt hover:text-text transition-colors"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
