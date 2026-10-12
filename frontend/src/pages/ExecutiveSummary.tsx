import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
import { ArrowRight, RefreshCw } from 'lucide-react'
import { financeApi } from '../api/finance'
import { pulseApi } from '../api/pulse'
import { getErrorMessage } from '../api/errors'
import { btnSecondaryClass } from '../components/Modal'
import UniversalCalendar from '../components/UniversalCalendar'
import DetailDrawer from '../components/DetailDrawer'
import PipelineFlow from '../components/pulse/PipelineFlow'
import OpsSummaryPanel, { ClickableCard, InsightPanel, Kpi } from '../components/ops/OpsSummaryPanel'
import { buildDetail, type ExecutiveDetail, type FinanceDetailKey } from '../components/executive/executiveDetails'
import { useAuth } from '../hooks/useAuth'
import { isTechPay, useWorkspace } from '../lib/workspaces'
import { useDateRange } from '../hooks/useDateRange'
import { fmtInrCompact, priorLabel } from '../lib/format'
import { chartCursor, chartGridStroke, chartTick, legendStyle, seriesColor, STATUS_COLORS, tooltipProps } from '../lib/chartTheme'
import type {
  BankPosition,
  OpsDashboardSeries,
  OpsSummary,
  PulseExecutiveDashboard,
  PulsePipelineDashboard,
} from '../types'

const money = fmtInrCompact

