import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthShell } from './LoginPage'
import Tabs from '../../components/ui/Tabs'
import { InstallApp } from '../../components/shared/AppSetup'

// Public page (no sign-in) to share before training: smart-stock-alert.vercel.app/install
const LANG_KEY = 'sst_guide_lang' // shared with the Guide
const LANGS = [{ value: 'en', label: 'English' }, { value: 'ur', label: 'اردو' }]
const T = {
  en: { title: 'Install the app', subtitle: 'Put Smart Stock Alert on your phone’s home screen.', after: 'Installed? Open it from your home screen and sign in.', signIn: 'Sign in' },
  ur: { title: 'ایپ انسٹال کریں', subtitle: 'Smart Stock Alert کو اپنے فون کی ہوم اسکرین پر رکھیں۔', after: 'انسٹال ہو گئی؟ اسے ہوم اسکرین سے کھولیں اور سائن ان کریں۔', signIn: 'سائن ان' },
}

export default function InstallPage() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) === 'ur' ? 'ur' : 'en' } catch { return 'en' }
  })
  const t = T[lang]

  function changeLang(next) {
    setLang(next)
    try { localStorage.setItem(LANG_KEY, next) } catch { /* private mode */ }
  }

  return (
    <div lang={lang} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      <AuthShell title={t.title} subtitle={t.subtitle}>
        <div className={`flex flex-col gap-6 ${lang === 'ur' ? '[&_p]:leading-loose [&_li]:leading-loose' : ''}`}>
          <Tabs tabs={LANGS} value={lang} onChange={changeLang} size="sm" label="Language / زبان" />
          <InstallApp lang={lang} bare />
          <p className="text-sm text-text-muted border-t border-surface-border pt-5">
            {t.after}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline underline-offset-2">{t.signIn}</Link>
          </p>
        </div>
      </AuthShell>
    </div>
  )
}
