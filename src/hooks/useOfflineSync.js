import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { replayQueue } from '../lib/offlineQueue'

export function useOfflineSync() {
  const qc = useQueryClient()

  useEffect(() => {
    async function drain() {
      const { drained } = await replayQueue()
      if (drained > 0) {
        qc.invalidateQueries({ queryKey: ['holdings'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        qc.invalidateQueries({ queryKey: ['audit-log'] })
      }
    }

    drain() // attempt on mount (catches offline items from a previous session)

    function handleOnline() { drain() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [qc])
}
