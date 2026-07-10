import { gaugeHex } from '../../lib/status'

export default function RingGauge({ pct, status, size = 72 }) {
  const r    = (size / 2) - 8
  const circ = 2 * Math.PI * r
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${pct}% of minimum threshold`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={gaugeHex(status)} strokeWidth={6}
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-text">{pct}%</span>
    </div>
  )
}
