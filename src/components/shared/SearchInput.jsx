import { Search } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '', label }) {
  return (
    <div className={`relative w-full sm:w-72 ${className}`}>
      <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
      <input
        type="search"
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full h-9 pl-9 pr-3.5 text-sm text-text border border-surface-border rounded-control bg-surface focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary transition-colors placeholder:text-text-muted"
      />
    </div>
  )
}
