import { type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartTick, tooltipProps } from '../lib/chartTheme'
import { pulseApi } from '../api/pulse'
import { getErrorMessage } from '../api/errors'
import { useAuth } from '../hooks/useAuth'
import { btnSecondaryClass } from '../components/Modal'
import PulsePageHeader from '../components/pulse/PulsePageHeader'
import PulseTableShell, { PulseTableHead } from '../components/pulse/PulseTableShell'
import { useDateRange } from '../hooks/useDateRange'
import type { PulseTeamRep } from '../types'

const AVATAR_COLORS = [
  'from-violet-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-blue-500 to-cyan-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
] as const

function fmtCompact(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
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

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconTrend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconTrophy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 9h2a3 3 0 0 0 0-6h-2" />
      <path d="M7 9H5a3 3 0 0 1 0-6h2" />
    </svg>
  )
}

function IconValue() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function IconBars() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

export default function OpsTeam() {
  const { hasAccess } = useAuth()
  const queryClient = useQueryClient()
  const { from: dateFrom, to: dateTo } = useDateRange()
  const allowed = hasAccess('pulse')
  const periodHint = 'In selected range'

  const team = useQuery({
    queryKey: ['pulse-team', dateFrom, dateTo],
    queryFn: () => pulseApi.team({ from: dateFrom, to: dateTo }),
    enabled: allowed,
  })

  if (!allowed) {
    return <p className="p-4 sm:p-6 text-sm text-muted">Pulse CRM is not available for this role.</p>
  }

  if (team.isLoading) {
    return <p className="p-4 sm:p-6 text-sm text-muted">Loading team performance…</p>
  }

  if (team.isError || !team.data) {
    return (
      <p className="p-4 sm:p-6 text-sm text-danger">
        {getErrorMessage(team.error, 'Could not load team performance.')}
      </p>
    )
  }

  const data = team.data
  const rows = data.by_rep
  const chartHeight = Math.max(240, rows.length * 32)

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6 min-w-0">
      <PulsePageHeader
        title="Team Performance"
        subtitle="Opportunities by assigned rep, filtered by created date."
        actions={
          <button
            type="button"
            className={btnSecondaryClass}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['pulse-team'] })
            }}
          >
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Active Reps" value={String(data.active_reps)} sub={periodHint} icon={<IconUsers />} edge="brand" />
        <Kpi label="Total Prospects" value={String(data.total_leads)} sub={periodHint} icon={<IconTrend />} edge="brand" />
        <Kpi label="Top Rep" value={data.top_rep || '—'} sub={periodHint} icon={<IconTrophy />} edge="emerald" />
        <Kpi label="Total Won Value" value={fmtCompact(data.total_won_value)} sub={periodHint} icon={<IconValue />} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Leads per rep" icon={<IconBars />}>
          {rows.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="rounded-xl bg-canvas p-2">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis type="number" tick={chartTick} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={chartTick} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="total_leads" name="Leads" fill="var(--color-brand)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
        <ChartCard title="Won deal value per rep" icon={<IconValue />}>
          {rows.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="rounded-xl bg-canvas p-2">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis type="number" tick={chartTick} tickFormatter={(v) => fmtCompact(Number(v))} />
                  <YAxis type="category" dataKey="name" width={120} tick={chartTick} />
                  <Tooltip {...tooltipProps} formatter={(value) => fmtMoney(Number(value))} />
                  <Bar dataKey="won_value" name="Won value" fill="var(--color-chart-3)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm px-4 py-8">
          <p className="text-sm text-muted text-center">No opportunities in this created-date range.</p>
        </div>
      ) : (
        <PulseTableShell title="Rep performance summary" count={rows.length} minWidth="min-w-[720px]">
          <PulseTableHead>
            {['Rep name', 'Total Prospects', 'Converted', 'Win rate %', 'Deal value won'].map((h) => (
              <th key={h} className="px-4 py-3 font-medium">{h}</th>
            ))}
          </PulseTableHead>
          <tbody>
            {rows.map((row) => (
              <RepRow key={row.name} row={row} />
            ))}
          </tbody>
        </PulseTableShell>
      )}
    </div>
  )
}

function RepRow({ row }: { row: PulseTeamRep }) {
  const initials = getInitials(row.name) || '?'
  const avatarColor = AVATAR_COLORS[(row.name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
  return (
    <tr className="group border-b border-canvas hover:bg-brand-soft/50 transition-colors">
      <td className="px-4 py-3 border-l-[3px] border-l-transparent group-hover:border-l-brand">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColor} text-white text-[10px] font-semibold flex items-center justify-center shrink-0`}>
            {initials}
          </span>
          <span className="font-medium text-ink truncate">{row.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-ink">{row.total_leads}</td>
      <td className="px-4 py-3 text-muted">{row.converted}</td>
      <td className="px-4 py-3 text-muted">{row.win_rate}%</td>
      <td className="px-4 py-3 text-ink whitespace-nowrap">{fmtMoney(row.won_value)}</td>
    </tr>
  )
}

function Kpi({
  label,
  value,
  sub,
  icon,
  edge,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  edge?: 'brand' | 'emerald'
  accent?: boolean
}) {
  if (accent) {
    return (
      <div className="relative rounded-2xl p-5 border overflow-hidden shadow-sm bg-gradient-to-br from-violet-500 to-purple-600 border-violet-500 kpi-shine">
        <div className="flex items-center gap-2 text-violet-100">
          <span className="w-8 h-8 rounded-xl bg-surface/15 flex items-center justify-center">{icon}</span>
          <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-2xl font-semibold mt-3 leading-none text-white truncate">{value}</p>
        {sub ? <p className="text-xs mt-1.5 text-violet-100">{sub}</p> : null}
      </div>
    )
  }
  const top = edge === 'emerald' ? 'border-t-emerald-500' : 'border-t-brand'
  const iconWrap = edge === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300' : 'bg-brand-soft text-brand'
  return (
    <div className={`rounded-2xl p-5 border border-line bg-surface/80 backdrop-blur-md shadow-sm border-t-2 ${top}`}>
      <div className="flex items-center gap-2">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconWrap}`}>{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className="text-2xl font-semibold mt-3 leading-none text-ink truncate">{value}</p>
      {sub ? <p className="text-xs mt-1.5 text-subtle">{sub}</p> : null}
    </div>
  )
}

function ChartCard({ title, icon, children }: { title: string; icon: ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center">{icon}</span>
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return <p className="text-sm text-muted py-16 text-center">No records in this created-date range.</p>
}
