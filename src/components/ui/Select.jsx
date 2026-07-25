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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedOption = options.find((opt) => opt.value === value)

  function openDropdown() {
    if (disabled) return
    if (!isOpen) {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) {
        setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width })
      }
    }
    setIsOpen((o) => !o)
  }

  useEffect(() => {
    if (!isOpen) return
    function handleClose(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    function handleScroll(e) {
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClose)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClose)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  const handleSelect = (val) => {
    if (disabled) return
    setIsOpen(false)
    if (onChange) {
      onChange({ target: { id, name: props.name, value: val } })
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-text">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          id={id}
          disabled={disabled}
          onClick={openDropdown}
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
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
            className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
          >
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
