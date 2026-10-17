import { SkeletonRows } from './SkeletonCard'

// columns: [{ key, label, render?, align?: 'right' | 'left', className? }]
// Below sm, rows render as `mobileCard(row)` if given, otherwise as label/value stacks.
export default function Table({
  columns, rows, emptyMessage = 'No records found.', rowClassName, rowKey, mobileCard,
  loading = false, onRowClick,
}) {
  const getKey = (row, i) => (rowKey ? rowKey(row) : (row.id ?? row.vaccineId ?? i))
  const alignCls = (col) => (col.align === 'right' ? 'text-right' : 'text-left')
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key])

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
