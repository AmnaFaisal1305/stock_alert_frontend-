import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFacilities, createFacility } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const columns = [
  { key: 'name',      label: 'Facility Name' },
  { key: 'createdAt', label: 'Added', render: (row) => new Date(row.createdAt).toLocaleDateString() },
]

export default function FacilityManagement() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '' })
  const [formError, setFormError] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['facilities'],
    queryFn: getFacilities,
  })

  const mutation = useMutation({
    mutationFn: () => createFacility({ name: form.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      setOpen(false)
      setForm({ name: '' })
      setFormError('')
    },
    onError: (err) => setFormError(err.message),
  })

  const facilities = data?.facilities ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Facility Management</h1>
          <p className="text-sm text-text-muted mt-0.5">{facilities.length} facilities in your district</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Add Facility
        </Button>
      </div>

      {isLoading && <p className="text-text-muted">Loading…</p>}
      {isError   && <p className="text-danger">Failed to load facilities.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={facilities} emptyMessage="No facilities yet — add your first facility to get started." />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create Facility">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
          <Input id="fac-name" label="Facility Name" placeholder="e.g. South Health Clinic"
            value={form.name} onChange={(e) => { setForm({ name: e.target.value }); setFormError('') }} required />
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
