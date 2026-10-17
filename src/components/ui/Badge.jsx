const styles = {
  active:   'bg-success-bg text-success-dark',
  inactive: 'bg-surface-chip text-text-muted',
}

const labels = {
  active:   'Active',
  inactive: 'Inactive',
}

export default function Badge({ type }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] ?? 'bg-surface-chip text-text-muted'}`}>
      {labels[type] ?? type}
    </span>
  )
}
