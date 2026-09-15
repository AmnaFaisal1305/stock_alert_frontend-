export default function Table({ columns, rows, emptyMessage = 'No records found.', rowClassName, rowKey, mobileCard }) {
  const getKey = (row, i) => rowKey ? rowKey(row) : (row.id ?? row.vaccineId ?? i)

  return (
    <div className="rounded-2xl border border-surface-border bg-white shadow-sm overflow-hidden">

      {/* ── Desktop table (sm+) ─────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
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
                <tr
                  key={getKey(row, i)}
                  className={`hover:bg-slate-50/50 transition-colors ${rowClassName ? rowClassName(row) : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4 align-top text-text font-medium">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile view ─────────────────────────────────────────────── */}
      <div className="sm:hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-text-muted font-medium">{emptyMessage}</p>
        ) : mobileCard ? (
          <div className="divide-y divide-surface-border">
            {rows.map((row, i) => (
              <div key={getKey(row, i)}>
                {mobileCard(row)}
              </div>
            ))}
          </div>
        ) : (
          /* Fallback: horizontal-scroll table on mobile when no mobileCard provided */
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-surface-border bg-slate-50/75">
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((row, i) => (
                  <tr key={getKey(row, i)} className={`hover:bg-slate-50/50 transition-colors ${rowClassName ? rowClassName(row) : ''}`}>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 align-top text-text font-medium">
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
