import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboard, updateThreshold } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Table from '../../components/shared/Table'
import StatusBadge from '../../components/shared/StatusBadge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function ThresholdManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [minQty, setMinQty] = useState('')
  const [formError, setFormError] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  const mutation = useMutation({
    mutationFn: () => updateThreshold(editing.thresholdId, parseInt(minQty, 10)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setEditing(null)
      setFormError('')
    },
    onError: (err) => setFormError(err.message),
  })

  const rows = (data?.facilities ?? []).filter((r) => r.facilityId === user.facilityId)

  const columns = [
    { key: 'vaccineName',  label: 'Vaccine'         },
    { key: 'quantity',     label: 'Current (doses)', render: (row) => row.quantity ?? '—' },
    { key: 'minQuantity',  label: 'Min Threshold'   },
    { key: 'status',       label: 'Status',          render: (row) => <StatusBadge status={row.status === 'no_data' ? 'amber' : row.status} /> },
    {
      key: 'edit',
      label: '',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => { setEditing(row); setMinQty(String(row.minQuantity)); setFormError('') }}>
          <Pencil size={13} /> Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">Threshold Management</h1>
        <p className="text-sm text-text-muted mt-0.5">Set minimum stock levels for each vaccine</p>
      </div>

      {isLoading && <p className="text-text-muted">Loading…</p>}
      {isError   && <p className="text-danger">Failed to load data.</p>}
      {!isLoading && !isError && <Table columns={columns} rows={rows} />}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit Threshold — ${editing?.vaccineName ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
          <Input id="min-qty" label="Minimum Quantity (doses)" type="number" min="0"
            value={minQty} onChange={(e) => { setMinQty(e.target.value); setFormError('') }} required />
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
