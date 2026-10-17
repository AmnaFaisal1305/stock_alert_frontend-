import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { resetPasswordByToken } from '../../lib/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import HeroCarousel from './HeroCarousel'
import { AuthShell, FormAlert } from './LoginPage'

const HERO_IMAGES = [
  '/images/hospital-1.webp',
  '/images/hospital-2.webp',
  '/images/hospital-3.webp',
  '/images/hospital-4.webp',
]

const link = 'inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPasswordByToken(token, password)
      setDone(true)
    } catch (err) {
      if (err.status === 429) {
        setError('Too many requests. Please wait a few minutes and try again.')
      } else if (err.status === 400) {
        setError(err.message ?? 'Invalid or expired token. Please request a new reset link.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const expired = error.toLowerCase().includes('invalid') || error.toLowerCase().includes('expired')

  return (
    <AuthShell
      title="Set a new password"
      subtitle={token && !done ? 'At least 8 characters.' : undefined}
      aside={<HeroCarousel images={HERO_IMAGES} />}
    >
      {!token && (
        <div className="flex flex-col gap-5">
          <FormAlert>This link is missing a reset token. Request a new one.</FormAlert>
          <Link to="/forgot-password" className={link}>Request a new reset link</Link>
        </div>
      )}

      {token && done && (
        <div className="flex flex-col gap-6">
          <div role="status" className="flex items-start gap-3 rounded-control bg-success-bg px-4 py-3.5 text-success-dark">
            <CheckCircle2 size={18} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Password reset</p>
              <p className="text-sm mt-1">Your password has been updated. Sign in with your new password.</p>
            </div>
          </div>
          <Link to="/login" className={link}><ArrowLeft size={14} strokeWidth={1.75} /> Go to sign in</Link>
        </div>
      )}

      {token && !done && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="new-password"
            label="New password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            className="h-11"
            autoComplete="new-password"
            autoFocus
            required
          />
          {error && (
            <FormAlert>
              {error}
              {expired && <> <Link to="/forgot-password" className="underline font-medium">Request a new link</Link></>}
            </FormAlert>
          )}
          <Button type="submit" size="lg" className="w-full mt-1" disabled={loading || password.length < 8}>
            {loading ? 'Saving…' : 'Set new password'}
          </Button>
          <Link to="/login" className={`${link} self-center`}><ArrowLeft size={14} strokeWidth={1.75} /> Back to sign in</Link>
        </form>
      )}
    </AuthShell>
  )
}
