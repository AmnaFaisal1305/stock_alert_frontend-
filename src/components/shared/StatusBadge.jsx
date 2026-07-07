const config = {
  green:   { dot: 'bg-success',   text: 'text-success-dark', bg: 'bg-success-bg',  label: 'OK'       },
  amber:   { dot: 'bg-warning',   text: 'text-warning-dark', bg: 'bg-warning-bg',  label: 'Low'      },
  red:     { dot: 'bg-danger',    text: 'text-danger-dark',  bg: 'bg-danger-bg',   label: 'Critical' },
  no_data: { dot: 'bg-secondary', text: 'text-text-muted',   bg: 'bg-surface-alt', label: 'No data'  },
}

export default function StatusBadge({ status }) {
  const c = config[status] ?? config.no_data
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
