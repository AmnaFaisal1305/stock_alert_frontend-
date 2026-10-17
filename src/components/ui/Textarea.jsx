// Multi-line note/reason field. `required` only changes the label hint and aria state;
// callers keep their own validation (disabled submit), so no native browser bubble appears.
export default function Textarea({ id, label, required = false, showCount = false, value = '', maxLength = 500, rows = 2, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label} <span className="text-text-muted font-normal">{required ? '(required)' : '(optional)'}</span>
        </label>
      )}
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        aria-required={required || undefined}
        className="w-full rounded-control border border-surface-border bg-surface px-3.5 py-2.5 text-sm text-text resize-none placeholder:text-text-muted focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary"
        {...props}
      />
      {showCount && <p className="text-xs text-text-muted text-right tabular-nums">{value.length}/{maxLength}</p>}
    </div>
  )
}
