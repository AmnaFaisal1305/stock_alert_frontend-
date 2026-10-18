import { Fragment } from 'react'
import { ChevronDown } from 'lucide-react'
import { SkeletonRows } from './SkeletonCard'

// columns: [{ key, label, render?, align?: 'right' | 'left', className? }]
// Below sm, rows render as `mobileCard(row)` if given, otherwise as label/value stacks.
// view="grid" with gridCard(row) renders a responsive card grid instead (entity lists).
// groups: [{ label, summary, rows }] — renders day-group headers between tbody sections.
// expandedRow(row) + isExpanded(row) — adds an expand chevron; caller toggles via onRowClick.
export default function Table({
  columns, rows, emptyMessage = 'No records found.', rowClassName, rowKey, mobileCard,
  loading = false, onRowClick, view = 'list', gridCard,
  groups, expandedRow, isExpanded,
}) {
  const getKey = (row, i) => (rowKey ? rowKey(row) : (row.id ?? row.vaccineId ?? i))
  const alignCls = (col) => (col.align === 'right' ? 'text-right' : 'text-left')
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key])
  const colSpan = columns.length + (expandedRow ? 1 : 0)

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

  // Shared row renderer used by both flat and grouped desktop tables.
  function DesktopRow({ row, i }) {
    const key = getKey(row, i)
    const expanded = isExpanded?.(row)
    return (
      <Fragment key={key}>
        <tr
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          className={`transition-colors hover:bg-surface-alt ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`}
        >
          {columns.map((col) => (
            <td key={col.key} className={`px-5 py-3.5 align-middle text-text ${alignCls(col)} ${col.className ?? ''}`}>
              {cell(col, row)}
            </td>
          ))}
          {expandedRow && (
            <td className="px-3 py-3.5 align-middle text-text-muted w-8">
              <ChevronDown size={14} strokeWidth={2} className={`transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
            </td>
          )}
        </tr>
        {expanded && expandedRow && (
          <tr>
            <td colSpan={colSpan} className="px-5 py-4 bg-surface-alt border-b border-surface-border text-sm">
              {expandedRow(row)}
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  return (
    <div className="rounded-card border border-surface-border bg-surface overflow-hidden">
      {loading ? (
        <SkeletonRows rows={5} />
      ) : (groups ? groups.every((g) => !g.rows.length) : rows.length === 0) ? (
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
                  {expandedRow && <th className="w-8" />}
                </tr>
              </thead>
              {groups ? (
                groups.map((group) => (
                  <tbody key={group.label} className="divide-y divide-surface-border">
                    <tr className="bg-surface-alt sticky top-0 z-10">
                      <td colSpan={colSpan} className="px-5 py-2 text-xs font-semibold text-text-muted border-b border-surface-border">
                        {group.label}
                        {group.summary && <span className="font-normal ml-2">· {group.summary}</span>}
                      </td>
                    </tr>
                    {group.rows.map((row, i) => <DesktopRow key={getKey(row, i)} row={row} i={i} />)}
                  </tbody>
                ))
              ) : (
                <tbody className="divide-y divide-surface-border">
                  {rows.map((row, i) => <DesktopRow key={getKey(row, i)} row={row} i={i} />)}
                </tbody>
              )}
            </table>
          </div>

          <ul className="sm:hidden divide-y divide-surface-border">
            {(groups ? groups.flatMap((g) => g.rows) : rows).map((row, i) => (
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
