import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { fmtInrCompact, priorLabel } from '../../lib/format'
import type { PulseExecutiveDashboard, PulseFunnelStep } from '../../types'

export type OpsSummarySection = 'insights' | 'kpis' | 'benchmarks' | 'funnel'

export type OpsDetailKey =
  | 'revenue_won'
  | 'pipeline_value'
  | 'win_rate'
  | 'deals_closed'
  | 'avg_deal_size'
  | 'sales_cycle'
  | 'lead_conversion'
  | 'funnel'
  | 'insights'

const FUNNEL_COLORS = ['var(--color-chart-1)', 'var(--color-chart-4)', 'var(--color-chart-2)', 'var(--color-chart-6)']
const ALL_SECTIONS: OpsSummarySection[] = ['insights', 'kpis', 'benchmarks', 'funnel']

/** Renders as a button with a chevron when onClick is set, otherwise as a plain block. */
export function ClickableCard({
  onClick,
  className,
  children,
  label,
}: {
  onClick?: () => void
  className: string
  children: ReactNode
  label?: string
}) {
  if (!onClick) return <div className={className}>{children}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ? `${label}: view details` : undefined}
      className={`${className} group relative w-full flex flex-col justify-start text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
    >
      {children}
      <ChevronRight
        className="absolute top-4 right-3 w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity"
        strokeWidth={2}
        aria-hidden
      />
    </button>
  )
}

export function InsightPanel({
  title,
  tone,
  items,
  onClick,
}: {
  title: string
  tone: 'good' | 'warn'
  items: string[]
  onClick?: () => void
}) {
  const wrap = tone === 'good' ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft'
  const heading = tone === 'good' ? 'text-success' : 'text-danger'
  return (
    <ClickableCard onClick={onClick} label={title} className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${wrap}`}>
      <p className={`text-sm font-semibold pr-5 ${heading}`}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing to flag in this range.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item} className="text-sm text-ink">
              {item}
            </li>
          ))}
        </ul>
      )}
    </ClickableCard>
  )
}

export function Kpi({
  label,
  value,
  sub,
  edge,
  accent,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  edge?: 'brand' | 'success'
  accent?: boolean
  onClick?: () => void
}) {
  if (accent) {
    return (
      <ClickableCard
        onClick={onClick}
        label={label}
        className="relative rounded-2xl p-4 sm:p-5 border overflow-hidden shadow-sm bg-gradient-to-br from-violet-500 to-purple-600 border-violet-500 kpi-shine text-white"
      >
        <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-violet-100 pr-5">{label}</p>
        <p className="text-xl sm:text-2xl font-semibold mt-2 sm:mt-3 leading-none text-white truncate">{value}</p>
        {sub ? <p className="text-[11px] sm:text-xs mt-1.5 text-violet-100">{sub}</p> : null}
      </ClickableCard>
    )
  }
  const top = edge === 'success' ? 'border-t-success' : 'border-t-brand'
  return (
    <ClickableCard
      onClick={onClick}
      label={label}
      className={`rounded-2xl p-4 sm:p-5 border border-line bg-surface/80 backdrop-blur-md shadow-sm border-t-2 ${top} text-muted`}
    >
      <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-muted pr-5">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold mt-2 sm:mt-3 leading-none text-ink truncate">{value}</p>
        {sub ? <p className="text-[11px] sm:text-xs mt-1.5 text-subtle">{sub}</p> : null}
    </ClickableCard>
  )
}

export function Benchmark({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <ClickableCard
      onClick={onClick}
      label={label}
      className="rounded-2xl p-4 sm:p-5 border border-line bg-surface/80 backdrop-blur-md shadow-sm text-muted"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted pr-5">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold mt-2 leading-none text-ink">{value}</p>
      <p className="text-xs mt-1.5 text-subtle">All-time · not affected by date filters</p>
    </ClickableCard>
  )
}

