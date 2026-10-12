import type { ReactNode } from 'react'
import { DrawerGrid, DrawerNote, DrawerRows, DrawerSection, DrawerStat, type DetailDrawerAction } from '../DetailDrawer'
import type { OpsDetailKey } from '../ops/OpsSummaryPanel'
import { fmtInrCompact, priorLabel } from '../../lib/format'
import type {
  BankPosition,
  OpsDashboardSeries,
  OpsSummary,
  PulseExecutiveDashboard,
  PulseOpportunity,
  PulsePipelineDashboard,
} from '../../types'

export type FinanceDetailKey =
  | 'invoiced'
  | 'receivables'
  | 'overdue'
  | 'net_cash'
  | 'open_po'
  | 'to_be_invoiced'
  | 'payables'
  | 'ops_closing'

export type ExecutiveDetail =
  | { kind: 'ops'; key: OpsDetailKey }
  | { kind: 'finance'; key: FinanceDetailKey }
  | { kind: 'stage'; key: string }

export interface DetailContent {
  title: string
  subtitle?: string
  action: DetailDrawerAction | null
  body: ReactNode
}

export interface DetailContext {
  pulse?: PulseExecutiveDashboard
  pipeline?: PulsePipelineDashboard
  stageOpportunities?: PulseOpportunity[]
  stageOpportunitiesLoading?: boolean
  fin?: OpsSummary
  series?: OpsDashboardSeries
  bank?: BankPosition
  canPulse: boolean
  canFinance: boolean
}

const money = fmtInrCompact
const pct = (share: number) => `${Math.round(share)}%`

function opsLink(ctx: DetailContext, label: string, to: string): DetailDrawerAction | null {
  return ctx.canPulse ? { label, to } : null
}

function finLink(ctx: DetailContext, label: string, to: string): DetailDrawerAction | null {
  return ctx.canFinance ? { label, to } : null
}

function opportunitiesFor(stage?: string) {
  return stage ? `/pulse/opportunities?stage=${encodeURIComponent(stage)}` : '/pulse/opportunities'
}

