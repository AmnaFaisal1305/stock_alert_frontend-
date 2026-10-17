import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { forgotPassword } from '../../lib/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { AuthShell, FormAlert } from './LoginPage'

const backLink = 'inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2'

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
    <AuthShell
      title="Reset your password"
      subtitle={submitted ? undefined : 'Enter your account email and we’ll send you a reset link.'}
    >
      {submitted ? (
        <div className="flex flex-col gap-6">
          <div role="status" className="flex items-start gap-3 rounded-control bg-success-bg px-4 py-3.5 text-success-dark">
            <CheckCircle2 size={18} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Check your email</p>
              <p className="text-sm mt-1">
                If that address is registered, a reset link has been sent. The link expires in 30 minutes and works only once.
              </p>
            </div>
          </div>
          <Link to="/login" className={backLink}><ArrowLeft size={14} strokeWidth={1.75} /> Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="forgot-email"
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
          {error && <FormAlert>{error}</FormAlert>}
          <Button type="submit" size="lg" className="w-full mt-1" disabled={loading || !email}>
            {loading ? 'Sending link…' : 'Send reset link'}
          </Button>
          <Link to="/login" className={`${backLink} self-center`}><ArrowLeft size={14} strokeWidth={1.75} /> Back to sign in</Link>
        </form>
      )}
    </AuthShell>
  )
}
