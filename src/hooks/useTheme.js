import { useSyncExternalStore, useCallback } from 'react'

// Theme preference lives in localStorage ('dark' | 'light'). With nothing stored the
// app follows the OS (index.css applies dark tokens via prefers-color-scheme), so
// `resolved` must follow the OS too, or charts and the toggle icon disagree with the page.
// An inline script in index.html applies a stored value before paint.

const KEY = 'sst_theme'
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function getStored() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

function getResolved() {
  const stored = getStored()
  if (stored === 'dark' || stored === 'light') return stored
  return media?.matches ? 'dark' : 'light'
}

function subscribe(cb) {
  window.addEventListener('storage', cb)
  window.addEventListener('sst:theme', cb)
  media?.addEventListener('change', cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener('sst:theme', cb)
    media?.removeEventListener('change', cb)
  }
}

export function useTheme() {
  const resolved = useSyncExternalStore(subscribe, getResolved, () => 'light')

  const setTheme = useCallback((pref) => {
    const next = pref === 'dark' ? 'dark' : 'light'
    try { localStorage.setItem(KEY, next) } catch { /* storage unavailable — DOM only */ }
    document.documentElement.setAttribute('data-theme', next)
    window.dispatchEvent(new Event('sst:theme'))
  }, [])

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setTheme])

  return { preference: getStored() ?? 'system', resolved, setTheme, toggle }
}
