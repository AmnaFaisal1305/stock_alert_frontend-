import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import * as api from '../../lib/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

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
    <div className="min-h-screen flex">

      {/* ── LEFT — Login Form ─────────────────────────────────────── */}
      <div className="relative flex flex-col justify-center w-full lg:w-[580px] xl:w-[640px] flex-shrink-0 bg-white px-14 xl:px-16 py-20 z-10">

        {/* Top green accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary-dark via-primary to-primary-light" />

        {/* Heading block */}
        <div className="mb-10">
          <h1 className="text-[28px] font-bold text-text tracking-tight leading-tight">
            Sign in to your account
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>

          <Input
            id="email"
            label="Email Address"
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              autoComplete="current-password"
              required
            />
            <div className="flex justify-end pt-0.5">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-primary hover:text-primary-dark hover:underline underline-offset-2 transition-colors duration-150"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-danger/5 border border-danger/20 text-danger"
            >
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[13px] font-medium leading-snug">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full font-semibold py-3.5 rounded-xl mt-1 text-[14px] tracking-wide transition-all duration-150"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2.5">
                <svg className="animate-spin w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Verifying…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            )}
          </Button>
        </form>

        {/* Google Sign-In */}
        {GOOGLE_CLIENT_ID && googleAvailable && (
          <div className="flex flex-col gap-4 mt-6">
            <div className="flex items-center gap-3">
              <hr className="flex-1 border-surface-border" />
              <span className="text-[11px] text-text-muted/50 font-medium whitespace-nowrap">or continue with</span>
              <hr className="flex-1 border-surface-border" />
            </div>
            <div id="google-signin-btn" className="flex justify-center" />
            {googleError && (
              <div
                role="alert"
                className="flex items-start gap-3 px-4 py-3 rounded-xl bg-danger/5 border border-danger/20 text-danger"
              >
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-[13px] font-medium leading-snug">{googleError}</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── RIGHT — Branding Panel ────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 flex-col items-center justify-center px-16 py-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #1E3932 0%, #006241 50%, #00754A 100%)' }}
      >
        {/* Subtle dot-grid texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(212,233,226,0.07) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />

        {/* Ambient glow — top right */}
        <div
          aria-hidden="true"
          className="absolute top-[-100px] right-[-80px] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,150,80,0.2) 0%, transparent 60%)' }}
        />
        {/* Ambient glow — bottom left */}
        <div
          aria-hidden="true"
          className="absolute bottom-[-80px] left-[-60px] w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(10,40,30,0.7) 0%, transparent 65%)' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center gap-10 w-full max-w-[400px]">

          {/* Partner logos card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl px-8 py-7 border border-white/15 shadow-2xl w-full">
            <img
              src="/images/WhatsApp%20Image%202026-08-21%20at%202.10.03%20AM.jpeg"
              alt="Partner logos — AKUH, EPI Sindh, UNICEF, WHO"
              className="w-full max-w-[300px] mx-auto object-contain"
            />
          </div>

          {/* Digital Intervention label */}
          <span className="text-epi-mint text-[18px] font-bold uppercase tracking-[0.2em]">
            Digital Intervention
          </span>

          {/* Decorative divider */}
          <div className="flex items-center gap-3 w-full px-4">
            <div className="flex-1 h-px bg-white/15" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
            <div className="flex-1 h-px bg-white/15" />
          </div>

          {/* Project title */}
          <div className="flex flex-col gap-3 px-2">
            <h2 className="text-white font-bold text-[20px] leading-snug tracking-tight">
              Enhancing Service Quality and Experience<br />
              in Karachi Super High Risk Union Councils
            </h2>
            <p className="text-white/50 text-[13px] font-medium leading-relaxed">
              Partnering for Strengthening Immunization Systems
            </p>
          </div>

          {/* Live status pill */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-epi-mint animate-pulse flex-shrink-0" />
            <span className="text-white/75 text-[11px] font-semibold uppercase tracking-[0.15em]">
              Live Monitoring System
            </span>
          </div>

        </div>
      </div>

    </div>
  )
}
