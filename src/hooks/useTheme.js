import { useSyncExternalStore, useCallback } from 'react'

// Theme preference lives in localStorage ('dark' | 'light'); default is light.
// The value is mirrored onto <html data-theme>, which the token sets in
// index.css read. Dark is manual-only for now (no prefers-color-scheme auto
// switch) because screens are still being converted to tokens. An inline script
// in index.html applies the stored value before paint; this hook handles
// runtime changes.

const KEY = 'sst_theme'

function getPreference() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

function subscribe(cb) {
  window.addEventListener('storage', cb)
  window.addEventListener('sst:theme', cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener('sst:theme', cb)
  }
}

export function useTheme() {
  const resolved = useSyncExternalStore(subscribe, getPreference, () => 'light')

  const setTheme = useCallback((pref) => {
    const next = pref === 'dark' ? 'dark' : 'light'
    try { localStorage.setItem(KEY, next) } catch { /* storage unavailable — DOM only */ }
    document.documentElement.setAttribute('data-theme', next)
    window.dispatchEvent(new Event('sst:theme'))
  }, [])

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setTheme])

  return { preference: resolved, resolved, setTheme, toggle }
}
