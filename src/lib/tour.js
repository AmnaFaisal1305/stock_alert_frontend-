// Guided tour (driver.js), loaded lazily by TourRunner in Layout.
// First sign-in on a device: a short welcome tour of the shell, then each page shows its own
// short tour the first time it is opened. Seen-state is per user, per device (localStorage).
// Page intros reuse the Guide's text (GUIDE in DashboardGuide.jsx), so keep that in step with NAV.
// Steps whose element is missing or off-screen are skipped, which covers phones (sidebar in a
// drawer, view toggle hidden) and the Observer (no action buttons).
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { GUIDE } from '../pages/shared/DashboardGuide'
import { navFor } from './navigation'

const LANG_KEY = 'sst_guide_lang' // shared with the Guide page
const seenKey  = (user) => `sst_tour_v1:${user.id ?? user.email}`

export function getLang() {
  try { return localStorage.getItem(LANG_KEY) === 'ur' ? 'ur' : 'en' } catch { return 'en' }
}
function setLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang) } catch { /* private mode */ }
}

function readSeen(user) {
  try { return JSON.parse(localStorage.getItem(seenKey(user))) ?? { welcome: false, pages: {} } } catch { return { welcome: false, pages: {} } }
}
function writeSeen(user, seen) {
  try { localStorage.setItem(seenKey(user), JSON.stringify(seen)) } catch { /* private mode */ }
}

// Forget everything this user has seen, so the welcome tour and every page tour show again.
export function resetTour(user) {
  try { localStorage.removeItem(seenKey(user)) } catch { /* private mode */ }
}

// ── Copy ──────────────────────────────────────────────────────────────────────
const UI = {
  en: { next: 'Next', prev: 'Back', done: 'Done', switchTo: 'اردو', switchLabel: 'Show this tour in Urdu', close: 'Skip tour' },
  ur: { next: 'اگلا', prev: 'پچھلا', done: 'ختم', switchTo: 'English', switchLabel: 'Show this tour in English', close: 'ٹور چھوڑیں' },
}

const WELCOME = {
  en: {
    hello: (name) => [`Welcome${name ? `, ${name}` : ''}`, 'This short tour shows you where everything is. It takes about a minute. Press Next to continue, or the اردو button to read it in Urdu.'],
    nav: ['Your pages', 'Every page you can use is in this menu, grouped by task. The page you are on is highlighted.'],
    menu: ['Your pages', 'Tap this button to open the menu. Every page you can use is there, grouped by task.'],
    cta: (label) => [label, 'Your most-used task is always here, one tap away.'],
    bell: ['Notifications', 'Alerts for critically low stock, and anything waiting for you, arrive here. The red number is how many are unread.'],
    guide: ['Help is always here', 'Guide explains your role and every page. You can take this tour again from there.'],
    end: ['You are ready', 'Each page shows a short tour the first time you open it. To see the tours again, open Guide from the menu and press "Take the tour".'],
  },
  ur: {
    hello: (name) => [`خوش آمدید${name ? `، ${name}` : ''}`, 'یہ مختصر ٹور آپ کو دکھاتا ہے کہ ہر چیز کہاں ہے۔ اس میں تقریباً ایک منٹ لگتا ہے۔ آگے بڑھنے کے لیے "اگلا" دبائیں، یا انگریزی میں پڑھنے کے لیے English کا بٹن دبائیں۔'],
    nav: ['آپ کے صفحات', 'آپ کے استعمال کے تمام صفحات اس مینو میں کام کے لحاظ سے ترتیب دیے گئے ہیں۔ جس صفحے پر آپ ہیں وہ نمایاں نظر آتا ہے۔'],
    menu: ['آپ کے صفحات', 'مینو کھولنے کے لیے یہ بٹن دبائیں۔ آپ کے استعمال کے تمام صفحات وہاں کام کے لحاظ سے ترتیب دیے گئے ہیں۔'],
    cta: (label) => [label, 'آپ کا سب سے زیادہ استعمال ہونے والا کام ہمیشہ یہاں ہے، صرف ایک کلک پر۔'],
    bell: ['اطلاعات', 'اسٹاک انتہائی کم ہونے کی اطلاع، اور جو کام آپ کے منتظر ہیں، یہاں آتے ہیں۔ سرخ نمبر بتاتا ہے کہ کتنی اطلاعات ابھی نہیں پڑھی گئیں۔'],
    guide: ['مدد ہمیشہ یہاں ہے', 'Guide میں آپ کے کردار اور ہر صفحے کی وضاحت ہے۔ یہ ٹور آپ وہاں سے دوبارہ دیکھ سکتے ہیں۔'],
    end: ['آپ تیار ہیں', 'ہر صفحہ پہلی بار کھولنے پر ایک مختصر ٹور دکھاتا ہے۔ ٹور دوبارہ دیکھنے کے لیے مینو سے Guide کھولیں اور "ٹور شروع کریں" دبائیں۔'],
  },
}

