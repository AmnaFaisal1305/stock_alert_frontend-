// Server holdings plus the entries still waiting to be sent, so an offline Day End sees the
// vials an offline Assign handed out. No imports, so scripts/check-offline-holdings.mjs can run it under node.
export function applyQueued(holdings, entries, facilityId) {
  const rows = new Map(holdings.map((h) => [`${h.workerId ?? 'store'}:${h.vaccineId}`, { ...h }]))
  const row = (workerId, vaccineId) => {
    const key = `${workerId ?? 'store'}:${vaccineId}`
    if (!rows.has(key)) rows.set(key, { facilityId, workerId, vaccineId, assigned: 0, used: 0, returned: 0, wasted: 0, remaining: 0 })
    return rows.get(key)
  }
  // Only adjust a store row the server sent; never invent one (holdings may list workers only).
  const store = (vaccineId) => rows.get(`store:${vaccineId}`) ?? { remaining: 0 }
  for (const { kind, payload } of entries) {
    for (const it of payload.items ?? []) {
      const worker = row(payload.workerId, it.vaccineId)
      if (kind === 'assign') {
        store(it.vaccineId).remaining -= it.vials
        worker.assigned += it.vials
        worker.remaining += it.vials
      } else {
        const used = it.usedVials ?? 0, returned = it.returnedVials ?? 0, wasted = it.wastedVials ?? 0
        worker.used += used; worker.returned += returned; worker.wasted += wasted
        worker.remaining -= used + returned + wasted
        store(it.vaccineId).remaining += returned
      }
    }
  }
  return [...rows.values()]
}
