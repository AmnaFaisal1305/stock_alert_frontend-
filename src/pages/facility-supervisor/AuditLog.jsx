import AuditLog from '../super-admin/AuditLog'

// Reuses the same AuditLog component — backend scopes rows to actions by
// this supervisor's own facility_workers only (never the supervisor's own actions)
export default function FacilitySupervisorAuditLog() {
  return <AuditLog title="Worker Activity Log" subtitle="Actions recorded by your facility workers" />
}