function opsDetail(key: OpsDetailKey, ctx: DetailContext): DetailContent | null {
  const p = ctx.pulse
  if (!p) return null
  switch (key) {
    case 'revenue_won':
      return {
        title: 'Revenue won',
        subtitle: priorLabel(p.revenue_won, p.revenue_won_prior, 'money'),
        action: opsLink(ctx, 'View won opportunities', opportunitiesFor('Win')),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Revenue won" value={money(p.revenue_won)} tone="success" />
              <DrawerStat label="Won deals" value={String(p.won_count)} />
            </DrawerGrid>
            <DrawerSection title="By service pillar">
              <DrawerRows
                rows={p.by_pillar_revenue.both.map((row) => ({
                  key: row.name,
                  label: row.name,
                  value: money(row.value),
                  hint: `${pct(row.share)} of won + closed`,
                }))}
              />
            </DrawerSection>
          </>
        ),
      }
    case 'pipeline_value':
      return {
        title: 'Pipeline value',
        subtitle: priorLabel(p.pipeline_value, p.pipeline_value_prior, 'money'),
        action: opsLink(ctx, 'Open summary', '/pulse/summary'),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Pipeline value" value={money(p.pipeline_value)} />
              <DrawerStat label="Opportunities" value={String(p.deals)} />
            </DrawerGrid>
            <DrawerSection title="Pipeline health by stage">
              <DrawerRows
                rows={p.pipeline_health.map((row) => ({
                  key: row.stage,
                  label: row.stage,
                  value: money(row.value),
                  hint: `${row.count} opportunities`,
                }))}
              />
            </DrawerSection>
          </>
        ),
      }
    case 'win_rate':
      return {
        title: 'Win rate',
        subtitle: priorLabel(p.win_rate, p.win_rate_prior, 'percent'),
        action: opsLink(ctx, 'View won opportunities', opportunitiesFor('Win')),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Win rate" value={`${p.win_rate}%`} tone="success" />
              <DrawerStat label="Won / deals" value={`${p.won_count} / ${p.deals}`} />
            </DrawerGrid>
            <DrawerSection title="Wins by service pillar">
              <DrawerRows
                rows={p.by_pillar_won.map((row) => ({
                  key: row.name,
                  label: row.name,
                  value: String(row.count),
                  hint: `${pct(row.share)} of wins`,
                }))}
              />
            </DrawerSection>
          </>
        ),
      }
    case 'deals_closed':
      return {
        title: 'Deals closed',
        subtitle: priorLabel(p.deals_closed, p.deals_closed_prior, 'count'),
        action: opsLink(ctx, 'View closed opportunities', opportunitiesFor('Closed')),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Deals closed" value={String(p.deals_closed)} />
              <DrawerStat label="Avg sales cycle" value={`${p.sales_cycle_days} days`} />
            </DrawerGrid>
            <DrawerSection title="Closed revenue by pillar">
              <DrawerRows
                rows={p.by_pillar_revenue.closed.map((row) => ({
                  key: row.name,
                  label: row.name,
                  value: money(row.value),
                  hint: `${pct(row.share)} of closed`,
                }))}
                empty="No deals moved to Closed in this range."
              />
            </DrawerSection>
          </>
        ),
      }
    case 'avg_deal_size':
    case 'sales_cycle':
    case 'lead_conversion': {
      const titles = { avg_deal_size: 'Avg deal size', sales_cycle: 'Sales cycle', lead_conversion: 'Lead conversion' }
      return {
        title: titles[key],
        subtitle: 'All-time benchmark · not affected by date filters',
        action: opsLink(ctx, 'Open ops summary', '/pulse/summary'),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Avg deal size" value={money(p.benchmarks.avg_deal_size)} />
              <DrawerStat label="Sales cycle" value={`${p.benchmarks.sales_cycle_days} days`} />
              <DrawerStat label="Lead conversion" value={`${p.benchmarks.lead_conversion}%`} />
              <DrawerStat label="Leads in range" value={String(p.leads)} />
            </DrawerGrid>
            <DrawerNote>
              Benchmarks are computed across every opportunity in Pulse, so they stay stable while you change the date
              range. Use them to judge whether the selected period is above or below normal.
            </DrawerNote>
          </>
        ),
      }
    }
    case 'funnel':
      return {
        title: 'Sales funnel conversion',
        subtitle:
          p.funnel.drop.percent > 0
            ? `Largest drop: ${p.funnel.drop.from_label} → ${p.funnel.drop.to_label} (${p.funnel.drop.percent}%)`
            : 'Leads → deals → win → closed',
        action: opsLink(ctx, 'Open summary', '/pulse/summary'),
        body: (
          <DrawerSection title="Steps">
            <DrawerRows
              rows={p.funnel.steps.map((step) => ({
                key: step.key,
                label: step.label,
                value: String(step.count),
                hint: step.from_label ? `${step.conversion}% ${step.from_label}` : 'Starting volume',
              }))}
            />
          </DrawerSection>
        ),
      }
    case 'insights':
      return {
        title: 'Insights',
        subtitle: 'What is working and what needs attention in this range',
        action: opsLink(ctx, 'Open ops summary', '/pulse/summary'),
        body: (
          <>
            <DrawerSection title="Effective areas">
              <ul className="space-y-1.5">
                {(p.insights.effective.length ? p.insights.effective : ['Nothing to flag in this range.']).map((item) => (
                  <li key={item} className="text-sm text-ink rounded-lg bg-success-soft border border-success/20 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </DrawerSection>
            <DrawerSection title="Needs attention">
              <ul className="space-y-1.5">
                {(p.insights.attention.length ? p.insights.attention : ['Nothing to flag in this range.']).map((item) => (
                  <li key={item} className="text-sm text-ink rounded-lg bg-danger-soft border border-danger/20 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </DrawerSection>
            {p.attention.length > 0 ? (
              <DrawerSection title="Stages needing follow-up">
                <DrawerRows
                  rows={p.attention.map((row) => ({
                    key: row.stage,
                    label: row.stage,
                    value: money(row.value),
                    hint: `${row.count} opportunities`,
                  }))}
                />
              </DrawerSection>
            ) : null}
          </>
        ),
      }
  }
}

function stageDetail(key: string, ctx: DetailContext): DetailContent | null {
  const d = ctx.pipeline
  if (!d) return null
  const step = d.flow.find((item) => item.key === key)
  if (!step) return null
  const total = d.flow.find((item) => item.key === 'prospects')?.count || d.total_prospects || 0
  const isTotal = key === 'prospects'
  const open = d.open_pipeline?.by_stage.find((row) => row.stage === key)
  const share = total ? Math.round((step.count / total) * 100) : 0
  return {
    title: isTotal ? 'All opportunities' : step.label,
    subtitle: isTotal ? d.insight : `${share}% of ${total} opportunities in range`,
    action: opsLink(ctx, isTotal ? 'View all opportunities' : `View ${step.label} opportunities`, opportunitiesFor(isTotal ? undefined : key)),
    body: (
      <>
        <DrawerGrid>
          <DrawerStat label="Opportunities" value={String(step.count)} />
          <DrawerStat label="Value" value={step.value != null ? money(step.value) : '—'} />
        </DrawerGrid>
        {isTotal ? (
          <DrawerSection title="Open pipeline by stage">
            <DrawerRows
              rows={(d.open_pipeline?.by_stage ?? []).map((row) => ({
                key: row.stage,
                label: row.stage,
                value: money(row.value),
                hint: `${row.count} opportunities`,
              }))}
            />
          </DrawerSection>
        ) : open ? (
          <DrawerNote>This stage is part of the open pipeline ({money(d.open_pipeline.value)} across {d.open_pipeline.count} opportunities).</DrawerNote>
        ) : (
          <DrawerNote>This is a closing stage and is excluded from the open pipeline value.</DrawerNote>
        )}
        {!isTotal ? (
          <DrawerSection title="Top opportunities">
            {ctx.stageOpportunitiesLoading ? (
              <div className="h-24 rounded-xl bg-canvas animate-pulse" />
            ) : (
              <DrawerRows
                rows={topOpportunities(ctx.stageOpportunities ?? []).map((row) => ({
                  key: row.id,
                  label: row.name,
                  value: fmtOpportunityValue(row),
                  hint: [row.company_name, row.owner_display].filter(Boolean).join(' · '),
                }))}
                empty="No opportunities in this stage."
              />
            )}
          </DrawerSection>
        ) : null}
      </>
    ),
  }
}

function opportunityValue(row: PulseOpportunity): number {
  return Number(row.negotiated_amount) || Number(row.expected_amount) || 0
}

function fmtOpportunityValue(row: PulseOpportunity): string {
  const currency = row.currency || 'INR'
  if (currency === 'INR') return money(opportunityValue(row))
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(opportunityValue(row))
  } catch {
    return `${currency} ${opportunityValue(row).toLocaleString('en-IN')}`
  }
}

function topOpportunities(rows: PulseOpportunity[], limit = 6): PulseOpportunity[] {
  return [...rows].sort((a, b) => opportunityValue(b) - opportunityValue(a)).slice(0, limit)
}

function financeDetail(key: FinanceDetailKey, ctx: DetailContext): DetailContent | null {
  const f = ctx.fin
  if (!f) return null
  const invoiceRows = (rows: OpsSummary['receivables']['due_invoices']) =>
    rows.map((row) => ({
      key: row.id,
      label: `${row.invoice_number} · ${row.customer_name}`,
      value: money(row.amount),
      hint:
        row.days_pending > 0
          ? `${row.days_pending} days past due`
          : row.days_pending === 0
            ? 'Due today'
            : `Due in ${-row.days_pending} days`,
    }))
  switch (key) {
    case 'invoiced':
      return {
        title: 'Total invoiced',
        action: finLink(ctx, 'View invoices', '/finance/invoices'),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Invoiced" value={money(f.revenue_metrics.invoiced)} />
              <DrawerStat label="Receivables" value={money(f.receivables.total)} />
            </DrawerGrid>
            <DrawerSection title="Billing vs collections">
              <DrawerRows
                rows={(ctx.series?.billing_vs_collections ?? []).slice(-6).reverse().map((row) => ({
                  key: row.month,
                  label: row.label,
                  value: money(row.billed),
                  hint: `Received ${money(row.received)}`,
                }))}
              />
            </DrawerSection>
          </>
        ),
      }
    case 'receivables':
      return {
        title: 'Receivables',
        action: finLink(ctx, 'View due invoices', '/finance/invoices?status=due'),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Total" value={money(f.receivables.total)} />
              <DrawerStat label="Due in 0–7 days" value={money(f.receivables.due_0_7)} />
              <DrawerStat label="Due later" value={money(f.receivables.due_8_30)} tone="warning" />
              <DrawerStat label="Overdue" value={money(f.receivables.overdue)} tone="danger" />
            </DrawerGrid>
            <DrawerSection title="Coming due">
              <DrawerRows rows={invoiceRows(f.receivables.due_invoices.slice(0, 8))} empty="No invoices coming due." />
            </DrawerSection>
          </>
        ),
      }
    case 'overdue':
      return {
        title: 'Overdue receivables',
        subtitle: 'Not received and past the due date',
        action: finLink(ctx, 'View overdue invoices', '/finance/invoices?status=overdue'),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Overdue" value={money(f.receivables.overdue)} tone="danger" />
              <DrawerStat label="Invoices" value={String(f.receivables.overdue_invoices.length)} />
            </DrawerGrid>
            <DrawerSection title="Oldest first">
              <DrawerRows
                rows={invoiceRows([...f.receivables.overdue_invoices].sort((a, b) => b.days_pending - a.days_pending).slice(0, 10))}
                empty="No overdue invoices."
              />
            </DrawerSection>
          </>
        ),
      }
    case 'net_cash':
      return {
        title: 'Net cash movement',
        action: finLink(ctx, 'Open cashflow', '/finance/cashflow/current'),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Inflow" value={money(f.cashflow_metrics.total_inflow)} tone="success" />
              <DrawerStat label="Outflow" value={money(f.cashflow_metrics.total_outflow)} tone="danger" />
            </DrawerGrid>
            <DrawerSection title="Breakdown">
              <DrawerRows
                rows={[
                  { key: 'rev-in', label: 'Revenue inflow', value: money(f.cashflow_metrics.revenue_inflow) },
                  { key: 'rev-out', label: 'Revenue outflow', value: money(f.cashflow_metrics.revenue_outflow) },
                  { key: 'cap-in', label: 'Capital inflow', value: money(f.cashflow_metrics.capital_inflow) },
                  { key: 'cap-out', label: 'Capital outflow', value: money(f.cashflow_metrics.capital_outflow) },
                  { key: 'net', label: 'Net movement', value: money(f.cashflow_metrics.net_cash_movement) },
                ]}
              />
            </DrawerSection>
          </>
        ),
      }
    case 'open_po':
    case 'to_be_invoiced':
      return {
        title: key === 'open_po' ? 'Open PO value' : 'To be invoiced',
        subtitle: key === 'open_po' ? 'PO value not yet invoiced' : 'Scheduled monthly billing on active POs',
        action: finLink(ctx, 'View purchase orders', '/finance/purchase-orders'),
        body: (
          <DrawerGrid>
            <DrawerStat label="Total PO value" value={money(f.po_metrics.total_po_value)} />
            <DrawerStat label="Open PO" value={money(f.po_metrics.open_po)} />
            <DrawerStat label="To be invoiced" value={money(f.po_metrics.to_be_invoiced)} />
            <DrawerStat label="Invoiced" value={money(f.revenue_metrics.invoiced)} />
          </DrawerGrid>
        ),
      }
    case 'payables':
      return {
        title: 'Payables pending',
        action: finLink(ctx, 'View payables', '/finance/payables'),
        body: (
          <>
            <DrawerGrid>
              <DrawerStat label="Pending" value={money(f.payables_pending)} tone="warning" />
              <DrawerStat label="Cash outflow" value={money(f.cashflow_metrics.total_outflow)} />
            </DrawerGrid>
            <DrawerNote>Vendor bills that are recorded but not yet paid.</DrawerNote>
          </>
        ),
      }
    case 'ops_closing': {
      const b = ctx.bank
      return {
        title: 'Ops closing balance',
        subtitle: b?.period_label,
        action: finLink(ctx, 'Open cashflow', '/finance/cashflow/current'),
        body: b ? (
          <>
            <DrawerGrid>
              <DrawerStat label="Combined closing" value={money(b.combined_closing)} />
              <DrawerStat label="Internal transfer" value={money(b.internal_transfer)} />
            </DrawerGrid>
            <DrawerSection title="Accounts">
              <DrawerRows
                rows={[b.operational, b.seed].map((acc) => ({
                  key: acc.label,
                  label: acc.label,
                  value: acc.available && acc.closing != null ? money(acc.closing) : '—',
                  hint: acc.subtitle,
                }))}
              />
            </DrawerSection>
          </>
        ) : (
          <DrawerNote>Bank position is not available for this range.</DrawerNote>
        ),
      }
    }
  }
}

export function buildDetail(detail: ExecutiveDetail, ctx: DetailContext): DetailContent | null {
  if (detail.kind === 'ops') return opsDetail(detail.key, ctx)
  if (detail.kind === 'stage') return stageDetail(detail.key, ctx)
  return financeDetail(detail.key, ctx)
}