// Controls that appear on many pages. Each is shown only if the page has it.
const COMMON = [
  { el: '[data-tour="page-actions"]',
    en: ['Actions', 'The buttons for this page\'s main tasks are here.'],
    ur: ['کام کے بٹن', 'اس صفحے کے اہم کاموں کے بٹن یہاں ہیں۔'] },
  { el: 'main [role="tablist"]:not([aria-label="View"])',
    en: ['Sections', 'Switch between the parts of this page. The number shows how many items each part has.'],
    ur: ['حصے', 'اس صفحے کے مختلف حصوں کے درمیان جائیں۔ نمبر بتاتا ہے کہ ہر حصے میں کتنی چیزیں ہیں۔'] },
  { el: 'main input[type="search"]',
    en: ['Search', 'Type part of a name to find it quickly.'],
    ur: ['تلاش', 'کسی نام کا کچھ حصہ لکھیں تاکہ وہ جلدی مل جائے۔'] },
  { el: 'main [role="group"]',
    en: ['Filters', 'Tap a filter to show only those items. Tap All to see everything again.'],
    ur: ['فلٹر', 'کسی فلٹر کو دبائیں تاکہ صرف وہی چیزیں نظر آئیں۔ سب کچھ دوبارہ دیکھنے کے لیے All دبائیں۔'] },
  { el: 'main [role="tablist"][aria-label="View"]',
    en: ['Grid or list', 'Choose whether the list shows as cards or as rows.'],
    ur: ['کارڈ یا فہرست', 'منتخب کریں کہ فہرست کارڈز کی صورت میں دکھے یا قطاروں میں۔'] },
  { el: 'main button[aria-label="Export CSV"]',
    en: ['Export', 'Download this list as a CSV file that opens in Excel.'],
    ur: ['ڈاؤن لوڈ', 'یہ فہرست CSV فائل کی صورت میں ڈاؤن لوڈ کریں جو Excel میں کھلتی ہے۔'] },
]

const WORK_DATE = {
  el: '#occurredOn',
  en: ['Date', 'Today is filled in. If you are entering work from an earlier day, pick that date here (up to 7 days back).'],
  ur: ['تاریخ', 'آج کی تاریخ پہلے سے درج ہے۔ اگر آپ کسی پچھلے دن کا کام درج کر رہے ہیں تو یہاں وہ تاریخ چنیں (زیادہ سے زیادہ 7 دن پہلے تک)۔'],
}
const PICK_WORKER = {
  el: '[data-tour="step-worker"]',
  en: ['1. Choose the vaccinator', 'Start by tapping the vaccinator you are recording for.'],
  ur: ['1. ویکسینیٹر چنیں', 'سب سے پہلے اس ویکسینیٹر کو دبائیں جس کا ریکارڈ آپ درج کر رہے ہیں۔'],
}

