import { useState } from 'react'
import { Pencil, Plus, Tag } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboard, updateThreshold, createVaccine, updateVaccine } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Table from '../../components/shared/Table'
import StatusBadge from '../../components/shared/StatusBadge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

function duplicateNameMessage(err) {
  return err.status === 409 ? 'A vaccine with that name already exists at your facility.' : err.message
}

export default function ThresholdManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(null)
  const [minQty, setMinQty] = useState('')
  const [formError, setFormError] = useState('')

  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [newVaccine, setNewVaccine] = useState({ name: '', minQuantity: '' })
  const [addError, setAddError] = useState('')

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

  const renameMutation = useMutation({
    mutationFn: () => updateVaccine(renaming.vaccineId, renameValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setRenaming(null)
      setRenameError('')
    },
    onError: (err) => setRenameError(duplicateNameMessage(err)),
  })

  const createVaccineMutation = useMutation({
    mutationFn: () =>
      createVaccine({
        name: newVaccine.name,
        ...(newVaccine.minQuantity ? { minQuantity: parseInt(newVaccine.minQuantity, 10) } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setAddOpen(false)
      setNewVaccine({ name: '', minQuantity: '' })
      setAddError('')
    },
    onError: (err) => setAddError(duplicateNameMessage(err)),
  })

  const rows = (data?.facilities ?? []).filter((r) => r.facilityId === user.facilityId)

  const columns = [
    { key: 'vaccineName',  label: 'Vaccine'         },
    { key: 'quantity',     label: 'Current (doses)', render: (row) => row.quantity ?? '—' },
    { key: 'minQuantity',  label: 'Min Threshold'   },
    { key: 'status',       label: 'Status',          render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setRenaming(row); setRenameValue(row.vaccineName); setRenameError('') }}>
            <Tag size={13} /> Rename
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(row); setMinQty(String(row.minQuantity)); setFormError('') }}>
            <Pencil size={13} /> Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Vaccines &amp; Thresholds</h1>
          <p className="text-sm text-text-muted mt-0.5">Manage your facility's vaccines and minimum stock levels</p>
        </div>
        <Button onClick={() => { setAddOpen(true); setAddError('') }}>
          <Plus size={16} /> Add Vaccine
        </Button>
      </div>

      {isLoading && <p className="text-text-muted">Loading…</p>}
      {isError   && <p className="text-danger">Failed to load data.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={rows} emptyMessage="No vaccines added yet — add your first vaccine to start tracking thresholds." />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit Threshold — ${editing?.vaccineName ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
          <Input id="min-qty" label="Minimum Quantity (doses)" type="number" min="0" step="1"
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

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename Vaccine — ${renaming?.vaccineName ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); renameMutation.mutate() }}>
          <Input id="rename-vaccine" label="Vaccine Name"
            value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }} required />
          {renameError && <p className="text-xs text-danger">{renameError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>
              {renameMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Vaccine">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); createVaccineMutation.mutate() }}>
          <Input id="new-vaccine-name" label="Vaccine Name"
            value={newVaccine.name} onChange={(e) => { setNewVaccine({ ...newVaccine, name: e.target.value }); setAddError('') }} required />
          <Input id="new-vaccine-min" label="Minimum Quantity (doses, optional)" type="number" min="0" step="1" placeholder="Defaults to 0"
            value={newVaccine.minQuantity} onChange={(e) => setNewVaccine({ ...newVaccine, minQuantity: e.target.value })} />
          {addError && <p className="text-xs text-danger">{addError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createVaccineMutation.isPending}>
              {createVaccineMutation.isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
