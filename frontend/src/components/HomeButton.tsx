import { useLocation, useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function HomeButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const atHome = location.pathname === '/'

  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 sm:py-1.5 rounded-full text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        atHome ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink hover:bg-canvas'
      }`}
    >
      <Home className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
      Home
    </button>
  )
}
