import { useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, createStockEntry } from '../../lib/api'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Toast from '../../components/ui/Toast'

export default function RecordStock() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ vaccineId: '', quantity: '' })
  const [toast, setToast] = useState(null)

  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const vaccineOptions = (vaccineData?.vaccines ?? []).map((v) => ({ value: v.id, label: v.name }))

  const mutation = useMutation({
    mutationFn: () => createStockEntry(form.vaccineId, parseInt(form.quantity, 10)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setToast({ message: 'Stock recorded successfully.', type: 'success' })
      setForm({ vaccineId: '', quantity: '' })
    },
    onError: (err) => setToast({ message: err.message, type: 'error' }),
  })

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <h1 className="text-xl font-bold text-text">Record Received Stock</h1>
        <p className="text-sm text-text-muted mt-0.5">Log vaccines received at this facility</p>
      </div>

      <div className="bg-surface rounded-xl border border-surface-border p-6">
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="flex flex-col gap-5">
          <Select id="vaccine" label="Vaccine" options={vaccineOptions}
            value={form.vaccineId} onChange={(e) => setForm({ ...form, vaccineId: e.target.value })} required />
          <Input id="quantity" label="Quantity (doses)" type="number" min="0" placeholder="e.g. 100"
            value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
            <PackageCheck size={16} />
            {mutation.isPending ? 'Saving…' : 'Record Stock'}
          </Button>
        </form>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
