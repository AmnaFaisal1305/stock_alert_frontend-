import { useState } from 'react'

// Grid / list choice per page, remembered in localStorage. Grid is the default.
export function useViewMode(pageKey) {
  const key = `sst_view_${pageKey}`
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(key) === 'list' ? 'list' : 'grid' } catch { return 'grid' }
  })
  const set = (m) => {
    setMode(m)
    try { localStorage.setItem(key, m) } catch { /* private mode: not remembered */ }
  }
  return [mode, set]
}
