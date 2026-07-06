export default function Select({
  label,
  id,
  options = [],
  error,
  placeholder = 'Select…',
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
      <select
        id={id}
        className={[
          'w-full rounded-lg border px-3 py-2 text-sm text-text bg-surface',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          'transition-colors appearance-none',
          error ? 'border-danger focus:ring-danger' : 'border-surface-border',
          className,
        ].join(' ')}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
