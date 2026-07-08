import { useState } from 'react'
import { Syringe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import * as api from '../../lib/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function LoginPage() {
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email, password)
      // Set auth state — LoginRoute's <Navigate> handles the redirect once re-rendered
      login(data.user, data.csrfToken)
    } catch (err) {
      if (err.status === 401) setError('Invalid email or password.')
      else if (err.status === 429) setError('Too many login attempts. Please wait a few minutes and try again.')
      else setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="bg-white rounded-2xl border border-surface-border p-8 sm:p-10 shadow-xl">
          {/* Brand Logo & Header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <img src="/akuh-logo-urdu.png" alt="Aga Khan University Hospital Logo" className="h-16 object-contain" />
            <div className="h-px w-full bg-slate-100 my-1" />
            <div className="text-center">
              <h1 className="text-lg font-bold text-text tracking-tight">Smart Stock Alert</h1>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mt-1">AKUH Network Portal</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="username@akuh.pilot"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </div>

        <p className="text-center text-[10px] uppercase font-bold tracking-wider text-text-muted/80 mt-6">
          Official System — Aga Khan University Hospital Network
        </p>
      </div>
    </div>
  )
}