// Extra steps for particular pages, matched on the end of the path. Shown before COMMON.
const PAGES = {
  '/dashboard': [
    { el: '#stock-heading', // the heading, not the list: on a phone the list is taller than the screen
      en: ['Stock by vaccine', 'Red is Critical, amber is Low, green is Normal. Check red and amber first: those vaccines need restocking.'],
      ur: ['ویکسین کے لحاظ سے اسٹاک', 'سرخ کا مطلب Critical، پیلا Low اور سبز Normal ہے۔ پہلے سرخ اور پیلے کو دیکھیں: ان ویکسینز کا اسٹاک منگوانا ہے۔'] },
  ],
  '/assign-vials': [
    WORK_DATE,
    PICK_WORKER,
    { el: '[data-tour="step-vials"]',
      en: ['2. Enter the vials', 'Use + and − to set how many vials of each vaccine they take out. "Store" shows what the facility has right now. Then press Review and save.'],
      ur: ['2. وائلز درج کریں', '+ اور − سے بتائیں کہ ہر ویکسین کے کتنے وائلز ساتھ لے جا رہے ہیں۔ "Store" بتاتا ہے کہ اس وقت فیسلٹی میں کتنا ہے۔ پھر Review دبا کر محفوظ کریں۔'] },
  ],
  '/day-end': [
    WORK_DATE,
    PICK_WORKER,
    { el: '[data-tour="step-vials"]',
      en: ['2. Account for every vial', 'For each vaccine, enter how many vials were used and wasted. Whatever is left is returned to the store. Then press Review and save.'],
      ur: ['2. ہر وائل کا حساب', 'ہر ویکسین کے لیے لکھیں کہ کتنے وائل استعمال ہوئے اور کتنے ضائع ہوئے۔ جو بچ جائیں وہ اسٹور میں واپس چلے جاتے ہیں۔ پھر Review دبا کر محفوظ کریں۔'] },
  ],
  '/analytics': [
    { el: '[data-tour="analytics-filters"]',
      en: ['Choose what to look at', 'Pick the dates, the place and the vaccine. Every number and chart below follows these choices.'],
      ur: ['کیا دیکھنا ہے، چنیں', 'تاریخیں، جگہ اور ویکسین منتخب کریں۔ نیچے کے تمام نمبر اور چارٹ انہی کے مطابق بدلتے ہیں۔'] },
    { el: '[data-tour="analytics-cards"]',
      en: ['The stock balance', 'Received, plus or minus corrections, equals used + wasted + available. Tap any card to see where its number comes from.'],
      ur: ['اسٹاک کا حساب', 'موصول شدہ، جمع یا منفی درستگی، برابر ہے استعمال + ضائع + دستیاب کے۔ کسی بھی کارڈ کو دبائیں تاکہ معلوم ہو یہ نمبر کہاں سے آیا۔'] },
    { el: '[data-tour="analytics-chart"]',
      en: ['Charts you can tap', 'Tap a vaccine\'s bar to show only that vaccine on the whole page. Tap it again to see all vaccines.'],
      ur: ['چارٹ جنہیں دبایا جا سکتا ہے', 'کسی ویکسین کی پٹی دبائیں تو پورے صفحے پر صرف وہی ویکسین دکھے گی۔ دوبارہ دبائیں تو سب ویکسینز نظر آئیں گی۔'] },
    { el: '[data-tour="analytics-export"]',
      en: ['Reports', 'Download the figures as an Excel or PDF report.'],
      ur: ['رپورٹس', 'اعداد و شمار Excel یا PDF رپورٹ کی صورت میں ڈاؤن لوڈ کریں۔'] },
  ],
}

// ── Building steps ────────────────────────────────────────────────────────────
function resolve(el) {
  return typeof el === 'function' ? el() : document.querySelector(el)
}

// On screen and laid out: hidden elements (display none, the closed mobile drawer) are skipped.
function visible(node) {
  if (!node) return false
  const r = node.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth
}

function step(node, [title, description]) {
  return node ? { element: node, popover: { title, description } } : { popover: { title, description } }
}

function welcomeSteps(user, lang) {
  const w = WELCOME[lang]
  const nav = navFor(user.role)
  const first = (user.name ?? '').split(' ')[0]
  const desktop = window.matchMedia('(min-width: 1024px)').matches
  const out = [step(null, w.hello(first))]
  const navEl = document.querySelector('nav[aria-label="Main navigation"]')
  const menuBtn = document.querySelector('button[aria-label="Toggle navigation"]')
  if (desktop && visible(navEl)) out.push(step(navEl, w.nav))
  else if (visible(menuBtn)) out.push(step(menuBtn, w.menu))
  const cta = nav.cta && document.querySelector(`aside a[href="${nav.cta.to}"]`)
  if (visible(cta)) out.push(step(cta, w.cta(nav.cta.label)))
  const bell = document.querySelector('button[aria-label^="Notifications"]')
  if (visible(bell)) out.push(step(bell, w.bell))
  const guide = nav.guide && document.querySelector(`aside a[href="${nav.guide}"]`)
  out.push(visible(guide) ? step(guide, w.guide) : step(null, w.end))
  return out
}

