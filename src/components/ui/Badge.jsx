const styles = {
  super_admin:         'bg-purple-100 text-purple-800',
  district_supervisor: 'bg-blue-100 text-blue-800',
  facility_supervisor: 'bg-primary/10 text-primary-dark',
  facility_worker:     'bg-surface-alt text-secondary',
  active:              'bg-success-bg text-success-dark',
  inactive:            'bg-danger-bg text-danger-dark',
}

const labels = {
  super_admin:         'Super Admin',
  district_supervisor: 'District Supervisor',
  facility_supervisor: 'Facility Supervisor',
  facility_worker:     'Facility Worker',
  active:              'Active',
  inactive:            'Inactive',
}

export default function Badge({ type }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] ?? 'bg-surface-alt text-secondary'}`}>
      {labels[type] ?? type}
    </span>
  )
}
