import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, UserX, UserCheck, ArrowRight } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFacilities, createFacility, updateFacility, deleteFacility, activateFacility } from '../../lib/api'
import Table from '../../components/shared/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Toast from '../../components/ui/Toast'

export default function FacilityManagement() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '' })
  const [formError, setFormError] = useState('')

  const [renaming, setRenaming]       = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')

  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateError, setDeactivateError]   = useState('')

  const [toast, setToast] = useState(null)

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

  const renameMutation = useMutation({
    mutationFn: () => updateFacility(renaming.id, renameValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      setRenaming(null)
      setRenameError('')
      setToast({ message: 'Facility renamed.', type: 'success' })
    },
    onError: (err) => setRenameError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deleteFacility(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      setToast({ message: `${deactivateTarget?.name} deactivated.`, type: 'success' })
      setDeactivateTarget(null)
      setDeactivateError('')
    },
    onError: (err) => setDeactivateError(err.message),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => activateFacility(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      const target = facilities.find((f) => f.id === id)
      setToast({ message: `${target?.name ?? 'Facility'} activated.`, type: 'success' })
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  const facilities = data?.facilities ?? []

  function openRename(row) { setRenaming(row); setRenameValue(row.name); setRenameError('') }
  function openDeactivate(row) { setDeactivateTarget(row); setDeactivateError('') }

  const columns = [
    {
      key: 'name', label: 'Facility Name', render: (row) => (
        <Link to={`/district/facilities/${row.id}`} className="font-medium text-text hover:text-primary hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: 'createdAt', label: 'Added', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    {
      key: 'supervisor', label: 'Supervisor', render: (row) => (
        row.facilitySupervisorName
          ? <span className="text-text">{row.facilitySupervisorName}</span>
          : <span className="text-text-muted italic">Unstaffed</span>
      ),
    },
    {
      key: 'isActive', label: 'Status', render: (row) => (
        <Badge type={row.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions', label: '', render: (row) => (
        <div className="flex gap-2">
          <Link
            to={`/district/facilities/${row.id}`}
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

      {/* Create modal */}
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

      {/* Rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={`Rename — ${renaming?.name ?? ''}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); renameMutation.mutate() }}>
          <Input id="rename-facility" label="Facility Name"
            value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError('') }} required />
          {renameError && <p className="text-xs text-danger">{renameError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={renameMutation.isPending}>{renameMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate confirmation */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Deactivate facility" maxWidth="max-w-sm">
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
