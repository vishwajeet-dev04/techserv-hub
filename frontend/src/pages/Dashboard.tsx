import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { pulseApi } from '../api/pulse'
import { getErrorMessage } from '../api/errors'
import { useAuth } from '../hooks/useAuth'
import { btnSecondaryClass } from '../components/Modal'
import { useDateRange } from '../hooks/useDateRange'
import type { PulseFunnelStep } from '../types'

const chartTick = { fontSize: 11, fill: 'var(--color-muted)' }
const tooltipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 1px 2px rgb(0 0 0 / 0.06)',
}
const PILLAR_COLORS = ['#7c3aed', '#059669', '#f59e0b', '#2563eb', '#db2777', '#0d9488', '#ea580c']
const FUNNEL_COLORS = ['#7c3aed', '#2563eb', '#059669', '#0f766e']

type VolumeTab = 'leads' | 'revenue' | 'winloss'
type RevenueMode = 'win' | 'closed' | 'both'

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

function fmtWeek(week: string) {
  const parsed = new Date(`${week}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return week
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function priorLabel(current: number, prior: number | null, kind: 'money' | 'percent' | 'count') {
  if (prior === null) return 'No prior data'
  if (prior === 0 && current === 0) return 'No change vs prior'
  if (prior === 0) return 'New vs prior period'
  const pct = Math.round(((current - prior) / Math.abs(prior)) * 100)
  const sign = pct > 0 ? '+' : ''
  const priorText =
    kind === 'money' ? fmtCompact(prior) : kind === 'percent' ? `${prior}%` : String(prior)
  return `${sign}${pct}% vs prior (${priorText})`
}

export default function Dashboard() {
  const { hasAccess } = useAuth()
  const queryClient = useQueryClient()
  const { from: dateFrom, to: dateTo } = useDateRange()
  const [volumeTab, setVolumeTab] = useState<VolumeTab>('leads')
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('both')
  const allowed = hasAccess('pulse')
  const periodHint = 'In selected range'

  const executive = useQuery({
    queryKey: ['pulse-executive', dateFrom, dateTo],
    queryFn: () => pulseApi.executive({ from: dateFrom, to: dateTo }),
    enabled: allowed,
  })

  if (!allowed) {
    return <p className="p-6 text-sm text-muted">Pulse CRM is not available for this role.</p>
  }

  if (executive.isLoading) {
    return <p className="p-6 text-sm text-muted">Loading executive summary…</p>
  }

  if (executive.isError || !executive.data) {
    return (
      <p className="p-6 text-sm text-danger">
        {getErrorMessage(executive.error, 'Could not load executive summary.')}
      </p>
    )
  }

  const data = executive.data
  const maxFunnel = Math.max(...data.funnel.steps.map((step) => step.count), 1)
  const revenueRows = data.by_pillar_revenue[revenueMode]
  const volume = data.volume.map((row) => ({ ...row, weekLabel: fmtWeek(row.week) }))

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6 min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Deal-to-Billing Ops</p>
          <h2 className="text-2xl font-semibold text-ink mt-1">Summary</h2>
          <p className="text-sm text-muted mt-1">
            Live Pulse contacts and opportunities, filtered by created date.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className={btnSecondaryClass}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['pulse-executive'] })
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InsightPanel
          title="Effective areas"
          tone="emerald"
          items={data.insights.effective}
        />
        <InsightPanel
          title="Needs attention"
          tone="rose"
          items={data.insights.attention}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Revenue won"
          value={fmtCompact(data.revenue_won)}
          sub={priorLabel(data.revenue_won, data.revenue_won_prior, 'money')}
          accent
        />
        <Kpi
          label="Pipeline value"
          value={fmtCompact(data.pipeline_value)}
          sub={`${periodHint} · ${priorLabel(data.pipeline_value, data.pipeline_value_prior, 'money')}`}
          edge="brand"
        />
        <Kpi
          label="Win rate"
          value={`${data.win_rate}%`}
          sub={priorLabel(data.win_rate, data.win_rate_prior, 'percent')}
          edge="emerald"
        />
        <Kpi
          label="Deals closed"
          value={String(data.deals_closed)}
          sub={priorLabel(data.deals_closed, data.deals_closed_prior, 'count')}
          edge="brand"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Benchmark
          label="Avg deal size"
          value={fmtCompact(data.benchmarks.avg_deal_size)}
        />
        <Benchmark
          label="Sales cycle"
          value={`${data.benchmarks.sales_cycle_days} days`}
        />
        <Benchmark
          label="Lead conversion"
          value={`${data.benchmarks.lead_conversion}%`}
        />
      </div>

      <section className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Sales funnel conversion</h3>
            <p className="text-xs text-muted mt-0.5">Leads → deals → win → closed</p>
          </div>
          {data.funnel.drop.percent > 0 ? (
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              Largest drop: {data.funnel.drop.from_label} → {data.funnel.drop.to_label} ({data.funnel.drop.percent}%)
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {data.funnel.steps.map((step, index) => (
            <FunnelBar key={step.key} step={step} max={maxFunnel} color={FUNNEL_COLORS[index]} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">Pipeline health</h3>
            <p className="text-xs text-muted mt-0.5">Stages with at least one opportunity in range</p>
          </div>
          {data.pipeline_health.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No opportunities in this created-date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted bg-canvas border-b border-line">
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Count</th>
                    <th className="px-4 py-3 font-semibold">Expected value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pipeline_health.map((row) => (
                    <tr key={row.stage} className="border-b border-canvas">
                      <td className="px-4 py-3 text-ink">{row.stage}</td>
                      <td className="px-4 py-3 text-ink">{row.count}</td>
                      <td className="px-4 py-3 text-ink whitespace-nowrap">{fmtMoney(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">Needs attention</h3>
          <p className="text-xs text-muted mt-0.5 mb-3">Highest non-Win stages</p>
          {data.attention.length === 0 ? (
            <p className="text-sm text-muted">Nothing queued outside Win.</p>
          ) : (
            <ul className="space-y-2">
              {data.attention.map((row) => (
                <li key={row.stage} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink truncate">{row.stage}</span>
                  <span className="text-muted shrink-0">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Deals won by pillar">
          {data.by_pillar_won.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.by_pillar_won} dataKey="count" nameKey="name" innerRadius={58} outerRadius={92}>
                  {data.by_pillar_won.map((row, index) => (
                    <Cell key={row.name} fill={PILLAR_COLORS[index % PILLAR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard
          title="Revenue by pillar"
          action={
            <div className="flex gap-1">
              {(['win', 'closed', 'both'] as RevenueMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRevenueMode(mode)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize ${
                    revenueMode === mode ? 'bg-brand text-white' : 'bg-canvas text-muted'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          }
        >
          {revenueRows.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={revenueRows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92}>
                  {revenueRows.map((row, index) => (
                    <Cell key={row.name} fill={PILLAR_COLORS[index % PILLAR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => fmtMoney(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <section className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Volume</h3>
            <p className="text-xs text-muted mt-0.5">Weekly creates in the selected range</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['leads', 'Leads & Deals'],
                ['revenue', 'Deals & Revenue'],
                ['winloss', 'Win vs Loss'],
              ] as [VolumeTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVolumeTab(id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                  volumeTab === id ? 'bg-brand text-white' : 'bg-canvas text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {volume.length === 0 ? (
          <EmptyChart />
        ) : (
          <VolumeChart tab={volumeTab} rows={volume} />
        )}
      </section>
    </div>
  )
}

function VolumeChart({
  tab,
  rows,
}: {
  tab: VolumeTab
  rows: { week: string; weekLabel: string; leads: number; deals: number; won_value: number; win: number; lost: number }[]
}) {
  if (tab === 'leads') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
          <XAxis dataKey="weekLabel" tick={chartTick} />
          <YAxis tick={chartTick} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="leads" name="Leads" stroke="#7c3aed" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="deals" name="Deals" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
  if (tab === 'revenue') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
          <XAxis dataKey="weekLabel" tick={chartTick} />
          <YAxis yAxisId="left" tick={chartTick} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={chartTick} tickFormatter={(v) => fmtCompact(Number(v))} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => (name === 'Won value' ? fmtMoney(Number(value)) : Number(value))}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="deals" name="Deals" fill="#2563eb" radius={[6, 6, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="won_value" name="Won value" stroke="#f59e0b" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
        <XAxis dataKey="weekLabel" tick={chartTick} />
        <YAxis tick={chartTick} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Bar dataKey="win" name="Win" fill="#059669" radius={[6, 6, 0, 0]} />
        <Bar dataKey="lost" name="Lost" fill="#e11d48" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function FunnelBar({ step, max, color }: { step: PulseFunnelStep; max: number; color: string }) {
  const height = Math.max(8, Math.round((step.count / max) * 120))
  return (
    <div className="rounded-xl border border-line bg-canvas p-3">
      <p className="text-xs font-medium text-muted">{step.label}</p>
      <p className="text-lg font-semibold text-ink mt-1">{step.count}</p>
      <div className="h-[120px] flex items-end mt-2">
        <div className="w-full rounded-t-lg" style={{ height, background: color }} />
      </div>
      {step.from_label ? (
        <p className="text-[11px] text-muted mt-2">
          {step.conversion}% {step.from_label}
        </p>
      ) : (
        <p className="text-[11px] text-muted mt-2">Starting volume</p>
      )}
    </div>
  )
}

function InsightPanel({ title, tone, items }: { title: string; tone: 'emerald' | 'rose'; items: string[] }) {
  const wrap =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30'
      : 'border-rose-200 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-950/30'
  const heading = tone === 'emerald' ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${wrap}`}>
      <p className={`text-sm font-semibold ${heading}`}>{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm text-ink">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Benchmark({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-5 border border-line bg-surface/80 backdrop-blur-md shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="text-2xl font-semibold mt-2 leading-none text-ink">{value}</p>
      <p className="text-xs mt-1.5 text-subtle">All-time · not affected by date filters</p>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  edge,
  accent,
}: {
  label: string
  value: string
  sub?: string
  edge?: 'brand' | 'emerald'
  accent?: boolean
}) {
  if (accent) {
    return (
      <div className="relative rounded-2xl p-5 border overflow-hidden shadow-sm bg-gradient-to-br from-violet-500 to-purple-600 border-violet-500 kpi-shine">
        <p className="text-xs font-medium uppercase tracking-wider text-violet-100">{label}</p>
        <p className="text-2xl font-semibold mt-3 leading-none text-white truncate">{value}</p>
        {sub ? <p className="text-xs mt-1.5 text-violet-100">{sub}</p> : null}
      </div>
    )
  }
  const top = edge === 'emerald' ? 'border-t-emerald-500' : 'border-t-brand'
  return (
    <div className={`rounded-2xl p-5 border border-line bg-surface/80 backdrop-blur-md shadow-sm border-t-2 ${top}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="text-2xl font-semibold mt-3 leading-none text-ink truncate">{value}</p>
      {sub ? <p className="text-xs mt-1.5 text-subtle">{sub}</p> : null}
    </div>
  )
}

function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return <p className="text-sm text-muted py-16 text-center">No records in this created-date range.</p>
}
