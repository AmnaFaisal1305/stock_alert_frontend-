import { useEffect } from 'react'

// Field-entry screens (Assign Vials, Day End) flag typed-but-unsent values, so the top bar's
// Refresh asks first and a browser reload or tab close shows the browser's "leave page?" prompt.
let unsaved = false
let discarding = false
export const hasUnsavedWork = () => unsaved

// Reload after the user agreed to discard, without a second (browser) prompt.
export function reloadDiscarding() {
  discarding = true
  window.location.reload()
}

export function useUnsavedGuard(dirty) {
  useEffect(() => {
    if (!dirty) return
    unsaved = true
    const warn = (e) => { if (discarding) return; e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => { unsaved = false; window.removeEventListener('beforeunload', warn) }
  }, [dirty])
}
