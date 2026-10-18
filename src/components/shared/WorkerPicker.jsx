import { useState } from 'react'
import SearchInput from './SearchInput'

// Searchable single-select list of facility workers (Assign Vials, Day End).
export default function WorkerPicker({ workers, value, onChange, meta }) {
  const [q, setQ] = useState('')
  const shown = workers.filter((w) => (w.name ?? w.email).toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="flex flex-col gap-3">
      {workers.length > 5 && (
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vaccinators…" className="sm:w-full" />
      )}
      <div role="radiogroup" aria-label="Vaccinator" className="flex flex-col gap-1">
        {shown.length === 0 && <p className="text-sm text-text-muted px-1 py-2">No vaccinators match “{q}”.</p>}
        {shown.map((w) => {
          const label = w.name ?? w.email
          const active = w.id === value
          return (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(w.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-control border text-left transition-colors ${
                active ? 'bg-primary-bg border-primary' : 'border-transparent hover:bg-surface-alt'
              }`}
            >
              <span className={`w-9 h-9 rounded-full grid place-items-center text-sm font-medium flex-none ${active ? 'bg-primary text-white' : 'bg-surface-chip text-text'}`}>
                {label[0].toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text truncate capitalize">{label}</span>
                <span className="block text-xs text-text-muted truncate">{meta?.(w) ?? 'Vaccinator'}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
