import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStockRequests, approveStockRequest } from '../../lib/api'
import Button from '../../components/ui/Button'
import Textarea from '../../components/ui/Textarea'
import PageHeader from '../../components/shared/PageHeader'
import RequestList from '../../components/stock-requests/RequestList'
import { displayVaccineName } from '../../lib/vaccineNames'

// Facility head: final sign-off once sent and received figures agree.
function ApproveAction({ req }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [mismatches, setMismatches] = useState(null)
  const [error, setError] = useState('')

  const approveMutation = useMutation({
    mutationFn: () => approveStockRequest(req.id, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requests'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setMismatches(null)
    },
    onError: (err) => {
      if (err.status === 409 && err.body?.mismatches) setMismatches(err.body.mismatches)
      else setError(err.message || 'Failed to approve. Please try again.')
    },
  })

  if (req.stage !== 'ready_for_approval') return null

  const short = (req.items ?? []).some((it) => (it.receivedVials ?? 0) < (it.outstandingVials ?? it.requestedVials))

  return (
    <div className="flex flex-col gap-3">
      {mismatches && (
        <div role="alert" className="rounded-control bg-danger-bg px-3.5 py-2.5 text-sm text-danger-dark">
          <p className="font-medium">Sent and received figures differ, so this can’t be approved yet.</p>
          <ul className="mt-1 tabular-nums">
            {mismatches.map((m) => (
              <li key={m.vaccineId}>{displayVaccineName(m.vaccineName)}: sent {m.sentVials}, received {m.receivedVials}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger-dark">{error}</p>}
      {short && (
        <Textarea
          id={`short-${req.id}`}
          label="Shortfall note"
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Fewer vials arrived than requested. Explain why before approving."
        />
      )}
      <div>
        <Button onClick={() => { setError(''); approveMutation.mutate() }} disabled={approveMutation.isPending || (short && !note.trim())}>
          {approveMutation.isPending ? 'Approving…' : short ? 'Approve with shortfall' : 'Approve request'}
        </Button>
      </div>
    </div>
  )
}

export default function FacilityHeadStockRequests() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stock-requests'],
    queryFn:  () => getStockRequests(),
    refetchInterval: 30_000,
  })

  const requests = data?.stockRequests ?? []
  const ready = requests.filter((r) => r.stage === 'ready_for_approval').length

  return (
    <div>
      <PageHeader
        breadcrumb="Facility Head › Daily work"
        title="Stock Requests"
        subtitle={ready ? `${ready} ready for your approval` : 'Approve deliveries once sent and received figures agree'}
      />
      <RequestList
        requests={requests}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        emptyHint="Requests your supervisor raises appear here."
        renderActions={(req) => <ApproveAction req={req} />}
      />
    </div>
  )
}
