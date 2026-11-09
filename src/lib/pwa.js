// Installing the app (PWA). main.jsx captures Chrome's install prompt and fires INSTALL_EVENT
// when it arrives or the app gets installed, so open screens can re-render.
export const INSTALL_EVENT = 'sst:installable'

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone
}

export function platform() {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch points give it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

// Links opened inside these apps load in their own browser, which cannot install a PWA.
export function inAppBrowser() {
  return /WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|; wv\)/.test(navigator.userAgent)
}

export function canPrompt() {
  return !!window.__pwaInstallPrompt
}

// Returns 'accepted' | 'dismissed' | 'unavailable'
export async function promptInstall() {
  const e = window.__pwaInstallPrompt
  if (!e) return 'unavailable'
  e.prompt()
  const { outcome } = await e.userChoice
  window.__pwaInstallPrompt = null
  window.dispatchEvent(new Event(INSTALL_EVENT))
  return outcome
}
