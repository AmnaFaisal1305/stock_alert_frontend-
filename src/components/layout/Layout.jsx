import { useState, useEffect } from 'react'
import { Bell, Download, X } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import { isPushSupported, enablePush } from '../../lib/push'

// ── Session keys ──────────────────────────────────────────────────────────────
const NOTIF_KEY   = 'sst_notif_card'
const INSTALL_KEY = 'sst_install_card'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone
}

// ── PWA prompt cards (bottom-right, appear 1.5 s after mount) ────────────────
function PWAPrompts() {
  const [showNotif,   setShowNotif]   = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [notifBusy,   setNotifBusy]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (
        isPushSupported() &&
        Notification.permission === 'default' &&
        !sessionStorage.getItem(NOTIF_KEY)
      ) setShowNotif(true)

      if (
        window.__pwaInstallPrompt &&
        !isStandalone() &&
        !sessionStorage.getItem(INSTALL_KEY)
      ) setShowInstall(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  async function handleEnable() {
    setNotifBusy(true)
    await enablePush()
    setNotifBusy(false)
    dismissNotif()
  }

  function dismissNotif() {
    sessionStorage.setItem(NOTIF_KEY, '1')
    setShowNotif(false)
  }

  async function handleInstall() {
    const prompt = window.__pwaInstallPrompt
    if (!prompt) return
    await prompt.prompt()
    window.__pwaInstallPrompt = null
    setShowInstall(false)
  }

  function dismissInstall() {
    sessionStorage.setItem(INSTALL_KEY, '1')
    setShowInstall(false)
  }

  if (!showNotif && !showInstall) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 w-[288px] pointer-events-none">

      {showNotif && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 pointer-events-auto animate-in fade-in duration-300">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <Bell size={14} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-text">Enable notifications</p>
            </div>
            <button
              onClick={dismissNotif}
              className="text-text-muted hover:text-text transition-colors mt-0.5 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mb-3.5">
            Get notified about critical stock levels and pending approvals in real time.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleEnable}
              disabled={notifBusy}
              className="flex-1 bg-primary text-white text-xs font-bold py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {notifBusy ? 'Enabling…' : 'Enable'}
            </button>
            <button
              onClick={dismissNotif}
              className="flex-1 bg-slate-100 text-text-muted text-xs font-semibold py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {showInstall && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 pointer-events-auto animate-in fade-in duration-300">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <Download size={14} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-text">Install this app</p>
            </div>
            <button
              onClick={dismissInstall}
              className="text-text-muted hover:text-text transition-colors mt-0.5 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mb-3.5">
            Add an icon to your home screen for faster access and a better offline experience.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 bg-primary text-white text-xs font-bold py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Install
            </button>
            <button
              onClick={dismissInstall}
              className="flex-1 bg-slate-100 text-text-muted text-xs font-semibold py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function Layout({ children }) {
  useOfflineSync()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed]         = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-surface-alt">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
      <PWAPrompts />
    </div>
  )
}
