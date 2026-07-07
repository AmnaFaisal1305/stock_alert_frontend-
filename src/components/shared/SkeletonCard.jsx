export default function SkeletonCard({ lines = 2 }) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 animate-pulse">
      <div className="h-4 bg-surface-alt rounded w-2/3 mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 bg-surface-alt rounded ${i < lines - 1 ? 'mb-2 w-full' : 'w-1/2'}`}
        />
      ))}
    </div>
  )
}
