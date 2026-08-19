import { Component, useEffect, useState, type ReactNode } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { onPermissionDenied } from '../api/permissionNotice'
import { useAuth } from '../hooks/useAuth'
import Logo from './Logo'

class PageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-sm text-[#6e6e73]">This page failed to load.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 text-xs text-violet-600 hover:text-violet-700"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

interface NavItem {
  label: string
  path: string
  module: string
  icon: ReactNode
}

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
)

const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M3 7v14M21 7v14M6 21V7M18 21V7M3 7l9-4 9 4M9 21v-4h6v4"/>
  </svg>
)

const BriefcaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v4M10 14h4"/>
  </svg>
)

const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-3 3"/>
  </svg>
)

const ReportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
)

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', module: 'dashboard', icon: <GridIcon /> },
  { label: 'Business', path: '/business', module: 'business', icon: <BuildingIcon /> },
  { label: 'Deals', path: '/deals', module: 'deals', icon: <BriefcaseIcon /> },
  { label: 'Finance', path: '/finance', module: 'finance', icon: <ChartIcon /> },
  { label: 'Reports', path: '/reports', module: 'reports', icon: <ReportIcon /> },
  { label: 'Users', path: '/users', module: 'users', icon: <UsersIcon /> },
]

export default function Layout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, hasAccess, isLoading } = useAuth()
  const [permissionMessage, setPermissionMessage] = useState('')

  useEffect(() => {
    return onPermissionDenied((message) => setPermissionMessage(message))
  }, [])

  useEffect(() => {
    if (!permissionMessage) return
    const timer = window.setTimeout(() => setPermissionMessage(''), 5000)
    return () => window.clearTimeout(timer)
  }, [permissionMessage])

  const filtered = isLoading
    ? navItems
    : navItems.filter((item) => hasAccess(item.module))
  const items =
    filtered.length > 0 ? filtered : navItems.filter((item) => item.module === 'dashboard')

  const handleLogout = () => {
    const refresh = localStorage.getItem('refresh_token')
    if (refresh) authApi.logout(refresh).catch(() => {})
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    queryClient.removeQueries({ queryKey: ['me'] })
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#f5f5f7] text-[#1a1a1a] overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-60 flex flex-col border-r border-[#e5e5ea] bg-white shadow-sm shrink-0">

        {/* Logo area */}
        <div className="px-5 py-5 border-b border-[#e5e5ea]">
          <Logo height={36} className="max-w-full" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-widest px-3 mb-2">
            MENU
          </p>
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-violet-50 text-violet-600 font-medium'
                    : 'text-[#6e6e73] hover:text-[#1a1a1a] hover:bg-[#f5f5f7]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-violet-600' : 'text-[#aeaeb2]'}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-[#e5e5ea] space-y-1">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-medium text-[#1a1a1a] truncate">{user.name}</p>
              <p className="text-[10px] text-[#6e6e73] truncate">{user.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#6e6e73] hover:text-[#1a1a1a] hover:bg-[#f5f5f7] transition-all duration-150"
          >
            <span className="text-[#aeaeb2]"><LogoutIcon /></span>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-14 border-b border-[#e5e5ea] px-6 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-[#6e6e73]">Live</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#aeaeb2] font-mono">
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </header>

        {permissionMessage ? (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800">{permissionMessage}</p>
          </div>
        ) : null}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#f5f5f7]">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>

    </div>
  )
}
