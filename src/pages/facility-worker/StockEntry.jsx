import { useState } from 'react'
import { Syringe, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVaccines, getDashboard, createStockEntry } from '../../lib/api'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function StockEntry() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ vaccineId: '', quantity: '' })
  const [submitted, setSubmitted] = useState(false)

  const { data: vaccineData } = useQuery({ queryKey: ['vaccines'], queryFn: getVaccines })
  const { data: dashboardData } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const stockByVaccineId = new Map(
    (dashboardData?.facilities ?? []).map((r) => [r.vaccineId, r.quantity])
  )
  const vaccineOptions = (vaccineData?.vaccines ?? []).map((v) => {
    const qty = stockByVaccineId.get(v.id)
    return { value: v.id, label: `${v.name} (${qty ?? 0} left)` }
  })

  const mutation = useMutation({
    mutationFn: () => createStockEntry(form.vaccineId, parseInt(form.quantity, 10)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setSubmitted(true)
    },
  })

  const insufficientAvailable =
    mutation.error?.status === 400 && mutation.error?.body?.available != null
      ? mutation.error.body.available
      : null

  function handleAgain() {
    setForm({ vaccineId: '', quantity: '' })
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="bg-success-bg p-5 rounded-full">
          <CheckCircle2 size={48} className="text-success" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Stock Recorded</h2>
          <p className="text-text-muted mt-1 text-sm">Your entry has been saved successfully.</p>
        </div>
        <Button onClick={handleAgain} variant="secondary">Record Another</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-sm mx-auto pt-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="bg-primary/10 p-3 rounded-xl">
          <Syringe size={26} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold text-text">Stock Entry</h1>
        <p className="text-sm text-text-muted">Record vaccines used at your facility</p>
      </div>

      <div className="bg-surface rounded-xl border border-surface-border p-6">
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="flex flex-col gap-5">
          <Select id="vaccine" label="Vaccine" options={vaccineOptions}
            value={form.vaccineId} onChange={(e) => setForm({ ...form, vaccineId: e.target.value })} required />
          <Input id="qty" label="Quantity (doses)" type="number" inputMode="numeric" min="0"
            placeholder="Enter number of doses"
            value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          {mutation.isError && (
            <p className="text-xs text-danger">
              {insufficientAvailable != null
                ? `Only ${insufficientAvailable} left in stock.`
                : mutation.error?.message}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full mt-1" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </form>
      </div>
    </div>
  )
}
