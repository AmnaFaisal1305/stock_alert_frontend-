import { useState, useRef, useEffect } from 'react'
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { toLocalDateStr } from '../../lib/format'

// value / min / max are 'YYYY-MM-DD'; onChange gets { target: { value } } like a native input.
// Fine pointers get the design-system calendar popover; touch devices keep the native picker,
// which is easier one-handed.

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const parse = (s) => (s ? new Date(`${s}T00:00:00`) : null)
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), 28))
const label = (s) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function useCoarsePointer() {
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  return coarse
}

// 6×7 grid starting on the Monday on or before the 1st.
function monthGrid(view) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

function CalendarPopover({ value, min, max, onPick, onClose, anchorRect }) {
  const [focus, setFocus] = useState(() => parse(value) ?? parse(toLocalDateStr(new Date())))
  const gridRef = useRef(null)
  const today = toLocalDateStr(new Date())
  const disabled = (s) => (min && s < min) || (max && s > max)

  useEffect(() => {
    gridRef.current?.querySelector(`[data-day="${toLocalDateStr(focus)}"]`)?.focus()
  }, [focus])

  function onKey(e) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (moves[e.key]) { e.preventDefault(); setFocus((d) => addDays(d, moves[e.key])) }
    else if (e.key === 'PageUp') { e.preventDefault(); setFocus((d) => addMonths(d, -1)) }
    else if (e.key === 'PageDown') { e.preventDefault(); setFocus((d) => addMonths(d, 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setFocus((d) => addDays(d, -((d.getDay() + 6) % 7))) }
    else if (e.key === 'End') { e.preventDefault(); setFocus((d) => addDays(d, 6 - ((d.getDay() + 6) % 7))) }
  }

  // Open below the field, or above it when there isn't room.
  const above = anchorRect.bottom + 340 > window.innerHeight && anchorRect.top > 340
  const left = Math.min(anchorRect.left, window.innerWidth - 296)
  const style = { position: 'fixed', left: Math.max(8, left), zIndex: 9999, ...(above ? { bottom: window.innerHeight - anchorRect.top + 6 } : { top: anchorRect.bottom + 6 }) }

  const view = focus
  const days = monthGrid(view)
  const todayDisabled = disabled(today)

  return (
    <div style={style} role="dialog" aria-label="Choose date" className="w-[288px] bg-surface rounded-card shadow-float ring-1 ring-surface-border p-3 animate-pop-in motion-reduce:animate-none">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setFocus((d) => addMonths(d, -1))} className="w-8 h-8 grid place-items-center rounded-control text-text-muted hover:bg-surface-alt hover:text-text" aria-label="Previous month">
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <p className="text-sm font-semibold text-text" aria-live="polite">
          {view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
        <button type="button" onClick={() => setFocus((d) => addMonths(d, 1))} className="w-8 h-8 grid place-items-center rounded-control text-text-muted hover:bg-surface-alt hover:text-text" aria-label="Next month">
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-text-muted mb-1" aria-hidden="true">
        {WEEKDAYS.map((w) => <span key={w} className="h-7 grid place-items-center">{w}</span>)}
      </div>
      <div ref={gridRef} role="grid" onKeyDown={onKey} className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const s = toLocalDateStr(d)
          const inMonth = d.getMonth() === view.getMonth()
          const selected = s === value
          const isFocus = s === toLocalDateStr(focus)
          const off = disabled(s)
          return (
            <button
              key={s}
              type="button"
              data-day={s}
              tabIndex={isFocus ? 0 : -1}
              disabled={off}
              aria-selected={selected}
              aria-label={label(s)}
              onClick={() => onPick(s)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!off) onPick(s) } }}
              className={[
                'h-9 rounded-control text-sm tabular-nums transition-colors',
                selected ? 'bg-primary text-white font-semibold' : inMonth ? 'text-text hover:bg-surface-alt' : 'text-text-muted/60 hover:bg-surface-alt',
                s === today && !selected ? 'ring-1 ring-inset ring-primary/40 font-semibold' : '',
                off ? 'opacity-30 pointer-events-none' : '',
              ].join(' ')}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-border">
        <button type="button" onClick={() => onPick('')} className="text-xs text-text-muted hover:text-text px-2 py-1 rounded-control hover:bg-surface-alt">Clear</button>
        <button type="button" disabled={todayDisabled} onClick={() => onPick(today)} className="text-xs font-medium text-primary px-2 py-1 rounded-control hover:bg-primary-bg disabled:opacity-40">Today</button>
        <button type="button" onClick={onClose} className="text-xs text-text-muted hover:text-text px-2 py-1 rounded-control hover:bg-surface-alt">Close</button>
      </div>
    </div>
  )
}

export default function DatePicker({
  id,
  label: fieldLabel,
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  min,
  max,
}) {
  const coarse = useCoarsePointer()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)

  const emit = (v) => onChange({ target: { id, value: v } })

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
    const onScroll = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function toggle() {
    if (!open) setRect(buttonRef.current.getBoundingClientRect())
    setOpen((o) => !o)
  }

  const field = 'w-full h-9 rounded-control border pl-10 text-sm bg-surface transition-colors cursor-pointer focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10'

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      {fieldLabel && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {fieldLabel}
        </label>
      )}
      <div className="relative group">
        <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10" />
        {coarse ? (
          <input
            id={id}
            type="date"
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            className={[field, open ? '' : 'border-surface-border', value ? 'pr-8 text-text' : 'pr-3.5 text-text-muted', className].join(' ')}
          />
        ) : (
          <button
            ref={buttonRef}
            id={id}
            type="button"
            onClick={toggle}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={[field, 'text-left', open ? 'border-primary ring-[3px] ring-primary/10' : 'border-surface-border', value ? 'pr-8 text-text' : 'pr-3.5 text-text-muted', className].join(' ')}
          >
            <span className="tabular-nums">{value ? label(value) : placeholder}</span>
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => emit('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-danger transition-colors p-0.5 rounded-md hover:bg-danger/10"
            aria-label="Clear date"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}
        {open && rect && (
          <CalendarPopover
            value={value}
            min={min}
            max={max}
            anchorRect={rect}
            onClose={() => { setOpen(false); buttonRef.current?.focus() }}
            onPick={(s) => { emit(s); setOpen(false); buttonRef.current?.focus() }}
          />
        )}
      </div>
    </div>
  )
}
