import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { sendTestPush } from '../lib/api'
import { isPushSupported, enablePush } from '../lib/push'

function initialState() {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'subscribed'
  if (Notification.permission === 'denied') return 'denied'
  return 'idle'
}

// Push opt-in shared by the notification panel and the Guide's alerts card.
// state: 'idle' | 'subscribed' | 'denied' | 'unsupported'
export function usePushState() {
  const [state, setState] = useState(initialState)
  const [busy, setBusy] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  const test = useMutation({
    mutationFn: sendTestPush,
    onSuccess: (r) => setTestMsg(r?.sent ? `Sent to ${r.sent} device${r.sent === 1 ? '' : 's'}. Check your phone.` : 'No device accepted it.'),
    onError: (err) => setTestMsg(
      err.status === 404 ? 'This account has no device subscribed.'
      : err.status === 429 ? 'Limit reached: 3 test pushes per hour.'
      : err.status === 503 ? 'Push isn’t configured on this server.'
      : err.message,
    ),
  })

  async function enable() {
    setBusy(true)
    try {
      const result = await enablePush()
      setState(result === 'ok' ? 'subscribed' : result === 'denied' ? 'denied' : 'unsupported')
    } catch {
      setState('idle') // let them try again
    } finally {
      setBusy(false)
    }
  }

  function sendTest() {
    setTestMsg('')
    test.mutate()
  }

  return { state, busy, enable, testMsg, sendTest, testPending: test.isPending }
}
