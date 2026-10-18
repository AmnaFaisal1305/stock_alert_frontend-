import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import * as api from '../../lib/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// ── Shared by Login, Forgot password and Reset password ────────────────────────

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <img src="/images/logo-circle-192.png" alt="" width="44" height="44" className="w-11 h-11 rounded-full flex-shrink-0" />
      <p className="text-sm font-medium leading-tight text-text">Stock Management &amp;<br />Alert System</p>
    </div>
  )
}

// Partner logos on top, the message in the middle, a contact line at the bottom (docs/design_refrences/login.html).
function ProjectPanel() {
  return (
    <div className="h-full min-h-screen bg-epi-dark text-text-inverse flex flex-col justify-between gap-12 px-12 xl:px-20 py-10">
      <div className="self-start w-full max-w-[640px] bg-white rounded-card px-7 py-5">
        <img
          src="/images/login-hero.jpeg"
          alt="Partner logos"
          width="766"
          height="128"
          className="w-full h-auto block"
        />
      </div>

      <div className="max-w-[640px] flex flex-col gap-5">
        <p className="inline-flex items-center gap-2.5 text-base font-semibold text-text-inverse/80">
          <span aria-hidden="true" className="w-7 h-0.5 rounded-full bg-primary-light" />
          Digital intervention
        </p>
        <h2 className="text-4xl font-light leading-[1.15] tracking-tight text-balance">
          Enhancing service quality and experience in Karachi’s super high-risk union councils
        </h2>
        <p className="text-base leading-relaxed text-text-inverse/70 max-w-[42ch] pl-4 border-l-2 border-white/25">
          Partnering for strengthening immunization systems.
        </p>
      </div>

      <p className="text-xs text-text-inverse/50">Need access? Contact your administrator.</p>
    </div>
  )
}

export function FormAlert({ children }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-control bg-danger-bg px-3.5 py-2.5 text-sm text-danger-dark">
      <AlertCircle size={16} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// Form column with the brand mark; `aside` replaces the default project panel (desktop only).
export function AuthShell({ title, subtitle, aside, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(380px,5fr)_7fr] bg-surface">
      <main className="flex flex-col min-h-screen px-6 sm:px-12 lg:px-[clamp(24px,6vw,88px)] py-10">
        <BrandMark />
        <div className="flex-1 flex flex-col justify-center w-full max-w-[440px] mx-auto py-12">
          <h1 className="text-4xl font-light tracking-tight leading-[1.1] text-text">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted mt-2.5">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <ShieldCheck size={15} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
          Official system of the Aga Khan University Hospital network
        </p>
      </main>
      <aside className="hidden lg:block relative overflow-hidden">{aside ?? <ProjectPanel />}</aside>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth()

  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [googleAvailable, setGoogleAvailable] = useState(!!GOOGLE_CLIENT_ID)
  const [googleError,     setGoogleError]     = useState('')

  async function handleGoogleCredential({ credential }) {
    setGoogleError('')
    setLoading(true)
    try {
      const data = await api.googleLogin(credential)
      login(data.user, data.csrfToken)
    } catch (err) {
      if (err.status === 403 && err.body?.code === 'NOT_REGISTERED') {
        setGoogleError('This Google account is not registered in the system. Contact your administrator.')
      } else if (err.status === 503) {
        setGoogleAvailable(false)
      } else if (err.status === 429) {
        setGoogleError('Too many attempts. Please wait a few minutes and try again.')
      } else {
        setGoogleError('Google sign-in failed. Please try signing in with your email and password.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    function initGSI() {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential })
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', width: 380 }
      )
    }
    if (window.google?.accounts?.id) { initGSI(); return }
    if (document.getElementById('gsi-script')) return
    const script = document.createElement('script')
    script.id  = 'gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = initGSI
    document.head.appendChild(script)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email, password)
      login(data.user, data.csrfToken)
    } catch (err) {
      if (err.status === 401)      setError('Invalid email or password.')
      else if (err.status === 429) setError('Too many login attempts. Please wait a few minutes and try again.')
      else                         setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use the email and password your administrator gave you.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
          autoComplete="email"
          autoFocus
          required
        />
        <div className="flex flex-col gap-1.5">
          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
            autoComplete="current-password"
            required
          />
          <Link to="/forgot-password" className="self-end text-sm text-primary hover:underline underline-offset-2">
            Forgot password?
          </Link>
        </div>

        {error && <FormAlert>{error}</FormAlert>}

        <Button type="submit" size="lg" className="w-full mt-1" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      {GOOGLE_CLIENT_ID && googleAvailable && (
        <div className="flex flex-col gap-4 mt-6">
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-surface-border" />
            <span className="text-xs text-text-muted whitespace-nowrap">or</span>
            <hr className="flex-1 border-surface-border" />
          </div>
          <div id="google-signin-btn" className="flex justify-center max-w-full overflow-hidden" />
          {googleError && <FormAlert>{googleError}</FormAlert>}
        </div>
      )}
    </AuthShell>
  )
}
