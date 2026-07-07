import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDistricts, createDistrict } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const columns = [
  { key: 'name',      label: 'District Name' },
  { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
]

export default function DistrictManagement() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
  })

  const mutation = useMutation({
    mutationFn: () => createDistrict(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      setOpen(false)
      setName('')
      setFormError('')
    },
    onError: (err) => setFormError(err.message),
  })

  const districts = data?.districts ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">District Management</h1>
          <p className="text-sm text-text-muted mt-0.5">{districts.length} districts</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Add District
        </Button>
      </div>

      {isLoading && <p className="text-text-muted">Loading…</p>}
      {isError   && <p className="text-danger">Failed to load districts.</p>}
      {!isLoading && !isError && (
        <Table columns={columns} rows={districts} emptyMessage="No districts yet — add your first district to get started." />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create District">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
        >
          <Input
            id="district-name"
            label="District Name"
            placeholder="e.g. South District"
            value={name}
            onChange={(e) => { setName(e.target.value); setFormError('') }}
            required
          />
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
