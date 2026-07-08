import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, UserX, UserCheck, ArrowRight } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDistricts, createDistrict, updateDistrict, deleteDistrict, activateDistrict } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'

export default function DistrictManagement() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState('')

  const [renaming, setRenaming]       = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')

  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateError, setDeactivateError]   = useState('')

  const [toast, setToast] = useState(null)

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

  const renameMutation = useMutation({
    mutationFn: () => updateDistrict(renaming.id, renameValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      setRenaming(null)
      setRenameError('')
      setToast({ message: 'District renamed.', type: 'success' })
    },
    onError: (err) => setRenameError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deleteDistrict(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      setToast({ message: `${deactivateTarget?.name} deactivated.`, type: 'success' })
      setDeactivateTarget(null)
      setDeactivateError('')
    },
    onError: (err) => setDeactivateError(err.message),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateDistrict(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['districts'] })
      const target = districts.find((d) => d.id === id)
      setToast({ message: `${target?.name ?? 'District'} activated.`, type: 'success' })
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  const districts = data?.districts ?? []

  function openRename(row) { setRenaming(row); setRenameValue(row.name); setRenameError('') }
  function openDeactivate(row) { setDeactivateTarget(row); setDeactivateError('') }

  const columns = [
    {
      key: 'name', label: 'District Name', render: (row) => (
        <Link to={`/super-admin/districts/${row.id}`} className="font-medium text-text hover:text-primary hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    {
      key: 'isActive', label: 'Status', render: (row) => (
        <Badge type={row.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions', label: '', render: (row) => (
        <div className="flex gap-2">
          <Link
            to={`/super-admin/districts/${row.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1.5"
          >
            View <ArrowRight size={12} />
          </Link>
          <Button variant="ghost" size="sm" onClick={() => openRename(row)}>
            <Pencil size={13} /> Rename
          </Button>
          {row.isActive ? (
            <Button variant="ghost" size="sm" onClick={() => openDeactivate(row)}>
              <UserX size={13} /> Deactivate
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => activateMutation.mutate(row.id)} disabled={activateMutation.isPending}>
              <UserCheck size={13} /> Activate
            </Button>
          )}
        </div>
      ),
    },
  ]

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

      {/* Create modal */}
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

      {/* Rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename — ${renaming?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); renameMutation.mutate() }}>
          <Input id="rename-district" label="District Name"
            value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }} required />
          {renameError && <p className="text-xs text-danger">{renameError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>{renameMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate confirmation */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Deactivate district" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            Deactivate <span className="font-medium">{deactivateTarget?.name}</span>? You can reactivate it later.
          </p>
          {deactivateError && <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{deactivateError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deactivateMutation.mutate(deactivateTarget.id)} disabled={deactivateMutation.isPending}>
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
