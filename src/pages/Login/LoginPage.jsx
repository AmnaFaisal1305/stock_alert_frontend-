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
        { theme: 'outline', size: 'large', width: 400 }
      )
    }
    if (window.google?.accounts?.id) {
      initGSI()
      return
    }
    if (document.getElementById('gsi-script')) return
    const script = document.createElement('script')
    script.id = 'gsi-script'
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #1E3932 0%, #006241 55%, #00754A 100%)' }}
    >
      {/* Dot-grid texture overlay */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(212,233,226,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Decorative blurred circles */}
      <div aria-hidden="true" className="fixed top-[-120px] right-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,114,65,0.35) 0%, transparent 70%)' }} />
      <div aria-hidden="true" className="fixed bottom-[-100px] left-[-60px] w-[320px] h-[320px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(30,57,50,0.5) 0%, transparent 70%)' }} />

      {/* ── Login card ─────────────────────────────────────────────── */}
      <div className="relative w-full max-w-[480px] z-10">

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/10">

          {/* Green header band */}
          <div
            className="px-8 py-4 flex flex-col items-center gap-0.5"
            style={{ background: 'linear-gradient(90deg, #1E3932 0%, #006241 100%)' }}
          >
            <span className="text-epi-mint text-[10px] font-bold uppercase tracking-[0.2em]">
              Government of Sindh
            </span>
            <span className="text-white/50 text-[9px] uppercase tracking-widest font-medium">
              Expanded Programme on Immunization
            </span>
          </div>

          {/* Logos */}
          <div className="px-8 pt-6 pb-4 flex justify-center">
            <img
              src="/images/WhatsApp%20Image%202026-08-21%20at%202.10.03%20AM.jpeg"
              alt="Partner Logos — AKUH, EPI Sindh, UNICEF, WHO"
              className="w-full max-w-[340px] object-contain"
            />
          </div>

          {/* Gradient divider */}
          <div className="mx-6 h-px" style={{ background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)' }} />

          {/* Project title */}
          <div className="px-8 py-5 text-center">
            <h1 className="text-[13px] font-bold text-text tracking-tight leading-snug">
              Enhancing Service Quality and Experience in Karachi<br />
              Super High Risk Union Councils (SHRUCs)
            </h1>
            <p className="text-[11px] text-text-muted font-medium mt-1.5 leading-relaxed">
              Partnering for Strengthening Immunization Systems
            </p>
          </div>

          {/* Gradient divider */}
          <div className="mx-6 h-px" style={{ background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)' }} />

          {/* Form section */}
          <div className="px-8 pt-6 pb-8">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.18em] text-center mb-5">
              Sign In to Your Account
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                id="email"
                label="Email Address"
                type="email"
                placeholder="username@akuh.pilot"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  required
                />
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline font-semibold">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && (
                <p className="text-xs font-semibold text-danger bg-danger-bg border border-danger/10 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full font-bold uppercase tracking-wider text-xs py-3 mt-1"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Verifying Credentials…
                  </span>
                ) : 'Sign In'}
              </Button>
            </form>

            {/* Google Sign-In — only rendered when VITE_GOOGLE_CLIENT_ID is set */}
            {GOOGLE_CLIENT_ID && googleAvailable && (
              <div className="flex flex-col gap-3 mt-4">
                <div className="flex items-center gap-3">
                  <hr className="flex-1 border-slate-100" />
                  <span className="text-xs text-text-muted/60 font-medium">or</span>
                  <hr className="flex-1 border-slate-100" />
                </div>
                <div id="google-signin-btn" />
                {googleError && (
                  <p className="text-xs font-semibold text-danger bg-danger-bg border border-danger/10 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {googleError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/35 text-[11px] mt-5 leading-relaxed font-medium">
          EPI Sindh &nbsp;·&nbsp; Sprint 02 Digital Intervention &nbsp;·&nbsp; Confidential System
        </p>
      </div>
    </div>
  )
}
