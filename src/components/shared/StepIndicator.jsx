import { CheckCircle2 } from 'lucide-react'

export default function StepIndicator({ step, labels }) {
  const total = labels.length
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-200 ${
              i + 1 < step   ? 'bg-primary text-white shadow-sm shadow-primary/20' :
              i + 1 === step ? 'bg-primary text-white ring-4 ring-primary/10 shadow-sm shadow-primary/20' :
                               'bg-slate-50 text-text-muted border border-surface-border'
            }`}>
              {i + 1 < step ? <CheckCircle2 size={15} strokeWidth={2.2} /> : i + 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
              i + 1 === step ? 'text-primary' : 'text-text-muted/70'
            }`}>
              {label}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`w-10 h-0.5 mb-5 mx-2 transition-colors duration-300 ${i + 1 < step ? 'bg-primary' : 'bg-surface-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
