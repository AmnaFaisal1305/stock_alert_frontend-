import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isPending = false,
  error = null,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex flex-col gap-4">
        {typeof message === 'string' ? (
          <p className="text-sm text-text">{message}</p>
        ) : (
          message
        )}
        {error && (
          <p className="text-xs text-danger bg-danger-bg border border-danger/10 px-3 py-2 rounded-lg">{error}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? `${confirmLabel.replace(/e$/, '')}ing…` : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
