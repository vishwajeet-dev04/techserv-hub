import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { financeApi } from '../api/finance'
import { pulseApi } from '../api/pulse'
import { getErrorMessage } from '../api/errors'
import { btnSecondaryClass } from '../components/Modal'
import UniversalCalendar from '../components/UniversalCalendar'
import { useAuth } from '../hooks/useAuth'
import { useDateRange } from '../hooks/useDateRange'
import type { BankPosition, OpsDashboardSeries, OpsSummary, PulseExecutiveDashboard } from '../types'

const chartTick = { fontSize: 11, fill: 'var(--color-muted)' }
const tooltipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line)',
  borderRadius: 12,
  fontSize: 12,
}
const PILLAR_COLORS = ['#7c3aed', '#059669', '#f59e0b', '#2563eb', '#db2777', '#0d9488']
const FUNNEL_COLORS = ['#7c3aed', '#2563eb', '#059669', '#0f766e']
const AGING_COLORS = ['#7c3aed', '#f59e0b', '#14b8a6', '#3b82f6', '#a78bfa']

function fmtCompact(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n) || 0)
}

function fmtWeek(week: string) {
  const parsed = new Date(`${week}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return week
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function ExecutiveSummary() {
  const { user, hasAccess } = useAuth()
  const queryClient = useQueryClient()
  const { from, to, setRange } = useDateRange()
  const showOps = hasAccess('pulse') || hasAccess('dashboard')
  const showFinance = hasAccess('finance')

  const executive = useQuery<PulseExecutiveDashboard>({
    queryKey: ['pulse-executive', from, to],
    queryFn: () => pulseApi.executive({ from, to }),
    enabled: showOps,
  })
  const finance = useQuery<OpsSummary>({
    queryKey: ['finance-ops-summary', from, to],
    queryFn: () => financeApi.opsSummary({ from, to }),
    enabled: showFinance,
  })
  const series = useQuery<OpsDashboardSeries>({
    queryKey: ['finance-ops-dashboard-series', from, to],
    queryFn: () => financeApi.dashboardSeries({ from, to }),
    enabled: showFinance,
  })
  const bank = useQuery<BankPosition>({
    queryKey: ['finance-bank-position', from, to],
    queryFn: () => financeApi.bankPosition({ from, to }),
    enabled: showFinance,
  })

  const refresh = () => {
    if (showOps) void queryClient.invalidateQueries({ queryKey: ['pulse-executive'] })
    if (showFinance) {
      void queryClient.invalidateQueries({ queryKey: ['finance-ops-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['finance-ops-dashboard-series'] })
      void queryClient.invalidateQueries({ queryKey: ['finance-bank-position'] })
    }
  }

  const opsLoading = showOps && executive.isLoading
  const finLoading = showFinance && finance.isLoading
  const opsError = showOps && (executive.isError || !executive.data)
  const finError = showFinance && (finance.isError || !finance.data)

  const pulse = executive.data
  const fin = finance.data
  const charts = series.data
  const maxFunnel = Math.max(...(pulse?.funnel.steps.map((s) => s.count) ?? [1]), 1)
  const volume = (pulse?.volume ?? []).map((row) => ({ ...row, weekLabel: fmtWeek(row.week) }))
  const agingData = charts?.aging ?? []
  const billedEmpty = !charts || charts.billing_vs_collections.every((r) => !r.billed && !r.received)
  const cashEmpty = !charts || charts.cash_in_out.every((r) => !r.inflow && !r.outflow)
  const agingEmpty = !agingData.some((r) => r.amount > 0)

  return (
    <div className="px-4 sm:px-6 md:px-10 py-8 sm:py-10 max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Executive Summary</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Company snapshot'}
          </h1>
          <p className="mt-1 text-sm text-muted max-w-2xl">
            Combined view of deal-to-billing ops and financial control for leadership.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UniversalCalendar from={from} to={to} onChange={setRange} compact />
          <button type="button" className={btnSecondaryClass} onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {showOps ? (
          opsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={`ops-${i}`} />)
          ) : opsError ? (
            <SectionError
              className="col-span-2 lg:col-span-4"
              message={getErrorMessage(executive.error, 'Could not load ops KPIs.')}
              onRetry={refresh}
            />
          ) : pulse ? (
            <>
              <Kpi label="Revenue won" value={fmtCompact(pulse.revenue_won)} accent />
              <Kpi label="Pipeline value" value={fmtCompact(pulse.pipeline_value)} />
              <Kpi label="Win rate" value={`${pulse.win_rate}%`} />
              <Kpi label="Deals closed" value={String(pulse.deals_closed)} />
            </>
          ) : null
        ) : null}
        {showFinance ? (
          finLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={`fin-${i}`} />)
          ) : finError ? (
            <SectionError
              className="col-span-2 lg:col-span-4"
              message={getErrorMessage(finance.error, 'Could not load finance KPIs.')}
              onRetry={refresh}
            />
          ) : fin ? (
            <>
              <Kpi label="Total invoiced" value={fmtCompact(fin.revenue_metrics.invoiced)} />
              <Kpi label="Receivables" value={fmtCompact(fin.receivables.total)} />
              <Kpi label="Overdue AR" value={fmtCompact(fin.receivables.overdue)} />
              <Kpi label="Net cash" value={fmtCompact(fin.cashflow_metrics.net_cash_movement)} />
            </>
          ) : null
        ) : null}
      </div>

      {showOps ? (
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Deal-to-Billing Ops</p>
          {opsLoading ? (
            <div className="h-48 rounded-2xl bg-canvas animate-pulse" />
          ) : opsError || !pulse ? (
            <SectionError message={getErrorMessage(executive.error, 'Could not load ops charts.')} onRetry={refresh} />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-1 bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-ink">Sales funnel</h3>
                <p className="text-xs text-muted mt-0.5 mb-3">Leads → deals → win → closed</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-2">
                  {pulse.funnel.steps.map((step, index) => {
                    const height = Math.max(8, Math.round((step.count / maxFunnel) * 88))
                    return (
                      <div key={step.key} className="rounded-xl border border-line bg-canvas/60 p-2.5">
                        <p className="text-[11px] text-muted truncate">{step.label}</p>
                        <p className="text-base font-semibold text-ink tabular-nums">{step.count}</p>
                        <div className="h-[88px] flex items-end mt-1">
                          <div className="w-full rounded-t-md" style={{ height, background: FUNNEL_COLORS[index] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-ink">Revenue by pillar</h3>
                <p className="text-xs text-muted mt-0.5 mb-2">Won + closed in range</p>
                {pulse.by_pillar_revenue.both.length === 0 ? (
                  <p className="text-sm text-muted py-16 text-center">No pillar revenue in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pulse.by_pillar_revenue.both}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={84}
                      >
                        {pulse.by_pillar_revenue.both.map((row, i) => (
                          <Cell key={row.name} fill={PILLAR_COLORS[i % PILLAR_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCompact(Number(v))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-ink">Win vs loss</h3>
                <p className="text-xs text-muted mt-0.5 mb-2">Weekly volume in range</p>
                {volume.length === 0 ? (
                  <p className="text-sm text-muted py-16 text-center">No weekly volume in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={volume}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                      <XAxis dataKey="weekLabel" tick={chartTick} />
                      <YAxis tick={chartTick} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="win" name="Win" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="lost" name="Lost" fill="#e11d48" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {showFinance ? (
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Financial Control</p>
          {finLoading || series.isLoading ? (
            <div className="h-48 rounded-2xl bg-canvas animate-pulse" />
          ) : finError || !fin ? (
            <SectionError
              message={getErrorMessage(finance.error, 'Could not load finance charts.')}
              onRetry={refresh}
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <ChartPanel title="Billing vs collections" empty={billedEmpty}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts?.billing_vs_collections ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="label" tick={chartTick} />
                    <YAxis tick={chartTick} tickFormatter={(v) => fmtCompact(Number(v))} width={52} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCompact(Number(v))} />
                    <Legend />
                    <Bar dataKey="billed" name="Billed" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="received" name="Received" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Receivables aging" empty={agingEmpty}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={agingData} dataKey="amount" nameKey="bucket" innerRadius={52} outerRadius={84}>
                      {agingData.map((row, i) => (
                        <Cell key={row.bucket} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCompact(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Cash in vs out" empty={cashEmpty}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts?.cash_in_out ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="label" tick={chartTick} />
                    <YAxis tick={chartTick} tickFormatter={(v) => fmtCompact(Number(v))} width={52} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCompact(Number(v))} />
                    <Legend />
                    <Bar dataKey="inflow" name="Inflow" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
          )}
        </section>
      ) : null}

      {showFinance && fin && !finLoading && !finError ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FooterStat label="Open PO" value={fmtCompact(fin.po_metrics.open_po)} />
          <FooterStat label="To be invoiced" value={fmtCompact(fin.po_metrics.to_be_invoiced)} />
          <FooterStat label="Payables pending" value={fmtCompact(fin.payables_pending)} />
          <FooterStat
            label="Ops closing"
            value={
              bank.data?.operational.available
                ? fmtCompact(bank.data.combined_closing)
                : '—'
            }
          />
        </div>
      ) : null}

      {showOps && pulse && !opsLoading && !opsError ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(pulse.insights.effective ?? []).length > 0 ? (
            <Insight title="Effective areas" items={pulse.insights.effective} tone="good" />
          ) : null}
          {(pulse.insights.attention ?? []).length > 0 ? (
            <Insight title="Needs attention" items={pulse.insights.attention} tone="warn" />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  if (accent) {
    return (
      <div className="rounded-2xl p-4 border border-brand bg-gradient-to-br from-brand to-brand-hover shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{label}</p>
        <p className="text-xl font-semibold text-white mt-2 tabular-nums truncate">{value}</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl p-4 border border-line bg-surface/80 backdrop-blur-md shadow-sm border-t-2 border-t-brand">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-xl font-semibold text-ink mt-2 tabular-nums truncate">{value}</p>
    </div>
  )
}

function SkeletonKpi() {
  return <div className="h-[92px] rounded-2xl bg-canvas animate-pulse" />
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/80 backdrop-blur-md px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-lg font-semibold text-ink mt-1 tabular-nums">{value}</p>
    </div>
  )
}

function ChartPanel({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink mb-2">{title}</h3>
      {empty ? <p className="text-sm text-muted py-16 text-center">No data yet.</p> : children}
    </div>
  )
}

function Insight({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'warn' }) {
  const wrap =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30'
      : 'border-rose-200 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/30'
  return (
    <div className={`rounded-2xl border p-4 ${wrap}`}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-sm text-ink">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionError({
  message,
  onRetry,
  className = '',
}: {
  message: string
  onRetry: () => void
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-line bg-surface/80 p-4 ${className}`}>
      <p className="text-sm text-danger">{message}</p>
      <button type="button" className="mt-2 text-sm text-brand" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
