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
    function handleKey(e) { if (e.key === 'Escape') { setIsOpen(false); buttonRef.current?.focus() } }
    document.addEventListener('mousedown', handleClose)
    document.addEventListener('keydown', handleKey)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClose)
      document.removeEventListener('keydown', handleKey)
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
        <label htmlFor={id} className="text-sm font-medium text-text">
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
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={[
            'w-full h-9 flex items-center justify-between gap-2 rounded-control border px-3.5 text-sm text-text bg-surface transition-colors text-left cursor-pointer select-none',
            'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10',
            disabled ? 'bg-surface-alt text-text-muted cursor-not-allowed opacity-60' : '',
            error ? 'border-danger focus:border-danger focus:ring-danger/10' : 'border-surface-border',
            isOpen ? 'border-primary ring-[3px] ring-primary/10' : '',
            className,
          ].join(' ')}
          {...props}
        >
          <span className={`truncate ${selectedOption ? 'text-text' : 'text-text-muted'}`}>
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
            role="listbox" className="bg-surface rounded-control shadow-float ring-1 ring-surface-border max-h-60 overflow-y-auto py-1"
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
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={[
                      'w-full flex items-start justify-between gap-2 px-3.5 py-2 text-sm text-left transition-colors cursor-pointer select-none',
                      isSelected
                        ? 'bg-primary-bg text-primary font-semibold'
                        : 'text-text hover:bg-surface-alt hover:text-text',
                    ].join(' ')}
                  >
                    <span className="flex-1 min-w-0 whitespace-normal break-words">{opt.label}</span>
                    {isSelected && <Check size={14} className="text-primary flex-shrink-0 mt-0.5" />}
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
