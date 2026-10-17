// Loading placeholders shaped like the content they replace.
export default function SkeletonCard({ lines = 2, className = '' }) {
  return (
    <div className={`bg-surface rounded-card border border-surface-border p-4 sm:p-5 animate-pulse motion-reduce:animate-none ${className}`} aria-hidden="true">
      <div className="h-3 bg-surface-chip rounded w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 bg-surface-chip rounded ${i < lines - 1 ? 'mb-2.5 w-full' : 'w-1/2'}`} />
      ))}
    </div>
  )
}

// Rows for list/table loading; renders inside an existing Card or on the page.
export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={`animate-pulse motion-reduce:animate-none ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 sm:px-5 py-4 border-b border-surface-border last:border-0">
          <div className="h-3 bg-surface-chip rounded w-1/4" />
          <div className="h-3 bg-surface-chip rounded flex-1" />
          <div className="h-3 bg-surface-chip rounded w-16" />
        </div>
      ))}
    </div>
  )
}
