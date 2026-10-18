import { useQuery } from '@tanstack/react-query'
import { getAuditLog } from '../lib/api'

// Fetches all pages of an audit-log query by following nextCursor.
// Capped at `cap` pages (default 10 × 15 = 150 entries) to stay cheap.
// Used for: flag computation, request thread modal, CSV export.
export function useAllAuditPages(params, { enabled = true, cap = 10 } = {}) {
  return useQuery({
    queryKey: ['audit-log-all', params],
    queryFn: async () => {
      const all = []
      let before = null
      for (let i = 0; i < cap; i++) {
        const page = await getAuditLog({ ...params, limit: 15, before })
        all.push(...(page.auditLog ?? []))
        if (!page.nextCursor) break
        before = page.nextCursor
      }
      return all
    },
    enabled: !!enabled,
    staleTime: 60_000,
    placeholderData: [],
  })
}
