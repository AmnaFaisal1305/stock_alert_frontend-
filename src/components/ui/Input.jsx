export default function Input({
  label,
  id,
  error,
  className = '',
  ...props
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={id}
        className={[
          'w-full rounded-lg border px-3 py-2 text-sm text-text',
          'placeholder:text-text-muted bg-surface',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          'transition-colors',
          error
            ? 'border-danger focus:ring-danger'
            : 'border-surface-border',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
