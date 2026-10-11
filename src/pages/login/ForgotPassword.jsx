import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, CheckCircle2, Shield } from 'lucide-react'
import { forgotPassword } from '../../lib/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function ForgotPassword() {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error,     setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      if (err.status === 429) {
        setError('Too many requests. Please wait a few minutes and try again.')
      } else {
        setSubmitted(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT — Branding Panel (mirrors login's right panel) ──────── */}
      <div
        className="hidden lg:flex flex-1 flex-col items-center justify-center px-16 py-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #1E3932 0%, #006241 50%, #00754A 100%)' }}
      >
        {/* Dot-grid texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(212,233,226,0.07) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />
        {/* Ambient glow — top left */}
        <div
          aria-hidden="true"
          className="absolute top-[-100px] left-[-80px] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,150,80,0.2) 0%, transparent 60%)' }}
        />
        {/* Ambient glow — bottom right */}
        <div
          aria-hidden="true"
          className="absolute bottom-[-80px] right-[-60px] w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(10,40,30,0.7) 0%, transparent 65%)' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center gap-10 w-full max-w-[400px]">

          <div className="bg-white/10 backdrop-blur-md rounded-2xl px-8 py-7 border border-white/15 shadow-2xl w-full">
            <img
              src="/images/login-hero.jpeg"
              alt="Partner logos — AKUH, EPI Sindh, UNICEF, WHO"
              className="w-full max-w-[300px] mx-auto object-contain"
            />
          </div>

          <span className="text-epi-mint text-[18px] font-bold uppercase tracking-[0.2em]">
            Digital Intervention
          </span>

          <div className="flex items-center gap-3 w-full px-4">
            <div className="flex-1 h-px bg-white/15" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
            <div className="flex-1 h-px bg-white/15" />
          </div>

          <div className="flex flex-col gap-3 px-2">
            <h2 className="text-white font-bold text-[20px] leading-snug tracking-tight">
              Enhancing Service Quality and Experience<br />
              in Karachi Super High Risk Union Councils
            </h2>
            <p className="text-white/50 text-[13px] font-medium leading-relaxed">
              Partnering for Strengthening Immunization Systems
            </p>
          </div>

          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-epi-mint animate-pulse flex-shrink-0" />
            <span className="text-white/75 text-[11px] font-semibold uppercase tracking-[0.15em]">
              Live Monitoring System
            </span>
          </div>

        </div>
      </div>

      {/* ── RIGHT — Form Panel ────────────────────────────────────────── */}
      <div className="relative flex flex-col justify-center w-full lg:w-[580px] xl:w-[640px] flex-shrink-0 bg-white px-5 sm:px-10 lg:px-14 xl:px-16 py-12 sm:py-20 z-10">

        {/* Top green accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary-dark via-primary to-primary-light" />

        <div className="mb-10">
          <h1 className="text-[28px] font-bold text-text tracking-tight leading-tight">
            Reset your password
          </h1>
          {!submitted && (
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Enter your account email and we'll send you a reset link.
            </p>
          )}
        </div>

        {submitted ? (
          /* ── Success state ── */
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-success-bg border border-success/20">
              <CheckCircle2 size={28} className="text-success-dark flex-shrink-0" />
              <div>
                <p className="font-bold text-text text-sm">Check your email</p>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  If that address is registered, a reset link has been sent.<br />
                  The link expires in 30 minutes and works only once.
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-dark hover:underline underline-offset-2 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        ) : (
          /* ── Email form ── */
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>

            <Input
              id="forgot-email"
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
              disabled={loading || !email}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="animate-spin w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sending Link…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Mail size={15} /> Send Reset Link
                </span>
              )}
            </Button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-1.5 text-xs font-bold text-text-muted hover:text-text transition-colors duration-150"
            >
              <ArrowLeft size={13} /> Back to Sign In
            </Link>

          </form>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 mt-10">
          <Shield size={11} className="text-text-muted/50 flex-shrink-0" aria-hidden="true" />
          <p className="text-[10px] uppercase font-bold tracking-wider text-text-muted/60">
            Official System — Aga Khan University Hospital Network
          </p>
        </div>

      </div>

    </div>
  )
}
