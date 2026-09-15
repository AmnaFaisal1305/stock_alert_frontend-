import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between bg-white px-4 sm:px-5 py-3 sm:py-4 rounded-2xl border border-surface-border shadow-sm gap-2">
      <p className="text-xs text-text-muted font-semibold hidden sm:block flex-shrink-0">
        Page <span className="font-extrabold text-text">{currentPage}</span> of{' '}
        <span className="font-extrabold text-text">{totalPages}</span>
      </p>
      <p className="text-xs text-text-muted font-semibold sm:hidden flex-shrink-0">
        {currentPage}/{totalPages}
      </p>
      <nav className="isolate inline-flex overflow-x-auto max-w-full rounded-xl shadow-sm border border-slate-200 bg-slate-50 p-0.5 gap-0.5" aria-label="Pagination">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: totalPages }).map((_, i) => {
          const p = i + 1
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                p === currentPage ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-white'
              }`}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center rounded-lg p-1.5 text-text-muted hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  )
}
