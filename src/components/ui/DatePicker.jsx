import { Calendar, X } from 'lucide-react'

export default function DatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  min,
  max,
}) {
  function handleClear() {
    onChange({ target: { value: '' } })
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative group">
        <Calendar
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none z-10"
        />
        <input
          id={id}
          type="date"
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          className={[
            'w-full rounded-lg border pl-10 py-2 text-sm bg-white shadow-sm transition-all cursor-pointer',
            'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
            'border-surface-border',
            value ? 'pr-8 text-text' : 'pr-3.5 text-text-muted/60',
            className,
          ].join(' ')}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-danger transition-colors p-0.5 rounded-md hover:bg-danger/10"
            aria-label="Clear date"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
