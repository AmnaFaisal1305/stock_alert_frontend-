export default function Table({ columns, rows, emptyMessage = 'No records found.', rowClassName }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-surface-border bg-surface-alt">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className={`hover:bg-surface-alt transition-colors ${rowClassName ? rowClassName(row) : ''}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
