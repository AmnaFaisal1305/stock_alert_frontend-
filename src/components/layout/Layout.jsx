import { useState, useEffect, useCallback } from 'react'
import { BellRing, Download, X } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Button from '../ui/Button'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import { isPushSupported, enablePush } from '../../lib/push'

const NOTIF_KEY   = 'sst_notif_card'
const INSTALL_KEY = 'sst_install_card'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone
}

// One inline prompt at the top of the content, never covering it: notifications first,
// then app install. Each is dismissed for the browser session.
function PromptBanner() {
  const [prompt, setPrompt] = useState(null) // 'notif' | 'install' | null
  const [busy, setBusy] = useState(false)

  const pickNext = useCallback(() => {
    if (isPushSupported() && Notification.permission === 'default' && !sessionStorage.getItem(NOTIF_KEY)) return 'notif'
    if (window.__pwaInstallPrompt && !isStandalone() && !sessionStorage.getItem(INSTALL_KEY)) return 'install'
    return null
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setPrompt(pickNext()), 1500)
    return () => clearTimeout(t)
  }, [pickNext])

  function dismiss() {
    sessionStorage.setItem(prompt === 'notif' ? NOTIF_KEY : INSTALL_KEY, '1')
    setPrompt(pickNext())
  }

  async function accept() {
    setBusy(true)
    if (prompt === 'notif') {
      await enablePush()
    } else {
      await window.__pwaInstallPrompt?.prompt()
      window.__pwaInstallPrompt = null
    }
    setBusy(false)
    dismiss()
  }

  if (!prompt) return null
  const isNotif = prompt === 'notif'
  const Icon = isNotif ? BellRing : Download

  return (
    <div role="region" aria-label={isNotif ? 'Enable notifications' : 'Install app'} className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-surface-border bg-surface px-4 py-3">
      <Icon size={18} strokeWidth={1.75} className="text-primary flex-shrink-0" aria-hidden="true" />
      <p className="text-sm text-text flex-1 min-w-[12rem]">
        {isNotif
          ? <>Get an alert when a vaccine runs critically low or an approval is waiting.</>
          : <>Install the app for faster access and better offline use.</>}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={accept} disabled={busy}>
          {busy ? 'Working…' : isNotif ? 'Turn on alerts' : 'Install'}
        </Button>
        <Button size="sm" variant="secondary" onClick={dismiss}>Not now</Button>
      </div>
      <button onClick={dismiss} className="hidden sm:grid w-8 h-8 place-items-center rounded-control text-text-muted hover:bg-surface-alt hover:text-text" aria-label="Dismiss">
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  )
}

const COLLAPSE_KEY = 'sst_sidebar_collapsed'

export default function Layout({ children }) {
  useOfflineSync()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed]         = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })
  const closeNav = useCallback(() => setMobileNavOpen(false), [])

  // One menu button: on lg+ it switches full ↔ icon rail, below lg it opens the drawer.
  const onMenuClick = useCallback(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return setMobileNavOpen(true)
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* private mode */ }
      return !c
    })
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-surface-alt">
      <Sidebar mobileOpen={mobileNavOpen} onClose={closeNav} collapsed={collapsed} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar onMenuClick={onMenuClick} navCollapsed={collapsed} navOpen={mobileNavOpen} />
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-7 pt-5 sm:pt-6 pb-10">
          <PromptBanner />
          {children}
        </main>
      </div>
    </div>
  )
}
