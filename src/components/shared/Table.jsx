export default function Table({ columns, rows, emptyMessage = 'No records found.', rowClassName, rowKey }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-border bg-white shadow-sm">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-surface-border bg-slate-50/75">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-text-muted font-medium">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey ? rowKey(row) : (row.id ?? row.vaccineId ?? i)} className={`hover:bg-slate-50/50 transition-colors ${rowClassName ? rowClassName(row) : ''}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 whitespace-nowrap text-text font-medium">
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
