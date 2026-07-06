import AuditLog from '../super-admin/AuditLog'

// Reuses the same AuditLog component — data is already scoped to the district by the backend
export default function DistrictAuditLog() {
  return <AuditLog />
}
