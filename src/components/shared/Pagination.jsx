import { ChevronLeft, ChevronRight } from 'lucide-react'

// Windowed page list: first, last, current ±1, with ellipses between gaps.
function pageList(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…' + p)
    out.push(p)
  })
  return out
}

const btn = 'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-control text-sm tabular-nums transition-colors'

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <nav className="flex items-center justify-between gap-3 px-1 py-2" aria-label="Pagination">
      <p className="text-xs text-text-muted tabular-nums">
        Page <span className="text-text font-medium">{currentPage}</span> of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${btn} text-text-muted hover:bg-surface-chip hover:text-text disabled:opacity-40 disabled:pointer-events-none`}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        {pageList(currentPage, totalPages).map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="px-1 text-text-muted" aria-hidden="true">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={`${btn} ${p === currentPage ? 'bg-primary text-white' : 'text-text hover:bg-surface-chip'}`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${btn} text-text-muted hover:bg-surface-chip hover:text-text disabled:opacity-40 disabled:pointer-events-none`}
          aria-label="Next page"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  )
}
