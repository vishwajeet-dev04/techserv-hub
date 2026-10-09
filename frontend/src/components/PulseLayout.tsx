import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Menu, Settings, X } from 'lucide-react'
import { dashboardApi } from '../api/dashboard'
import { useAuth } from '../hooks/useAuth'
import Logo from './Logo'
import UniversalCalendar from './UniversalCalendar'
import ThemeToggle from './ThemeToggle'
import WorkspaceChip from './WorkspaceChip'
import { useDateRange } from '../hooks/useDateRange'

const navGroups: { label: string; items: { to: string; label: string; end?: boolean }[] }[] = [
  {
    label: 'Deal-to-Billing Ops',
    items: [
      { to: '/pulse/summary', label: 'Summary' },
      { to: '/pulse/po-contracts', label: 'PO & Contracts' },
    ],
  },
  {
    label: 'CRM',
    items: [
      { to: '/pulse/opportunities', label: 'Opportunities' },
      { to: '/pulse/reminders', label: 'Reminders' },
      { to: '/pulse/team', label: 'Team Performance' },
      { to: '/pulse/contacts', label: 'Contacts' },
    ],
  },
]

const PAGE_TITLES: Record<string, string> = {
  '/pulse/contacts': 'Contacts',
  '/pulse/opportunities': 'Opportunities',
  '/pulse/reminders': 'Reminders',
  '/pulse/team': 'Team Performance',
  '/pulse/summary': 'Ops Summary',
  '/pulse/po-contracts': 'PO & Contracts',
}

const DATE_RANGE_PATHS = ['/pulse/team', '/pulse/summary', '/pulse/po-contracts']

function pageTitleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/pulse/po-contracts/')) return 'PO & Contracts'
  return 'Pulse CRM'
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

const iconBtn =
  'w-10 h-10 sm:w-9 sm:h-9 rounded-xl border border-line text-muted hover:text-ink hover:bg-canvas flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shrink-0'

export default function PulseLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, hasAccess } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: dashboardApi.getAlerts })
  const alertCount = alerts.data?.total_alerts ?? 0
  const pageTitle = pageTitleFor(location.pathname)
  const showDateRange = DATE_RANGE_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  )
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

  const sidebarBody = (
    <>
      <div className="px-4 py-5 border-b border-line flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Logo height={28} className="mb-3" />
          <p className="text-sm font-semibold text-ink">Pulse CRM</p>
          <p className="text-[10px] text-muted mt-1 leading-snug">Enterprise Opportunity Management</p>
        </div>
        <button
          type="button"
          className="md:hidden p-2 rounded-lg text-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        >
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-brand px-3 mb-1 opacity-80">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2.5 text-[13px] ${
                    isActive
                      ? 'bg-brand-soft text-brand font-semibold'
                      : 'text-muted hover:bg-canvas hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-line">
        <div className="pb-3 lg:hidden">
          <WorkspaceChip className="flex w-full" />
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full text-left text-xs text-muted hover:text-brand mb-3 py-1"
        >
          Back to home
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center text-xs font-semibold shrink-0">
            {initials(user?.name ?? 'U')}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink truncate">{user?.name ?? 'User'}</p>
            {role ? <p className="text-[10px] text-muted uppercase tracking-wide">{role}</p> : null}
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-transparent text-ink overflow-hidden">
      <aside className="hidden md:flex w-60 shrink-0 bg-surface/90 backdrop-blur-md border-r border-line flex-col">
        {sidebarBody}
      </aside>

      {navOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu backdrop"
            onClick={() => setNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] flex flex-col bg-surface/95 backdrop-blur-md border-r border-line shadow-xl">
            {sidebarBody}
          </aside>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-14 bg-surface/90 backdrop-blur-md border-b border-line px-3 sm:px-6 py-2 flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              className="md:hidden p-2.5 rounded-lg text-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
            >
              <Menu className="w-5 h-5" strokeWidth={2} />
            </button>
            <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
              <Link to="/" className="text-muted hover:text-brand shrink-0">
                Home
              </Link>
              <span className="text-subtle shrink-0">/</span>
              <span className="font-medium text-ink truncate">{pageTitle}</span>
            </nav>
            <WorkspaceChip className="hidden lg:inline-flex ml-2" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle />
            {hasAccess('users') ? (
              <Link to="/settings/users" title="Settings" aria-label="Settings" className={iconBtn}>
                <Settings className="w-4 h-4" strokeWidth={2} />
              </Link>
            ) : null}
            <button type="button" title="Notifications" aria-label="Notifications" className={`relative ${iconBtn}`}>
              <Bell className="w-4 h-4" strokeWidth={2} />
              {alertCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] leading-4 text-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              ) : null}
            </button>
            <div
              className="hidden sm:flex w-9 h-9 rounded-full bg-brand-soft text-brand items-center justify-center text-xs font-semibold shrink-0"
              title={user?.name ?? 'User'}
            >
              {initials(user?.name ?? 'U')}
            </div>
          </div>
          {showDateRange ? (
            <div className="order-last w-full sm:order-none sm:w-auto flex justify-end">
              <UniversalCalendar from={from} to={to} onChange={setRange} compact />
            </div>
          ) : null}
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
