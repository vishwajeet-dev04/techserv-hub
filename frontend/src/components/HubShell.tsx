import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { endSession } from '../lib/session'
import Logo from './Logo'
import HomeButton from './HomeButton'
import ThemeToggle from './ThemeToggle'
import WorkspaceChip from './WorkspaceChip'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

export default function HubShell() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user, hasAccess } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)
  const selecting = location.pathname.startsWith('/select-company')
  const showHome = location.pathname !== '/' && !selecting

  useEffect(() => {
    if (!profileOpen) return
    const onPointer = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    // Use click (not mousedown) so Logout's click handler wins the race.
    document.addEventListener('click', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [profileOpen])

  const handleLogout = () => {
    if (loggingOut) return
    setLoggingOut(true)
    setProfileOpen(false)
    void endSession(queryClient)
  }

  return (
    <div className="min-h-screen bg-transparent text-ink flex flex-col">
      <header className="relative z-50 h-16 bg-surface/90 backdrop-blur-md border-b border-line px-4 sm:px-6 md:px-10 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <Logo height={34} className="shrink-0 hidden min-[420px]:block" />
          <Logo height={28} className="shrink-0 min-[420px]:hidden" />
          {showHome ? <HomeButton /> : null}
          {!selecting ? <WorkspaceChip className="hidden sm:inline-flex" /> : null}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle />
          {hasAccess('users') && !selecting ? (
            <Link
              to="/settings/users"
              title="Settings"
              aria-label="Settings"
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl text-muted hover:text-ink hover:bg-canvas flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Settings className="w-4 h-4" strokeWidth={2} aria-hidden />
            </Link>
          ) : null}

          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-xl px-1.5 sm:px-2 py-1.5 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <span className="w-8 h-8 rounded-full bg-brand-soft text-brand text-[11px] font-semibold flex items-center justify-center shrink-0">
                  {initials(user.name)}
                </span>
                <span className="hidden sm:block text-sm font-medium text-ink truncate max-w-[10rem]">
                  {user.name}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>

              {profileOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 z-50 min-w-[200px] rounded-xl border border-line bg-surface shadow-lg py-1"
                >
                  <div className="px-3 py-2 border-b border-canvas sm:hidden">
                    <p className="text-xs font-medium text-ink truncate">{user.name}</p>
                    <p className="text-[11px] text-muted">{user.role}</p>
                  </div>
                  {!selecting ? (
                    <div className="px-2 py-1.5 border-b border-canvas sm:hidden" onClick={() => setProfileOpen(false)}>
                      <WorkspaceChip className="flex w-full" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={loggingOut}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleLogout()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-ink hover:bg-canvas text-left disabled:opacity-50"
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                    {loggingOut ? 'Signing out…' : 'Logout'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
