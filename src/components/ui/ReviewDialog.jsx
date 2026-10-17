import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

// "Check before you send": what will be recorded, any warnings, then Confirm / Go back.
// rows: [{ label, value }] (value may be a node); items: [{ name, value }] for per-vaccine lines.
export default function ReviewDialog({
  open, onClose, onConfirm, title, intro, rows = [], items = [], itemsLabel = 'Vaccines', total,
  warnings = [], confirmLabel = 'Confirm', isPending = false, error = null,
}) {
  const shown = warnings.filter(Boolean)
  return (
    <Modal open={open} onClose={isPending ? () => {} : onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        {intro && <p className="text-sm text-text-muted">{intro}</p>}

        {rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {rows.filter(Boolean).map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-text-muted">{r.label}</dt>
                <dd className="text-text text-right font-medium min-w-0 break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {items.length > 0 && (
          <div className="rounded-control border border-surface-border">
            <p className="px-3.5 py-2 text-xs font-medium text-text-muted border-b border-surface-border">{itemsLabel}</p>
            <ul className="max-h-60 overflow-y-auto divide-y divide-surface-border">
              {items.map((it) => (
                <li key={it.name} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
                  <span className="text-text min-w-0 truncate">{it.name}</span>
                  <span className="text-text tabular-nums font-medium whitespace-nowrap">{it.value}</span>
                </li>
              ))}
            </ul>
            {total != null && (
              <p className="flex items-center justify-between px-3.5 py-2 text-sm border-t border-surface-border bg-surface-alt rounded-b-control">
                <span className="text-text-muted">Total</span>
                <span className="text-text tabular-nums font-semibold">{total}</span>
              </p>
            )}
          </div>
        )}

        {shown.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-control bg-warning-bg px-3.5 py-2.5">
            {shown.map((w) => (
              <li key={w} className="flex items-start gap-2 text-sm text-warning-dark">
                <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                {w}
              </li>
            ))}
          </ul>
        )}

        {error && <p role="alert" className="text-sm text-danger-dark bg-danger-bg px-3.5 py-2.5 rounded-control">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <Button variant="secondary" size="lg" className="sm:h-9" onClick={onClose} disabled={isPending}>Go back</Button>
          <Button size="lg" className="sm:h-9" onClick={onConfirm} disabled={isPending}>{isPending ? 'Saving…' : confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}
