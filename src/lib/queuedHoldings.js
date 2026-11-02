// Server holdings plus the entries still waiting to be sent, so an offline Day End sees the
// vials an offline Assign handed out. Rows are per worker × vaccine × batch (Round 47).
// No imports, so scripts/check-offline-holdings.mjs can run it under node.
const keyOf = (workerId, vaccineId, batchId) => `${workerId ?? 'store'}:${vaccineId}:${batchId ?? 'none'}`

export function applyQueued(holdings, entries, facilityId) {
  const rows = new Map(holdings.map((h) => [keyOf(h.workerId, h.vaccineId, h.batchId), { ...h }]))
  const row = (workerId, vaccineId, batchId) => {
    const key = keyOf(workerId, vaccineId, batchId)
    if (!rows.has(key)) rows.set(key, { facilityId, workerId, vaccineId, batchId: batchId ?? null, assigned: 0, used: 0, returned: 0, wasted: 0, remaining: 0 })
    return rows.get(key)
  }
  // Only adjust a store row the server sent; never invent one (holdings may list workers only).
  const store = (vaccineId, batchId) => rows.get(keyOf(null, vaccineId, batchId)) ?? { remaining: 0 }
  for (const { kind, payload } of entries) {
    for (const it of payload.items ?? []) {
      const worker = row(payload.workerId, it.vaccineId, it.batchId)
      if (kind === 'assign') {
        store(it.vaccineId, it.batchId).remaining -= it.vials
        worker.assigned += it.vials
        worker.remaining += it.vials
      } else {
        const used = it.usedVials ?? 0, returned = it.returnedVials ?? 0, wasted = it.wastedVials ?? 0
        worker.used += used; worker.returned += returned; worker.wasted += wasted
        worker.remaining -= used + returned + wasted
        store(it.vaccineId, it.batchId).remaining += returned
      }
    }
  }
  return [...rows.values()]
}