function pageSteps(user, pathname, lang) {
  if (pathname.endsWith('/guide')) return []
  const items = navFor(user.role).groups.flatMap((g) => g.items)
  const item = items.find((i) => pathname === i.to)
  if (!item) return []
  const g = (GUIDE[user.role] ?? GUIDE.super_admin)[lang]
  const intro = g.modules.find(([name]) => name === item.label)?.[1]
  const out = []
  const h1 = document.querySelector('main h1')
  if (intro) out.push(step(visible(h1) ? h1 : null, [item.label, intro]))
  const suffix = Object.keys(PAGES).find((s) => pathname.endsWith(s))
  const used = new Set()
  for (const s of [...(PAGES[suffix] ?? []), ...COMMON]) {
    const node = resolve(s.el)
    if (!visible(node) || used.has(node)) continue
    used.add(node)
    out.push(step(node, s[lang]))
  }
  // A page with nothing but its intro still gets the intro; one with no intro gets nothing.
  return intro ? out : []
}

// ── Running ───────────────────────────────────────────────────────────────────
let active = null

function run(kind, user, pathname, startAt = 0) {
  const lang = getLang()
  const steps = kind === 'welcome' ? welcomeSteps(user, lang) : pageSteps(user, pathname, lang)
  if (steps.length === 0) {
    if (kind === 'page') markPage(user, pathname)
    return
  }
  const t = UI[lang]
  let switching = false

  const d = driver({
    steps,
    showProgress: steps.length > 1,
    progressText: '{{current}} / {{total}}',
    nextBtnText: t.next,
    prevBtnText: t.prev,
    doneBtnText: t.done,
    allowClose: true,
    overlayColor: 'rgb(28, 33, 30)',
    overlayOpacity: 0.5,
    stagePadding: 0, // the sidebar is flush with the screen edge; padding showed a strip of page
    stageRadius: 10,
    popoverClass: 'sst-tour',
    smoothScroll: true,
    onPopoverRender: (popover, { driver: drv }) => {
      popover.wrapper.lang = lang
      popover.wrapper.dir = lang === 'ur' ? 'rtl' : 'ltr'
      popover.progress.dir = 'ltr' // "2 / 4", not "4 / 2"
      popover.closeButton.setAttribute('aria-label', t.close)
      popover.closeButton.title = t.close
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'sst-tour-lang'
      btn.textContent = t.switchTo
      btn.setAttribute('aria-label', t.switchLabel)
      btn.lang = lang === 'ur' ? 'en' : 'ur'
      btn.addEventListener('click', () => {
        const at = drv.getActiveIndex() ?? 0
        switching = true
        drv.destroy()
        setLang(lang === 'ur' ? 'en' : 'ur')
        run(kind, user, pathname, at)
      })
      popover.footer.prepend(btn)
    },
    onDestroyed: () => {
      if (active === d) active = null
      if (switching) return
      if (kind === 'welcome') {
        const seen = readSeen(user)
        writeSeen(user, { ...seen, welcome: true })
        if (!seen.pages?.[pathname]) setTimeout(() => run('page', user, pathname), 250)
      } else {
        markPage(user, pathname)
      }
    },
  })
  active = d
  d.drive(Math.min(startAt, steps.length - 1))
}

function markPage(user, pathname) {
  const seen = readSeen(user)
  writeSeen(user, { ...seen, pages: { ...seen.pages, [pathname]: true } })
}

// Waits for the page to finish loading (no skeletons), so data-driven steps can be found.
function whenSettled(signal) {
  return new Promise((resolveP) => {
    const started = Date.now()
    const tick = () => {
      if (signal.aborted) return
      const loading = document.querySelector('main [aria-busy="true"], main .animate-pulse')
      if ((!loading && document.querySelector('main h1')) || Date.now() - started > 6000) resolveP()
      else setTimeout(tick, 200)
    }
    tick()
  })
}

// Called on every route change: shows the welcome tour once, then each page's tour once.
export async function maybeRunTour(user, pathname, signal) {
  if (!user || active?.isActive()) return
  const seen = readSeen(user)
  if (seen.welcome && seen.pages?.[pathname]) return
  await whenSettled(signal)
  await new Promise((r) => setTimeout(r, 350))
  if (signal.aborted || active?.isActive() || document.querySelector('[role="dialog"]')) return
  run(seen.welcome ? 'page' : 'welcome', user, pathname)
}

// Route changed while a tour was open (e.g. the user tapped a sidebar link): end it quietly.
export function stopTour() {
  if (active?.isActive()) active.destroy()
}
