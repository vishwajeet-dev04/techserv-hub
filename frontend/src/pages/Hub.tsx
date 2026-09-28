import { Link } from 'react-router-dom'
import { ArrowRight, FileText, GitBranch, LayoutDashboard, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import type { ReactNode } from 'react'

type Theme = 'green' | 'blue' | 'rose' | 'purple'

const cards: {
  module: 'dashboard' | 'deals' | 'finance' | 'pulse'
  to: string
  title: string
  body: string
  icon: ReactNode
  theme: Theme
}[] = [
  {
    module: 'dashboard',
    to: '/summary',
    title: 'Executive Summary',
    body: 'Company snapshot across deals, pipeline, and financial control.',
    icon: <LayoutDashboard className="w-5 h-5" strokeWidth={2} />,
    theme: 'purple',
  },
  {
    module: 'deals',
    to: '/ops',
    title: 'Deals to Billing Ops',
    body: 'Pipeline, companies, and won deals into operations.',
    icon: <GitBranch className="w-5 h-5" strokeWidth={2} />,
    theme: 'green',
  },
  {
    module: 'finance',
    to: '/finance',
    title: 'Financial Control',
    body: 'Cashflow, POs, invoices, payables, and capital.',
    icon: <FileText className="w-5 h-5" strokeWidth={2} />,
    theme: 'blue',
  },
  {
    module: 'pulse',
    to: '/pulse',
    title: 'Pulse CRM',
    body: 'Contacts, opportunities, and reminders.',
    icon: <Users className="w-5 h-5" strokeWidth={2} />,
    theme: 'rose',
  },
]

const THEME: Record<Theme, { tile: string; icon: string; arrow: string; hover: string }> = {
  purple: {
    tile: 'bg-violet-100 dark:bg-violet-950/50',
    icon: 'text-violet-700 dark:text-violet-300',
    arrow:
      'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 group-hover:bg-violet-600 group-hover:text-white',
    hover: 'hover:border-violet-200 dark:hover:border-violet-800 hover:shadow-md',
  },
  green: {
    tile: 'bg-emerald-100 dark:bg-emerald-950/50',
    icon: 'text-emerald-700 dark:text-emerald-300',
    arrow:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white',
    hover: 'hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-md',
  },
  blue: {
    tile: 'bg-sky-100 dark:bg-sky-950/50',
    icon: 'text-sky-700 dark:text-sky-300',
    arrow:
      'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 group-hover:bg-sky-600 group-hover:text-white',
    hover: 'hover:border-sky-200 dark:hover:border-sky-800 hover:shadow-md',
  },
  rose: {
    tile: 'bg-rose-100 dark:bg-rose-950/50',
    icon: 'text-rose-700 dark:text-rose-300',
    arrow:
      'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 group-hover:bg-rose-600 group-hover:text-white',
    hover: 'hover:border-rose-200 dark:hover:border-rose-800 hover:shadow-md',
  },
}

export default function Hub() {
  const { hasAccess, isLoading, role, user } = useAuth()
  const visible = cards.filter((card) => hasAccess(card.module))

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="relative z-10 px-4 sm:px-6 md:px-10 py-10 sm:py-14 max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand/70">Home</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Workspaces'}
          </h1>
          <p className="mt-1 text-sm text-muted">Choose a workspace to continue.</p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted">Loading workspaces…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted">
            {user && role
              ? `No workspaces available for role ${role}.`
              : 'Could not load your account. Is the API running, and are you still logged in?'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visible.map((card) => {
              const theme = THEME[card.theme]
              return (
                <Link
                  key={card.to}
                  to={card.to}
                  className={`group flex items-start gap-4 bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm transition-all ${theme.hover}`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl ${theme.tile} ${theme.icon} flex items-center justify-center shrink-0`}
                  >
                    {card.icon}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2 className="text-base font-semibold text-ink">{card.title}</h2>
                    <p className="text-sm text-muted mt-1 leading-relaxed">{card.body}</p>
                  </div>
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors mt-1 ${theme.arrow}`}
                    aria-hidden
                  >
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
