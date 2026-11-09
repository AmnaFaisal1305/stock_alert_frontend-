import { useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Copy, Download, EllipsisVertical, Share, SquarePlus, TriangleAlert } from 'lucide-react'
import Button from '../ui/Button'
import { usePushState } from '../../hooks/usePushState'
import { INSTALL_EVENT, canPrompt, inAppBrowser, isStandalone, platform, promptInstall } from '../../lib/pwa'

export const INSTALL_URL = `${window.location.origin}/install`

// Urdu strings are machine-written like the rest of the Guide; they need a native speaker's review.
const T = {
  en: {
    installTitle: 'Install the app',
    installDesc: 'Opens from your home screen like any other app, full screen and faster.',
    installed: 'The app is installed on this device.',
    installBtn: 'Install app',
    installing: 'Installing…',
    inApp: 'This link opened inside another app (such as WhatsApp), which cannot install apps. Open it in Chrome (Android) or Safari (iPhone): tap the menu and choose “Open in browser”, or copy the link and paste it there.',
    copy: 'Copy link',
    copied: 'Link copied',
    ios: [
      [Share, 'In Safari, tap the Share button (at the bottom, or in the ⋯ menu next to the address).'],
      [SquarePlus, 'Scroll down and tap “Add to Home Screen”.'],
      [null, 'Tap “Add”. The app appears on your home screen.'],
    ],
    android: [
      [EllipsisVertical, 'Tap the ⋮ menu at the top right. If you opened this link from WhatsApp, first choose “Open in Chrome”, then tap ⋮ again.'],
      [Download, 'Tap “Install app” (or “Add to Home screen”).'],
      [null, 'Tap “Install”. The app appears on your home screen.'],
    ],
    desktop: 'On a computer, use the install icon at the right of Chrome or Edge’s address bar. On a phone, open this link:',
    alertsTitle: 'Turn on alerts',
    alertsDesc: 'Get a notification when a vaccine runs critically low or something is waiting for you.',
    alertsBtn: 'Turn on alerts',
    alertsBusy: 'Turning on…',
    alertsOn: 'Alerts are on for this device.',
    test: 'Send test',
    testing: 'Sending…',
    denied: 'Alerts are blocked for this site. Allow notifications for it in your browser or phone settings, then reload this page.',
    iosInstallFirst: 'Install the app first (above), then open it from your home screen and turn alerts on there. iPhone only allows alerts from the installed app.',
    unsupported: 'This browser can’t show alerts. Use Chrome on Android, or the installed app on iPhone.',
  },
  ur: {
    installTitle: 'ایپ انسٹال کریں',
    installDesc: 'یہ ہوم اسکرین سے کسی بھی ایپ کی طرح، پوری اسکرین پر اور تیزی سے کھلتی ہے۔',
    installed: 'ایپ اس فون پر انسٹال ہے۔',
    installBtn: 'ایپ انسٹال کریں',
    installing: 'انسٹال ہو رہی ہے…',
    inApp: 'یہ لنک کسی دوسری ایپ (جیسے WhatsApp) کے اندر کھلا ہے، جو ایپ انسٹال نہیں کر سکتی۔ اسے Chrome (اینڈرائیڈ) یا Safari (آئی فون) میں کھولیں: مینو پر ٹیپ کر کے “Open in browser” چنیں، یا لنک کاپی کر کے وہاں پیسٹ کریں۔',
    copy: 'لنک کاپی کریں',
    copied: 'لنک کاپی ہو گیا',
    ios: [
      [Share, 'Safari میں Share بٹن پر ٹیپ کریں (نیچے، یا ایڈریس کے ساتھ ⋯ مینو میں)۔'],
      [SquarePlus, 'نیچے اسکرول کر کے “Add to Home Screen” پر ٹیپ کریں۔'],
      [null, '“Add” پر ٹیپ کریں۔ ایپ آپ کی ہوم اسکرین پر آ جائے گی۔'],
    ],
    android: [
      [EllipsisVertical, 'اوپر دائیں ⋮ مینو پر ٹیپ کریں۔ اگر یہ لنک WhatsApp سے کھولا ہے تو پہلے “Open in Chrome” چنیں، پھر دوبارہ ⋮ پر ٹیپ کریں۔'],
      [Download, '“Install app” (یا “Add to Home screen”) پر ٹیپ کریں۔'],
      [null, '“Install” پر ٹیپ کریں۔ ایپ آپ کی ہوم اسکرین پر آ جائے گی۔'],
    ],
    desktop: 'کمپیوٹر پر Chrome یا Edge کے ایڈریس بار کے دائیں جانب انسٹال کا نشان استعمال کریں۔ فون پر یہ لنک کھولیں:',
    alertsTitle: 'الرٹس آن کریں',
    alertsDesc: 'جب کوئی ویکسین بہت کم رہ جائے یا کوئی کام آپ کا منتظر ہو تو اطلاع پائیں۔',
    alertsBtn: 'الرٹس آن کریں',
    alertsBusy: 'آن ہو رہے ہیں…',
    alertsOn: 'اس فون پر الرٹس آن ہیں۔',
    test: 'ٹیسٹ بھیجیں',
    testing: 'بھیجا جا رہا ہے…',
    denied: 'اس سائٹ کے الرٹس بند ہیں۔ براؤزر یا فون کی سیٹنگز میں اس کی اطلاعات کی اجازت دیں، پھر یہ صفحہ دوبارہ لوڈ کریں۔',
    iosInstallFirst: 'پہلے ایپ انسٹال کریں (اوپر)، پھر اسے ہوم اسکرین سے کھول کر وہاں الرٹس آن کریں۔ آئی فون صرف انسٹال شدہ ایپ سے الرٹس کی اجازت دیتا ہے۔',
    unsupported: 'یہ براؤزر الرٹس نہیں دکھا سکتا۔ اینڈرائیڈ پر Chrome استعمال کریں، یا آئی فون پر انسٹال شدہ ایپ۔',
  },
}

