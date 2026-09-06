import { Link } from 'react-router-dom'
import { Bell, AlertCircle, X, Syringe } from 'lucide-react'

function facilityPath(role, facilityId) {
  if (role === 'super_admin')         return `/super-admin/facilities/${facilityId}`
  if (role === 'district_supervisor') return `/district/facilities/${facilityId}`
  if (role === 'facility_supervisor') return '/facility/thresholds'
  return '/worker/status'
}

export default function NotificationPanel({ alerts, role, onClose }) {
  if (alerts.length === 0) {
    return (
      <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl border border-surface-border shadow-2xl z-50 px-5 py-6 flex flex-col items-center gap-2 text-center animate-in fade-in duration-150">
        <Bell size={28} className="text-text-muted/30" />
        <p className="text-sm font-semibold text-text">No critical alerts</p>
        <p className="text-xs text-text-muted">All vaccines are within healthy or low stock levels.</p>
      </div>
    )
  }

  return (
    <div className="absolute right-0 top-12 w-[340px] bg-white rounded-2xl border border-surface-border shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-danger-bg">
        <div className="flex items-center gap-2">
          <AlertCircle size={15} className="text-danger" />
          <p className="text-xs font-bold text-danger uppercase tracking-wider">
            Critical Alerts — {alerts.length} vaccine{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onClose} className="text-danger/60 hover:text-danger transition-colors p-0.5 rounded" aria-label="Close alerts">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-[360px] overflow-y-auto divide-y divide-surface-border">
        {alerts.map((a, i) => (
          <Link
            key={i}
            to={facilityPath(role, a.facilityId)}
            onClick={onClose}
            className="block px-4 py-3 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0 mt-0.5">
                <span className="absolute inline-flex h-2 w-2 rounded-full bg-danger/40 animate-ping" />
                <Syringe size={14} className="relative text-danger" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text truncate">{a.vaccineName}</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  <span className="font-semibold text-text-muted/80">Facility:</span> {a.facilityName}
                </p>
                {a.districtName && (
                  <p className="text-[11px] text-text-muted">
                    <span className="font-semibold text-text-muted/80">District:</span> {a.districtName}
                  </p>
                )}
                <p className="text-[11px] font-semibold text-danger mt-1">
                  {a.quantity != null ? `${a.quantity} doses remaining` : 'No stock recorded'}
                </p>
              </div>
              <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-bg text-danger border border-danger/20">
                Critical
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