function fmtWeek(week: string) {
  const parsed = new Date(`${week}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return week
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function ExecutiveSummary() {
  const { user, hasAccess } = useAuth()
  const queryClient = useQueryClient()
  const { from, to, setRange } = useDateRange()
  const showOps = hasAccess('pulse') && !isTechPay(useWorkspace())
  const showFinance = hasAccess('finance')
  const [detail, setDetail] = useState<ExecutiveDetail | null>(null)
  const closeDetail = () => setDetail(null)

  const executive = useQuery<PulseExecutiveDashboard>({
    queryKey: ['pulse-executive', from, to],
    queryFn: () => pulseApi.executive({ from, to }),
    enabled: showOps,
  })
  const pipeline = useQuery<PulsePipelineDashboard>({
    queryKey: ['pulse-pipeline', from, to],
    queryFn: () => pulseApi.pipeline({ from, to }),
    enabled: showOps,
  })
  const stageKey = detail?.kind === 'stage' && detail.key !== 'prospects' ? detail.key : ''
  const stageOpportunities = useQuery({
    queryKey: ['pulse-opportunities', '', stageKey],
    queryFn: () => pulseApi.listOpportunities({ stage: stageKey }),
    enabled: showOps && Boolean(stageKey),
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
    if (showOps) {
      void queryClient.invalidateQueries({ queryKey: ['pulse-executive'] })
      void queryClient.invalidateQueries({ queryKey: ['pulse-pipeline'] })
    }
    if (showFinance) {
      void queryClient.invalidateQueries({ queryKey: ['finance-ops-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['finance-ops-dashboard-series'] })
      void queryClient.invalidateQueries({ queryKey: ['finance-bank-position'] })
    }
  }

  const opsLoading = showOps && executive.isLoading
  const finLoading = showFinance && finance.isLoading
  const opsError = showOps && !opsLoading && (executive.isError || !executive.data)
  const finError = showFinance && !finLoading && (finance.isError || !finance.data)

  const pulse = executive.data
  const fin = finance.data
  const charts = series.data
  const volume = (pulse?.volume ?? []).map((row) => ({ ...row, weekLabel: fmtWeek(row.week) }))
  const agingData = charts?.aging ?? []
  const billedEmpty = !charts || charts.billing_vs_collections.every((r) => !r.billed && !r.received)
  const cashEmpty = !charts || charts.cash_in_out.every((r) => !r.inflow && !r.outflow)
  const agingEmpty = !agingData.some((r) => r.amount > 0)

  const openFinance = (key: FinanceDetailKey) => () => setDetail({ kind: 'finance', key })
  const content = detail
    ? buildDetail(detail, {
        pulse,
        pipeline: pipeline.data,
        stageOpportunities: stageKey ? stageOpportunities.data?.results : undefined,
        stageOpportunitiesLoading: Boolean(stageKey) && stageOpportunities.isLoading,
        fin,
        series: charts,
        bank: bank.data,
        canPulse: showOps,
        canFinance: showFinance,
      })
    : null

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 sm:py-10 max-w-[1400px] mx-auto space-y-6 sm:space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Executive Summary</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Company snapshot'}
          </h1>
          <p className="mt-1 text-sm text-muted max-w-2xl">
            Combined view of deal-to-billing ops and financial control. Tap any card for details.
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

      {/* 2. Insights + finance quick stats */}
      {(showOps && (pulse || opsLoading)) || (showFinance && (fin || finLoading)) ? (
        <section className="space-y-3">
          {showOps ? (
            opsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
            ) : pulse ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <InsightPanel
                  title="Effective areas"
                  tone="good"
                  items={pulse.insights.effective}
                  onClick={() => setDetail({ kind: 'ops', key: 'insights' })}
                />
                <InsightPanel
                  title="Needs attention"
                  tone="warn"
                  items={pulse.insights.attention}
                  onClick={() => setDetail({ kind: 'ops', key: 'insights' })}
                />
              </div>
            ) : null
          ) : null}
          {showFinance ? (
            finLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[76px]" />
                ))}
              </div>
            ) : fin ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <QuickStat label="Open PO" value={money(fin.po_metrics.open_po)} onClick={openFinance('open_po')} />
                <QuickStat label="To be invoiced" value={money(fin.po_metrics.to_be_invoiced)} onClick={openFinance('to_be_invoiced')} />
                <QuickStat label="Payables pending" value={money(fin.payables_pending)} onClick={openFinance('payables')} />
                <QuickStat
                  label="Ops closing"
                  value={bank.data?.operational.available ? money(bank.data.combined_closing) : '—'}
                  onClick={openFinance('ops_closing')}
                />
              </div>
            ) : null
          ) : null}
        </section>
      ) : null}

      {/* 3. KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {showOps ? (
          opsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={`ops-${i}`} className="h-[104px]" />)
          ) : opsError ? (
            <SectionError
              className="col-span-2 lg:col-span-4"
              message={getErrorMessage(executive.error, 'Could not load ops KPIs.')}
              onRetry={refresh}
            />
          ) : pulse ? (
            <>
              <Kpi
                label="Revenue won"
                value={money(pulse.revenue_won)}
                sub={priorLabel(pulse.revenue_won, pulse.revenue_won_prior, 'money')}
                accent
                onClick={() => setDetail({ kind: 'ops', key: 'revenue_won' })}
              />
              <Kpi
                label="Pipeline value"
                value={money(pulse.pipeline_value)}
                sub={priorLabel(pulse.pipeline_value, pulse.pipeline_value_prior, 'money')}
                edge="brand"
                onClick={() => setDetail({ kind: 'ops', key: 'pipeline_value' })}
              />
              <Kpi
                label="Win rate"
                value={`${pulse.win_rate}%`}
                sub={priorLabel(pulse.win_rate, pulse.win_rate_prior, 'percent')}
                edge="success"
                onClick={() => setDetail({ kind: 'ops', key: 'win_rate' })}
              />
              <Kpi
                label="Deals closed"
                value={String(pulse.deals_closed)}
                sub={priorLabel(pulse.deals_closed, pulse.deals_closed_prior, 'count')}
                edge="brand"
                onClick={() => setDetail({ kind: 'ops', key: 'deals_closed' })}
              />
            </>
          ) : null
        ) : null}
        {showFinance ? (
          finLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={`fin-${i}`} className="h-[104px]" />)
          ) : finError ? (
            <SectionError
              className="col-span-2 lg:col-span-4"
              message={getErrorMessage(finance.error, 'Could not load finance KPIs.')}
              onRetry={refresh}
            />
          ) : fin ? (
            <>
              <Kpi label="Total invoiced" value={money(fin.revenue_metrics.invoiced)} edge="brand" onClick={openFinance('invoiced')} />
              <Kpi label="Receivables" value={money(fin.receivables.total)} edge="brand" onClick={openFinance('receivables')} />
              <Kpi label="Overdue AR" value={money(fin.receivables.overdue)} edge="brand" onClick={openFinance('overdue')} />
              <Kpi
                label="Net cash"
                value={money(fin.cashflow_metrics.net_cash_movement)}
                edge="success"
                onClick={openFinance('net_cash')}
              />
            </>
          ) : null
        ) : null}
      </section>

      {showOps ? (
        <>
          {/* 4. Deal pipeline flow */}
          {pipeline.isLoading ? (
            <Skeleton className="h-72 rounded-3xl" />
          ) : pipeline.data ? (
            <PipelineFlow
              data={pipeline.data}
              selectedStage={
                detail?.kind === 'stage' ? (detail.key === 'prospects' ? undefined : detail.key) : 'none'
              }
              onSelectStage={(key) => setDetail({ kind: 'stage', key })}
              action={
                <Link
                  to="/pulse/summary"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand bg-surface/80 border border-brand/20 rounded-full px-3 py-1.5 w-fit shrink-0 hover:border-brand/50"
                >
                  Open pipeline
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                </Link>
              }
            />
          ) : pipeline.isError ? (
            <SectionError message={getErrorMessage(pipeline.error, 'Could not load pipeline flow.')} onRetry={refresh} />
          ) : null}

          {/* 5. Deal-to-Billing Ops summary */}
          {pulse ? (
            <section className="space-y-3">
              <SectionHeading title="Deal-to-Billing Ops" to="/pulse/summary" linkLabel="Open in Pulse" />
              <OpsSummaryPanel
                data={pulse}
                sections={['benchmarks', 'funnel']}
                onSelect={(key) => setDetail({ kind: 'ops', key })}
              />
            </section>
          ) : null}
        </>
      ) : null}

      {/* 6. Charts */}
      {showOps && pulse ? (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartPanel title="Revenue by pillar" subtitle="Won + closed in range" empty={pulse.by_pillar_revenue.both.length === 0}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pulse.by_pillar_revenue.both} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84}>
                  {pulse.by_pillar_revenue.both.map((row, i) => (
                    <Cell key={row.name} fill={seriesColor(i)} stroke="var(--color-surface)" />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} formatter={(v) => money(Number(v))} />
                <Legend wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="Win vs loss" subtitle="Weekly volume in range" empty={volume.length === 0}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={volume}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="weekLabel" tick={chartTick} />
                <YAxis tick={chartTick} allowDecimals={false} width={32} />
                <Tooltip {...tooltipProps} cursor={chartCursor} />
                <Legend wrapperStyle={legendStyle} />
                <Bar dataKey="win" name="Win" fill={STATUS_COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="lost" name="Lost" fill={STATUS_COLORS.danger} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>
      ) : null}

      {showFinance ? (
        <section className="space-y-3">
          <SectionHeading title="Financial Control" to="/finance" linkLabel="Open finance" />
          {finLoading || series.isLoading ? (
            <Skeleton className="h-48" />
          ) : finError || !fin ? (
            <SectionError message={getErrorMessage(finance.error, 'Could not load finance charts.')} onRetry={refresh} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <ChartPanel title="Billing vs collections" empty={billedEmpty}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts?.billing_vs_collections ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                    <XAxis dataKey="label" tick={chartTick} />
                    <YAxis tick={chartTick} tickFormatter={(v) => money(Number(v))} width={52} />
                    <Tooltip {...tooltipProps} cursor={chartCursor} formatter={(v) => money(Number(v))} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="billed" name="Billed" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="received" name="Received" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Receivables aging" empty={agingEmpty}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={agingData} dataKey="amount" nameKey="bucket" innerRadius={52} outerRadius={84}>
                      {agingData.map((row, i) => (
                        <Cell key={row.bucket} fill={seriesColor(i)} stroke="var(--color-surface)" />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipProps} formatter={(v) => money(Number(v))} />
                    <Legend wrapperStyle={legendStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Cash in vs out" empty={cashEmpty}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts?.cash_in_out ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                    <XAxis dataKey="label" tick={chartTick} />
                    <YAxis tick={chartTick} tickFormatter={(v) => money(Number(v))} width={52} />
                    <Tooltip {...tooltipProps} cursor={chartCursor} formatter={(v) => money(Number(v))} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="inflow" name="Inflow" fill={STATUS_COLORS.success} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflow" name="Outflow" fill={STATUS_COLORS.danger} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
          )}
        </section>
      ) : null}

      <DetailDrawer
        open={Boolean(content)}
        onClose={closeDetail}
        title={content?.title ?? ''}
        subtitle={content?.subtitle}
        action={content?.action}
      >
        {content?.body}
      </DetailDrawer>
    </div>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`rounded-2xl bg-canvas animate-pulse ${className}`} />
}

function QuickStat({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <ClickableCard
      onClick={onClick}
      label={label}
      className="rounded-2xl border border-line bg-surface/80 backdrop-blur-md px-4 py-3 shadow-sm"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted pr-5">{label}</p>
      <p className="text-lg font-semibold text-ink mt-1 tabular-nums truncate">{value}</p>
    </ClickableCard>
  )
}

function SectionHeading({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</p>
      <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover py-1">
        {linkLabel}
        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  )
}

function ChartPanel({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string
  subtitle?: string
  empty: boolean
  children: ReactNode
}) {
  return (
    <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {subtitle ? <p className="text-xs text-muted mt-0.5">{subtitle}</p> : null}
      <div className="mt-2">{empty ? <p className="text-sm text-muted py-16 text-center">No data yet.</p> : children}</div>
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
