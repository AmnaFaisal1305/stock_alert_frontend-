import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

// Per-item links (/stock-requests/:id, /approvals/:id, pushes) land on the role's list with
// ?open=<id>. The list shows that item; its row scrolls into view.
export function useOpenId() {
  const [params] = useSearchParams()
  return params.get('open')
}

export function useScrollIntoView(on) {
  const ref = useRef(null)
  useEffect(() => { if (on) ref.current?.scrollIntoView({ block: 'center' }) }, [on])
  return ref
}
