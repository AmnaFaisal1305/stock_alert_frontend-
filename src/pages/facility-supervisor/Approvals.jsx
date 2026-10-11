import { useState } from 'react'
import { ClipboardCheck, Syringe, CheckCircle2, XCircle, Clock, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboard, getApprovals, createApproval, cancelApproval } from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { displayVaccineName } from '../../lib/vaccineNames'

const TABS = ['Stock Correction', 'Threshold Change']

const STATUS_COLORS = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function Approvals() {
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)

  // ── Stock Correction state ──────────────────────────────────────────────────
  const [corrVaccineId, setCorrVaccineId] = useState('')
  const [corrStoreVials, setCorrStoreVials] = useState('')
  const [corrNote, setCorrNote] = useState('')
  const [corrError, setCorrError] = useState(null)
  const [corrDone, setCorrDone] = useState(false)

  // ── Threshold Change state ──────────────────────────────────────────────────
  const [thrVaccineId, setThrVaccineId] = useState('')
  const [thrValues, setThrValues] = useState({ criticalDoses: '', lowDoses: '', criticalVials: '', lowVials: '' })
  const [thrReset, setThrReset] = useState(false)
  const [thrNote, setThrNote] = useState('')
  const [thrError, setThrError] = useState(null)
  const [thrDone, setThrDone] = useState(false)

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(),
  })
  const vaccines = dashData
    ? [...new Map(dashData.facilities.map(r => [r.vaccineId, r])).values()]
    : []

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => getApprovals('pending'),
  })
  const pending = pendingData?.approvals ?? []

  const corrMutation = useMutation({
    mutationFn: () => createApproval({
      type: 'stock_correction',
      vaccineId: corrVaccineId,
      storeVials: Number(corrStoreVials),
      note: corrNote,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setCorrDone(true)
      setCorrVaccineId(''); setCorrStoreVials(''); setCorrNote(''); setCorrError(null)
    },
    onError: (err) => setCorrError(err.status === 409 ? 'A correction is already pending for this vaccine.' : (err.message || 'Submission failed')),
  })

  const thrMutation = useMutation({
    mutationFn: () => createApproval({
      type: 'threshold_change',
      vaccineId: thrVaccineId,
      thresholds: thrReset ? null : {
        criticalDoses: Number(thrValues.criticalDoses),
        lowDoses:      Number(thrValues.lowDoses),
        criticalVials: Number(thrValues.criticalVials),
        lowVials:      Number(thrValues.lowVials),
      },
      ...(thrNote ? { note: thrNote } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
      setThrDone(true)
      setThrVaccineId(''); setThrValues({ criticalDoses: '', lowDoses: '', criticalVials: '', lowVials: '' }); setThrNote(''); setThrReset(false); setThrError(null)
    },
    onError: (err) => setThrError(err.status === 409 ? 'A threshold change is already pending for this vaccine.' : (err.message || 'Submission failed')),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelApproval(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['audit-log'] })
    },
  })

  function selectVaccine(vid) {
    const row = vaccines.find(r => r.vaccineId === vid)
    if (!row) return
    setThrVaccineId(vid)
    setThrValues({
      criticalDoses: String(row.criticalDoses),
      lowDoses:      String(row.lowDoses),
      criticalVials: String(row.criticalVials),
      lowVials:      String(row.lowVials),
    })
    setThrReset(false)
    setThrDone(false)
    setThrError(null)
  }

  const corrValid = corrVaccineId && corrStoreVials !== '' && Number(corrStoreVials) >= 0 && corrNote.trim().length > 0
  const thrValid  = thrVaccineId && (thrReset || Object.values(thrValues).every(v => v !== ''))

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardCheck size={22} className="text-primary" />
        <div>
          <h1 className="text-xl font-bold text-text">Approvals</h1>
          <p className="text-sm text-text-muted">Propose stock corrections and threshold changes</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-surface-border">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => { setTab(i); setCorrDone(false); setThrDone(false) }}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${tab === i ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Stock Correction ───────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div className="bg-surface rounded-xl border border-surface-border p-5 space-y-5 max-w-lg">
          <p className="text-sm text-text-muted">Set the new <strong>store total</strong> in vials (vials not held by any worker). The Head will approve the adjustment.</p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Vaccine</label>
            <select
              value={corrVaccineId}
              onChange={e => { setCorrVaccineId(e.target.value); setCorrDone(false); setCorrError(null) }}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select vaccine…</option>
              {vaccines.map(r => (
                <option key={r.vaccineId} value={r.vaccineId}>{displayVaccineName(r.vaccineName)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">New store total (vials)</label>
            <Input
              type="number"
              min={0}
              value={corrStoreVials}
              onChange={e => { setCorrStoreVials(e.target.value); setCorrDone(false); setCorrError(null) }}
              placeholder="0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Note <span className="text-danger">*</span></label>
            <textarea
              value={corrNote}
              onChange={e => { setCorrNote(e.target.value); setCorrDone(false); setCorrError(null) }}
              maxLength={500}
              rows={3}
              placeholder="e.g. Physical count on 10 Oct"
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-xs text-text-muted text-right">{corrNote.length}/500</p>
          </div>

          {corrError && <p className="text-sm text-danger">{corrError}</p>}
          {corrDone && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> Correction submitted — awaiting Head approval.</p>}

          <Button
            onClick={() => corrMutation.mutate()}
            disabled={!corrValid || corrMutation.isPending}
            className="w-full"
          >
            {corrMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </div>
      )}

      {/* ── Threshold Change ───────────────────────────────────────────────────── */}
      {tab === 1 && (
        <div className="bg-surface rounded-xl border border-surface-border p-5 space-y-5 max-w-lg">
          <p className="text-sm text-text-muted">Override thresholds for one vaccine at this facility. The Head will approve the change.</p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Vaccine</label>
            <select
              value={thrVaccineId}
              onChange={e => selectVaccine(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select vaccine…</option>
              {vaccines.map(r => (
                <option key={r.vaccineId} value={r.vaccineId}>{displayVaccineName(r.vaccineName)}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
            <input type="checkbox" checked={thrReset} onChange={e => setThrReset(e.target.checked)} className="accent-primary" />
            Reset to vaccine default (remove facility override)
          </label>

          {!thrReset && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ['criticalDoses', 'Critical Doses'],
                ['lowDoses',      'Low Doses'],
                ['criticalVials', 'Critical Vials'],
                ['lowVials',      'Low Vials'],
              ].map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</label>
                  <Input
                    type="number"
                    min={0}
                    value={thrValues[key]}
                    onChange={e => { setThrValues(prev => ({ ...prev, [key]: e.target.value })); setThrDone(false); setThrError(null) }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Note (optional)</label>
            <textarea
              value={thrNote}
              onChange={e => setThrNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {thrError && <p className="text-sm text-danger">{thrError}</p>}
          {thrDone && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> Threshold change submitted — awaiting Head approval.</p>}

          <Button
            onClick={() => thrMutation.mutate()}
            disabled={!thrValid || thrMutation.isPending}
            className="w-full"
          >
            {thrMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </div>
      )}

      {/* ── Pending Approvals ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Pending Approvals</h2>
        {pendingLoading && <p className="text-sm text-text-muted">Loading…</p>}
        {!pendingLoading && pending.length === 0 && (
          <p className="text-sm text-text-muted">No pending approvals.</p>
        )}
        {pending.map(a => (
          <div key={a.id} className="bg-surface rounded-xl border border-surface-border p-4 flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {a.type === 'stock_correction' ? 'Stock Correction' : 'Threshold Change'}
                </span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock size={11} /> Pending
                </span>
              </div>
              <p className="text-sm font-medium text-text truncate">{displayVaccineName(a.vaccineName)}</p>
              {a.type === 'stock_correction' && (
                <p className="text-xs text-text-muted">New store total: <strong>{a.payload?.storeVials} vials</strong></p>
              )}
              {a.type === 'threshold_change' && a.payload?.thresholds && (
                <p className="text-xs text-text-muted">
                  Critical: {a.payload.thresholds.criticalDoses}d / {a.payload.thresholds.criticalVials}v &nbsp;·&nbsp;
                  Low: {a.payload.thresholds.lowDoses}d / {a.payload.thresholds.lowVials}v
                </p>
              )}
              {a.type === 'threshold_change' && !a.payload?.thresholds && (
                <p className="text-xs text-text-muted">Reset to vaccine default</p>
              )}
              {a.note && <p className="text-xs text-text-muted italic">"{a.note}"</p>}
            </div>
            <button
              onClick={() => cancelMutation.mutate(a.id)}
              disabled={cancelMutation.isPending}
              className="flex-shrink-0 text-text-muted hover:text-danger transition-colors p-1 rounded"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
