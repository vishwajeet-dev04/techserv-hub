import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react'
import { authApi } from '../api/auth'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'

function BrandArt() {
  return (
    <div className="relative w-full max-w-[280px] mx-auto aspect-square">
      {/* Soft curved shelf */}
      <div
        className="absolute inset-x-[-10%] bottom-[8%] h-[42%] rounded-[50%] bg-white/20 blur-[1px]"
        aria-hidden
      />
      <div
        className="absolute inset-x-[5%] bottom-[18%] h-[28%] rounded-[50%] bg-gradient-to-t from-white/30 to-transparent"
        aria-hidden
      />
      {/* Official mark: square · circle / circle · square */}
      <div className="absolute left-1/2 top-[28%] -translate-x-1/2 grid grid-cols-2 gap-3 w-[160px]">
        <div className="w-[72px] h-[72px] rounded-md bg-[#5000FE] shadow-lg shadow-[#5000FE]/40" />
        <div className="w-[72px] h-[72px] rounded-full bg-[#5000FE]/90 shadow-lg shadow-[#5000FE]/25" />
        <div className="w-[72px] h-[72px] rounded-full bg-[#9664FA]/85" />
        <div className="w-[72px] h-[72px] rounded-md bg-[#9664FA]" />
      </div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login({ email, password })
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      queryClient.setQueryData(['me'], data.user)
      navigate('/')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      {/* Left brand panel */}
      <aside className="hidden lg:flex relative z-10 flex-col overflow-hidden bg-gradient-to-br from-[#5000FE] via-[#7c3aed] to-[#9664FA] p-8 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.25),transparent_55%)]" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.12),transparent_50%)]" aria-hidden />
        <div className="relative z-10">
          <Logo height={40} className="brightness-0 invert" />
        </div>
        <div className="relative z-10 flex-1 flex items-end justify-center pb-16">
          <BrandArt />
        </div>
      </aside>

      {/* Right form panel */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-8 sm:p-10 shadow-sm">
            <div className="flex justify-center mb-8">
              <Logo height={56} />
            </div>

            {error ? (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="sr-only">
                  Email
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="Email"
                    className="w-full bg-surface border border-line rounded-xl pl-10 pr-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-2 focus-visible:ring-brand transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Password"
                    className="w-full bg-surface border border-line rounded-xl pl-10 pr-10 py-2.5 text-sm text-ink placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-2 focus-visible:ring-brand transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" strokeWidth={2} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-brand to-[#a78bfa] hover:from-brand-hover hover:to-brand shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {loading ? 'Signing in…' : 'Sign In'}
                {!loading ? <ArrowRight className="w-4 h-4" strokeWidth={2} aria-hidden /> : null}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-subtle">TechServ.ai — Internal Use Only</p>
        </div>
      </div>
    </div>
  )
}