export function FunnelBar({ step, max, color }: { step: PulseFunnelStep; max: number; color: string }) {
  const height = Math.max(8, Math.round((step.count / max) * 120))
  return (
    <div className="rounded-xl border border-line bg-canvas p-3">
      <p className="text-xs font-medium text-muted">{step.label}</p>
      <p className="text-lg font-semibold text-ink mt-1">{step.count}</p>
      <div className="h-[80px] sm:h-[120px] flex items-end mt-2">
        <div className="w-full rounded-t-lg funnel-bar" style={{ height: `min(${height}px, 100%)`, background: color }} />
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

export function FunnelSection({ data, onClick }: { data: PulseExecutiveDashboard; onClick?: () => void }) {
  const maxFunnel = Math.max(...data.funnel.steps.map((step) => step.count), 1)
  return (
    <section className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Sales funnel conversion</h3>
          <p className="text-xs text-muted mt-0.5">Leads → deals → win → closed</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.funnel.drop.percent > 0 ? (
            <p className="text-xs font-medium text-warning bg-warning-soft border border-warning/30 rounded-xl px-3 py-2">
              Largest drop: {data.funnel.drop.from_label} → {data.funnel.drop.to_label} ({data.funnel.drop.percent}%)
            </p>
          ) : null}
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="text-xs font-medium text-brand hover:text-brand-hover inline-flex items-center gap-1 px-2 py-2"
            >
              Details
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.funnel.steps.map((step, index) => (
          <FunnelBar key={step.key} step={step} max={maxFunnel} color={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
        ))}
      </div>
    </section>
  )
}

/**
 * Deal-to-Billing Ops summary: insights, KPI row, all-time benchmarks and funnel.
 * Pass onSelect to make every card open a detail view.
 */
export default function OpsSummaryPanel({
  data,
  sections = ALL_SECTIONS,
  onSelect,
}: {
  data: PulseExecutiveDashboard
  sections?: OpsSummarySection[]
  onSelect?: (key: OpsDetailKey) => void
}) {
  const show = (section: OpsSummarySection) => sections.includes(section)
  const click = (key: OpsDetailKey) => (onSelect ? () => onSelect(key) : undefined)

  return (
    <div className="space-y-4 sm:space-y-6">
      {show('insights') ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <InsightPanel title="Effective areas" tone="good" items={data.insights.effective} onClick={click('insights')} />
          <InsightPanel title="Needs attention" tone="warn" items={data.insights.attention} onClick={click('insights')} />
        </div>
      ) : null}

      {show('kpis') ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi
            label="Revenue won"
            value={fmtInrCompact(data.revenue_won)}
            sub={priorLabel(data.revenue_won, data.revenue_won_prior, 'money')}
            accent
            onClick={click('revenue_won')}
          />
          <Kpi
            label="Pipeline value"
            value={fmtInrCompact(data.pipeline_value)}
            sub={`In selected range · ${priorLabel(data.pipeline_value, data.pipeline_value_prior, 'money')}`}
            edge="brand"
            onClick={click('pipeline_value')}
          />
          <Kpi
            label="Win rate"
            value={`${data.win_rate}%`}
            sub={priorLabel(data.win_rate, data.win_rate_prior, 'percent')}
            edge="success"
            onClick={click('win_rate')}
          />
          <Kpi
            label="Deals closed"
            value={String(data.deals_closed)}
            sub={priorLabel(data.deals_closed, data.deals_closed_prior, 'count')}
            edge="brand"
            onClick={click('deals_closed')}
          />
        </div>
      ) : null}

      {show('benchmarks') ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Benchmark label="Avg deal size" value={fmtInrCompact(data.benchmarks.avg_deal_size)} onClick={click('avg_deal_size')} />
          <Benchmark label="Sales cycle" value={`${data.benchmarks.sales_cycle_days} days`} onClick={click('sales_cycle')} />
          <Benchmark label="Lead conversion" value={`${data.benchmarks.lead_conversion}%`} onClick={click('lead_conversion')} />
        </div>
      ) : null}

      {show('funnel') ? <FunnelSection data={data} onClick={click('funnel')} /> : null}
    </div>
  )
}
