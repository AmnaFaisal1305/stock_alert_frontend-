import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PackageCheck, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import * as api from '../../lib/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// ── Shared by Login, Forgot password and Reset password ────────────────────────

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[38px] h-[38px] rounded-control bg-primary-light text-text-inverse grid place-items-center flex-shrink-0">
        <PackageCheck size={19} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-sm font-medium leading-tight text-text">Stock Management &amp;<br />Alert System</p>
    </div>
  )
}

function ProjectPanel() {
  return (
    <div className="h-full bg-epi-dark text-text-inverse flex flex-col justify-center px-14 xl:px-20 py-16">
      <div className="max-w-[440px] flex flex-col gap-8">
        <div className="bg-surface rounded-card px-8 py-6">
          <img
            src="/images/login-hero.jpeg"
            alt="Partner logos: AKUH, EPI Sindh, UNICEF, WHO"
            className="w-full max-w-[300px] mx-auto object-contain"
          />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-inverse/70">Digital intervention</p>
          <h2 className="text-[30px] font-light leading-[1.2] tracking-tight text-balance">
            Enhancing service quality and experience in Karachi super high risk union councils
          </h2>
          <p className="text-sm text-text-inverse/70">Partnering for strengthening immunization systems</p>
        </div>
      </div>
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
    <div className="min-h-screen flex bg-surface">
      <main className="flex flex-col w-full lg:w-[560px] xl:w-[600px] flex-shrink-0 px-5 sm:px-10 lg:px-14 py-8 sm:py-10">
        <BrandMark />
        <div className="flex-1 flex flex-col justify-center w-full max-w-[400px] mx-auto lg:mx-0 py-12">
          <h1 className="text-[30px] font-light tracking-tight leading-[1.1] text-text">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted mt-2">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-xs text-text-muted">Official system of the Aga Khan University Hospital network</p>
      </main>
      <aside className="hidden lg:block flex-1 relative overflow-hidden">{aside ?? <ProjectPanel />}</aside>
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
          placeholder="you@domain.com"
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
