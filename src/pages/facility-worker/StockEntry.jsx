import { Syringe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getHoldings } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import SkeletonCard from '../../components/shared/SkeletonCard'
import { displayVaccineName } from '../../lib/vaccineNames'

export default function StockEntry() {
  const { user } = useAuth()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['holdings'],
    queryFn:  getHoldings,
    refetchInterval: 30_000,
  })

  const rows = (data?.holdings ?? []).filter((r) => r.workerId === user?.id)

  if (isLoading) return (
    <div className="max-w-3xl mx-auto pt-6 px-1 flex flex-col gap-4">
      {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )

  if (isError) return (
    <div className="max-w-3xl mx-auto pt-6 px-4 text-sm text-danger font-medium">
      Failed to load holdings. Please refresh.
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto pt-6 px-1 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">My Holdings</h1>
        <p className="text-sm text-text-muted mt-0.5">Vials currently assigned to you by your supervisor</p>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-slate-200 bg-white rounded-2xl text-text-muted px-4">
          <Syringe size={28} className="mx-auto mb-3 text-text-muted/30" />
          <p className="font-bold text-sm">No vials assigned yet</p>
          <p className="text-xs mt-1 text-text-muted/70">Your supervisor will assign vials to you each morning.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-alt">
                  <th className="px-5 py-3 text-left text-xs font-bold text-text-muted uppercase tracking-wider">Vaccine</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-text-muted uppercase tracking-wider">Assigned</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-text-muted uppercase tracking-wider">Used</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-text-muted uppercase tracking-wider">Returned</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-text-muted uppercase tracking-wider">Wasted</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-text-muted uppercase tracking-wider">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r) => (
                  <tr key={r.vaccineId} className="hover:bg-surface-alt/50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-text" dir="rtl">{displayVaccineName(r.vaccineName)}</td>
                    <td className="px-4 py-3.5 text-right text-text-muted">{r.assigned}</td>
                    <td className="px-4 py-3.5 text-right text-text-muted">{r.used}</td>
                    <td className="px-4 py-3.5 text-right text-text-muted">{r.returned}</td>
                    <td className="px-4 py-3.5 text-right text-text-muted">{r.wasted}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-bold ${r.remaining === 0 ? 'text-text-muted' : 'text-text'}`}>
                        {r.remaining}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-surface-border">
            {rows.map((r) => (
              <div key={r.vaccineId} className="px-4 py-4 flex flex-col gap-3">
                <p className="font-bold text-sm text-text" dir="rtl">{displayVaccineName(r.vaccineName)}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {[
                    ['Assigned', r.assigned],
                    ['Used',     r.used],
                    ['Returned', r.returned],
                    ['Wasted',   r.wasted],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-text-muted">{label}</span>
                      <span className="font-medium text-text">{val}</span>
                    </div>
                  ))}
                  <div className="col-span-2 flex justify-between border-t border-surface-border pt-1.5 mt-0.5">
                    <span className="font-bold text-text-muted">Remaining</span>
                    <span className={`font-bold ${r.remaining === 0 ? 'text-text-muted' : 'text-text'}`}>{r.remaining} vials</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-text-muted/60 text-center pb-2">
        All counts are in vials · Refreshes every 30 seconds
      </p>
    </div>
  )
}
