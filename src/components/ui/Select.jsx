import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function Select({
  label,
  id,
  options = [],
  error,
  placeholder = 'Select…',
  value,
  onChange,
  className = '',
  disabled = false,
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Find selected option
  const selectedOption = options.find((opt) => opt.value === value)

  // Only attach listener while dropdown is open
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (val) => {
    if (disabled) return
    setIsOpen(false)
    if (onChange) {
      // Simulate standard event target structure so we do not break any parent onChange handlers
      onChange({
        target: {
          id,
          name: props.name,
          value: val,
        },
      })
    }
  }

  return (
    <div className="flex flex-col gap-1.5 relative w-full" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-text">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={[
            'w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm text-text bg-white shadow-sm transition-all text-left cursor-pointer select-none',
            'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
            disabled ? 'bg-slate-50 text-text-muted cursor-not-allowed opacity-60' : '',
            error ? 'border-danger focus:border-danger focus:ring-danger/10' : 'border-surface-border',
            isOpen ? 'border-primary ring-4 ring-primary/10' : '',
            className,
          ].join(' ')}
          {...props}
        >
          <span className={selectedOption ? 'text-text font-medium' : 'text-text-muted/60'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={['text-text-muted/70 transition-transform duration-200', isOpen ? 'rotate-180 text-primary' : ''].join(' ')}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1.5 focus:outline-none animate-in fade-in slide-in-from-top-1 duration-150">
            {options.length === 0 ? (
              <div className="px-4 py-2.5 text-xs text-text-muted italic">No options available</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={[
                      'w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-left transition-colors cursor-pointer select-none',
                      isSelected
                        ? 'bg-primary/5 text-primary font-bold'
                        : 'text-text hover:bg-slate-50 hover:text-text',
                    ].join(' ')}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={14} className="text-primary" />}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
    </div>
  )
}
