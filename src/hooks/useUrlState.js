import { useSearchParams } from 'react-router-dom'

// Filters that live in the URL query, so they survive refresh and Back and can be shared as
// a link. Defaults are left out of the URL. Values are strings. Change several keys in one
// call (React Router's setter does not chain two calls made in the same event).
export function useUrlFilters(defaults) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(Object.entries(defaults).map(([k, d]) => [k, params.get(k) ?? d]))
  const set = (patch) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || v === defaults[k]) p.delete(k)
        else p.set(k, v)
      }
      return p
    }, { replace: true })
  }
  return [values, set]
}

// One filter: const [q, setQ] = useUrlState('q')
export function useUrlState(key, defaultValue = '') {
  const [values, set] = useUrlFilters({ [key]: defaultValue })
  return [values[key], (v) => set({ [key]: v })]
}
