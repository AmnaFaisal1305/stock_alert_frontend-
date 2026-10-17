import { SkeletonRows } from './SkeletonCard'

// columns: [{ key, label, render?, align?: 'right' | 'left', className? }]
// Below sm, rows render as `mobileCard(row)` if given, otherwise as label/value stacks.
// view="grid" with gridCard(row) renders a responsive card grid instead (entity lists).
export default function Table({
  columns, rows, emptyMessage = 'No records found.', rowClassName, rowKey, mobileCard,
  loading = false, onRowClick, view = 'list', gridCard,
}) {
  const getKey = (row, i) => (rowKey ? rowKey(row) : (row.id ?? row.vaccineId ?? i))
  const alignCls = (col) => (col.align === 'right' ? 'text-right' : 'text-left')
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key])

  if (view === 'grid' && gridCard) {
    if (loading) {
      return (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-36 rounded-card border border-surface-border bg-surface p-4 sm:p-5 flex flex-col gap-3">
              <div className="h-4 w-1/2 rounded bg-surface-chip animate-pulse motion-reduce:animate-none" />
              <div className="h-3 w-3/4 rounded bg-surface-chip animate-pulse motion-reduce:animate-none" />
              <div className="h-3 w-2/5 rounded bg-surface-chip animate-pulse motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      )
    }
    if (rows.length === 0) {
      return <p className="rounded-card border border-surface-border bg-surface px-6 py-12 text-center text-sm text-text-muted">{emptyMessage}</p>
    }
    return (
      <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((row, i) => (
          <li
            key={getKey(row, i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={[
              'rounded-card border border-surface-border bg-surface p-4 sm:p-5 flex flex-col gap-3 min-w-0',
              onRowClick ? 'cursor-pointer transition-colors hover:border-text-muted' : '',
              rowClassName ? rowClassName(row) : '',
            ].join(' ')}
          >
            {gridCard(row)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="rounded-card border border-surface-border bg-surface overflow-hidden">
      {loading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-text-muted">{emptyMessage}</p>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  {columns.map((col) => (
                    <th key={col.key} scope="col" className={`px-5 py-3 text-xs font-medium text-text-muted whitespace-nowrap ${alignCls(col)}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((row, i) => (
                  <tr
                    key={getKey(row, i)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`transition-colors hover:bg-surface-alt ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`px-5 py-3.5 align-middle text-text ${alignCls(col)} ${col.className ?? ''}`}>
                        {cell(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="sm:hidden divide-y divide-surface-border">
            {rows.map((row, i) => (
              <li
                key={getKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer active:bg-surface-alt' : ''}
              >
                {mobileCard ? mobileCard(row) : (
                  <dl className="px-4 py-3.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    {columns.map((col) => (
                      <div key={col.key} className="contents">
                        <dt className="text-text-muted text-xs self-center">{col.label}</dt>
                        <dd className="text-text text-right min-w-0 break-words">{cell(col, row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
