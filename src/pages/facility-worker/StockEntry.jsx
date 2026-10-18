import { useMemo } from 'react'
import { Syringe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getHoldings } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/shared/PageHeader'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import ErrorState from '../../components/shared/ErrorState'
import { SkeletonRows } from '../../components/shared/SkeletonCard'

function HoldingRow({ r }) {
  const done = r.remaining === 0
  return (
    <li className="px-4 sm:px-5 py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <p className={`text-base font-medium min-w-0 truncate ${done ? 'text-text-muted' : 'text-text'}`} dir="auto">
          {r.vaccineName}
        </p>
        <p className={`tabular-nums flex-shrink-0 ${done ? 'text-text-muted text-sm' : 'text-text text-xl font-light'}`}>
          {r.remaining}<span className="text-xs text-text-muted ml-1">{r.remaining === 1 ? 'vial' : 'vials'}</span>
        </p>
      </div>
      <p className="text-xs text-text-muted mt-1 tabular-nums">
        {r.assigned} assigned · {r.used} used · {r.returned} returned · {r.wasted} wasted
      </p>
    </li>
  )
}

export default function StockEntry() {
  const { user } = useAuth()

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['holdings'],
    queryFn:  getHoldings,
    refetchInterval: 30_000,
  })

  const { inHand, usedUp, totalRemaining } = useMemo(() => {
    const rows = (data?.holdings ?? []).filter((r) => r.workerId === user?.id)
    const inHand = rows.filter((r) => r.remaining > 0).sort((a, b) => b.remaining - a.remaining)
    return {
      inHand,
      usedUp: rows.filter((r) => r.remaining === 0),
      totalRemaining: inHand.reduce((sum, r) => sum + r.remaining, 0),
    }
  }, [data, user?.id])

  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
  const hasRows = inHand.length + usedUp.length > 0

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="My Holdings"
        subtitle={updated ? `Vials assigned to you today · updated ${updated}` : 'Vials assigned to you today'}
      />

      {isError ? (
        <ErrorState title="Couldn’t load your holdings" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card padding={false}><SkeletonRows rows={4} /></Card>
      ) : !hasRows ? (
        <EmptyState
          framed
          icon={Syringe}
          title="No vials assigned yet"
          message="Your supervisor assigns vials each morning. They’ll appear here as soon as they do."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="flex items-baseline gap-3">
            <p className="text-[32px] font-light leading-none tabular-nums text-text">{totalRemaining}</p>
            <p className="text-sm text-text-muted">
              {totalRemaining === 1 ? 'vial' : 'vials'} in hand
              {inHand.length > 0 && <> across {inHand.length} {inHand.length === 1 ? 'vaccine' : 'vaccines'}</>}
            </p>
          </Card>

          {inHand.length > 0 && (
            <Card padding={false}>
              <ul className="divide-y divide-surface-border">
                {inHand.map((r) => <HoldingRow key={r.vaccineId} r={r} />)}
              </ul>
            </Card>
          )}

          {usedUp.length > 0 && (
            <section aria-labelledby="used-up">
              <h2 id="used-up" className="text-sm font-medium text-text-muted mb-2 px-1">Used up</h2>
              <Card padding={false}>
                <ul className="divide-y divide-surface-border">
                  {usedUp.map((r) => <HoldingRow key={r.vaccineId} r={r} />)}
                </ul>
              </Card>
            </section>
          )}

          <p className="text-xs text-text-muted text-center">Counts are in vials and refresh every 30 seconds.</p>
        </div>
      )}
    </div>
  )
}
