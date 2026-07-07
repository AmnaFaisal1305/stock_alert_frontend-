const styles = {
  active:   'bg-success/10 text-success',
  inactive: 'bg-surface-alt text-text-muted',
}

const labels = {
  active:   'Active',
  inactive: 'Inactive',
}

export default function Badge({ type }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] ?? 'bg-surface-alt text-text-muted'}`}>
      {labels[type] ?? type}
    </span>
  )
}
