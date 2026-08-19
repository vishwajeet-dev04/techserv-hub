import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import Logo from '../components/Logo'

export default function Login() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Logo height={64} className="block mx-auto mb-5" />
          <h1 className="text-xl font-semibold text-[#1a1a1a]">TechServ Hub</h1>
          <p className="text-sm text-[#6e6e73] mt-1">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#e5e5ea] rounded-2xl p-8 shadow-sm">

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-xs font-medium text-[#3a3a3c] mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@techserv.ai"
                className="w-full px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-xl text-sm text-[#1a1a1a] placeholder-[#aeaeb2] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3a3a3c] mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-xl text-sm text-[#1a1a1a] placeholder-[#aeaeb2] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

          </form>
        </div>

        <p className="text-center text-xs text-[#aeaeb2] mt-6">
          TechServ.ai — Internal Use Only
        </p>
      </div>
    </div>
  )
}
