import { Component, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Menu, Settings, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { endSession } from '../lib/session'
import Logo from './Logo'
import HomeButton from './HomeButton'
import ThemeToggle from './ThemeToggle'
import UniversalCalendar from './UniversalCalendar'
import { useDateRange } from '../hooks/useDateRange'

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
            <p className="text-sm font-medium text-muted">This page failed to load.</p>
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

const BriefcaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v4M10 14h4"/>
  </svg>
)

const FunnelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 4h18l-7 8v6l-4 2v-8z" />
  </svg>
)

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const navItems: NavItem[] = [
  { label: 'Summary', path: '/ops', module: 'dashboard', icon: <GridIcon /> },
  { label: 'Pipeline', path: '/ops/pipeline', module: 'pulse', icon: <FunnelIcon /> },
  { label: 'PO & Contracts', path: '/deals', module: 'deals', icon: <BriefcaseIcon /> },
]

const financeNav = {
  main: [
    { label: 'Dashboard', path: '/finance' },
    { label: 'Cashflow', path: '/finance/cashflow' },
    { label: 'Clients', path: '/finance/clients' },
    { label: 'Payables', path: '/finance/payables' },
    { label: 'PO Management', path: '/finance/purchase-orders' },
    { label: 'Receivable', path: '/finance/invoices' },
    { label: 'Compliance Calendar', path: '/finance/compliance' },
  ],
  capital: [
    { label: 'Investments Received', path: '/finance/capital/investments-received' },
    { label: 'Investments Made', path: '/finance/capital/investments-made' },
    { label: 'Loans Provided', path: '/finance/capital/loans-provided' },
    { label: 'Loans Taken', path: '/finance/capital/loans-taken' },
  ],
  system: [
    { label: 'MIS Upload', path: '/finance/mis' },
    { label: 'Reports', path: '/reports' },
  ],
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

export default function Layout() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user, hasAccess, isLoading } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const techpay = location.pathname.startsWith('/finance')
  const showDateRange =
    location.pathname === '/ops' ||
    location.pathname === '/ops/pipeline' ||
    location.pathname === '/deals' ||
    location.pathname.startsWith('/deals/') ||
    location.pathname.startsWith('/finance') ||
    location.pathname === '/reports'
  const { from, to, setRange } = useDateRange()

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const filtered = isLoading
    ? navItems
    : navItems.filter((item) => hasAccess(item.module))
  const items =
    filtered.length > 0 ? filtered : navItems.filter((item) => item.module === 'dashboard')

  const handleLogout = () => {
    void endSession(queryClient)
  }

  const initials = getInitials(user?.name ?? '') || 'U'

  const sidebarBody = (
    <>
      <div className="px-5 py-5 border-b border-line flex items-center justify-between gap-2">
        <Logo height={36} className="max-w-full" />
        <button
          type="button"
          className="md:hidden p-2 rounded-lg text-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        >
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {techpay ? (
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          <p className="px-3 pb-3 text-[12px] font-semibold text-brand">Financial Control</p>
          {(['main', 'capital', 'system'] as const).map((group) => (
            <div key={group} className="mb-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-brand px-[14px] mb-1 opacity-80">
                {group}
              </p>
              {financeNav[group].map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/finance'}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] border-l-[3px] ${
                      isActive
                        ? 'bg-brand-soft text-brand font-semibold border-l-brand'
                        : 'text-muted hover:bg-canvas border-l-transparent'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      ) : (
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-medium text-brand uppercase tracking-[0.12em] px-3 mb-2 opacity-80">
            Deal-to-Billing Ops
          </p>
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/ops'}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors duration-150 border-l-[3px] ${
                  isActive
                    ? 'bg-brand-soft text-brand font-semibold border-l-brand'
                    : 'text-muted hover:text-ink hover:bg-canvas border-l-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-brand' : 'text-subtle'}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      <div className="px-3 py-4 border-t border-line space-y-1">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-brand-soft text-brand text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink truncate">{user.name}</p>
              <p className="text-xs text-subtle truncate">{user.role}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          title="Log out"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted hover:text-ink hover:bg-canvas transition-colors duration-150"
        >
          <span className="text-subtle"><LogoutIcon /></span>
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-transparent text-ink overflow-hidden print:h-auto print:overflow-visible">
      <aside className="hidden md:flex w-56 flex-col border-r border-line bg-surface/90 backdrop-blur-md shadow-sm shrink-0 print:hidden">
        {sidebarBody}
      </aside>

      {navOpen ? (
        <div className="fixed inset-0 z-40 md:hidden print:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu backdrop"
            onClick={() => setNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] flex flex-col bg-surface/95 backdrop-blur-md shadow-xl">
            {sidebarBody}
          </aside>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="min-h-14 border-b border-line px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-surface/90 backdrop-blur-md print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
            >
              <Menu className="w-5 h-5" strokeWidth={2} />
            </button>
            <HomeButton />
          </div>
          <div className="flex items-center gap-2 min-w-0 max-w-full overflow-x-auto">
            <ThemeToggle />
            {hasAccess('users') ? (
              <Link
                to="/settings"
                title="Settings"
                aria-label="Settings"
                className="w-9 h-9 rounded-xl text-muted hover:text-ink hover:bg-canvas flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shrink-0"
              >
                <Settings className="w-4 h-4" strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
            {showDateRange ? (
              <UniversalCalendar from={from} to={to} onChange={setRange} compact />
            ) : (
              <span className="text-xs text-subtle font-mono whitespace-nowrap">
                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent print:overflow-visible">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  )
}