function Row({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex gap-3.5 py-4 first:pt-0 last:pb-0">
      <span className="w-9 h-9 rounded-control bg-primary/10 text-primary grid place-items-center flex-shrink-0" aria-hidden="true">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {desc && <p className="text-sm text-text-muted mt-0.5 leading-relaxed">{desc}</p>}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}

function Status({ tone = 'ok', children }) {
  const Icon = tone === 'ok' ? CheckCircle2 : TriangleAlert
  return (
    <p role="status" className={`flex gap-2 text-sm leading-relaxed ${tone === 'ok' ? 'text-success-dark' : 'text-warning-dark'}`}>
      <Icon size={16} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

function Steps({ steps }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map(([Icon, text], i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-text leading-relaxed">
          <span className="w-6 h-6 rounded-full bg-surface-chip text-xs font-medium grid place-items-center flex-shrink-0 tabular-nums" aria-hidden="true">{i + 1}</span>
          <span className="flex-1 pt-0.5">
            {text}
            {Icon && <Icon size={15} strokeWidth={1.75} className="inline-block ms-1.5 -mt-0.5 text-text-muted" aria-hidden="true" />}
          </span>
        </li>
      ))}
    </ol>
  )
}

function CopyLink({ t }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard blocked: the link is shown next to the button */ }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button size="sm" variant="secondary" onClick={copy}><Copy size={14} strokeWidth={1.75} /> {copied ? t.copied : t.copy}</Button>
      <span className="text-sm text-text-muted break-all select-all" dir="ltr">{INSTALL_URL}</span>
    </div>
  )
}

// Re-renders when Chrome's install prompt arrives or the app gets installed.
function useInstallState() {
  const [, bump] = useState(0)
  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener(INSTALL_EVENT, on)
    const mq = window.matchMedia('(display-mode: standalone)')
    mq.addEventListener?.('change', on)
    return () => { window.removeEventListener(INSTALL_EVENT, on); mq.removeEventListener?.('change', on) }
  }, [])
  if (isStandalone()) return 'installed'
  if (inAppBrowser()) return 'in_app'
  if (canPrompt()) return 'prompt'
  return platform() // 'ios' | 'android' | 'other'
}

// bare: just the steps/button, for a page whose own heading already says "Install the app".
export function InstallApp({ lang = 'en', bare = false }) {
  const t = T[lang] ?? T.en
  const state = useInstallState()
  const [busy, setBusy] = useState(false)

  async function install() {
    setBusy(true)
    try { await promptInstall() } finally { setBusy(false) }
  }

  const body = (
    <>
      {state === 'installed' && <Status>{t.installed}</Status>}
      {state === 'in_app' && <div className="flex flex-col gap-3"><Status tone="warn">{t.inApp}</Status><CopyLink t={t} /></div>}
      {state === 'prompt' && <Button size={bare ? 'lg' : 'md'} className={bare ? 'w-full' : ''} onClick={install} disabled={busy}><Download size={16} strokeWidth={1.75} /> {busy ? t.installing : t.installBtn}</Button>}
      {state === 'ios' && <Steps steps={t.ios} />}
      {state === 'android' && <Steps steps={t.android} />}
      {state === 'other' && <div className="flex flex-col gap-3"><p className="text-sm text-text leading-relaxed">{t.desktop}</p><CopyLink t={t} /></div>}
    </>
  )
  if (bare) return <div>{body}</div>
  return <Row icon={Download} title={t.installTitle} desc={state === 'installed' ? null : t.installDesc}>{body}</Row>
}

export function TurnOnAlerts({ lang = 'en' }) {
  const t = T[lang] ?? T.en
  const { state, busy, enable, testMsg, sendTest, testPending } = usePushState()
  const iosNotInstalled = state === 'unsupported' && platform() === 'ios' && !isStandalone()

  return (
    <Row icon={BellRing} title={t.alertsTitle} desc={state === 'subscribed' ? null : t.alertsDesc}>
      {state === 'idle' && <Button onClick={enable} disabled={busy}><BellRing size={16} strokeWidth={1.75} /> {busy ? t.alertsBusy : t.alertsBtn}</Button>}
      {state === 'subscribed' && (
        <div className="flex flex-col gap-3">
          <Status>{t.alertsOn}</Status>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button size="sm" variant="secondary" onClick={sendTest} disabled={testPending}>{testPending ? t.testing : t.test}</Button>
            {testMsg && <span className="text-sm text-text-muted" role="status" dir="ltr">{testMsg}</span>}
          </div>
        </div>
      )}
      {state === 'denied' && <Status tone="warn">{t.denied}</Status>}
      {state === 'unsupported' && <Status tone="warn">{iosNotInstalled ? t.iosInstallFirst : t.unsupported}</Status>}
    </Row>
  )
}
