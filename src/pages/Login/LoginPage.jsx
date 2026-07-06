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
    <div className="min-h-screen bg-surface-alt flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-surface rounded-2xl shadow-sm border border-surface-border p-8">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Syringe size={28} className="text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-text">Vaccine Stock Alert</h1>
              <p className="text-sm text-text-muted mt-0.5">Sign in to your account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@akuh.org"
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
              <p className="text-sm text-danger bg-danger-bg px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full mt-1"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-text-muted mt-4">
          Aga Khan University Hospital — Internal System
        </p>
      </div>
    </div>
  )
}
