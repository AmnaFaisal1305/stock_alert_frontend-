import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { forgotPassword } from '../../lib/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import HeroCarousel from './HeroCarousel'

const HERO_IMAGES = [
  '/images/hospital-1.webp',
  '/images/hospital-2.webp',
  '/images/hospital-3.webp',
  '/images/hospital-4.webp',
]

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
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* Hero panel */}
      <div className="h-[30vh] md:h-auto md:w-[55%] flex-shrink-0 relative">
        <HeroCarousel images={HERO_IMAGES} />
      </div>

      {/* Form panel */}
      <div className="flex-1 bg-white flex flex-col items-center justify-center px-8 py-10">
        <div className="w-full max-w-[480px]">

          {/* Brand header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <img
              src="/images/akuh-logo-urdu.png"
              alt="Aga Khan University Hospital Logo"
              className="h-16 object-contain"
            />
            <div className="h-px w-full bg-slate-100" />
            <div className="text-center">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-1">
                The Aga Khan University Hospital
              </p>
              <h1 className="text-xl font-bold text-text tracking-tight leading-tight">
                Reset Your Password
              </h1>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mt-1">
                Smart Stock Alert · AKUH Network Portal
              </p>
            </div>
          </div>

          {submitted ? (
            /* Confirmation screen */
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center">
                <CheckCircle2 size={28} className="text-success-dark" />
              </div>
              <div>
                <p className="font-bold text-text text-base">Check your email</p>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">
                  If that email is registered, a reset link has been sent.<br />
                  The link expires in 30 minutes and works only once.
                </p>
              </div>
              <Link
                to="/login"
                className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          ) : (
            /* Email form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <p className="text-sm text-text-muted leading-relaxed">
                Enter your account email address and we'll send you a link to reset your password.
              </p>
              <Input
                id="forgot-email"
                label="Email Address"
                type="email"
                placeholder="username@akuh.pilot"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />

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
                className="w-full font-bold uppercase tracking-wider text-xs py-3"
                disabled={loading || !email}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
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
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-text-muted hover:text-text transition-colors"
              >
                <ArrowLeft size={13} /> Back to Sign In
              </Link>
            </form>
          )}

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 mt-8">
            <Shield size={11} className="text-text-muted/50 flex-shrink-0" aria-hidden="true" />
            <p className="text-[10px] uppercase font-bold tracking-wider text-text-muted/60">
              Official System — Aga Khan University Hospital Network
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}
