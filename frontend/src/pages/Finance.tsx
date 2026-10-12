import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  LayoutGrid,
  RefreshCw,
  IndianRupee,
  AlertTriangle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import { financeApi } from '../api/finance'
import { btnSecondaryClass } from '../components/Modal'
import { useDateRange } from '../hooks/useDateRange'
import { formatRangeLabel } from '../lib/dateRange'
import { chartCursor, tooltipProps } from '../lib/chartTheme'
import type { BankPosition, OpsDashboardSeries, OpsInvoiceRow, OpsSummary } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)

const fmtCompact = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`
  return fmt(n)
}

const CHART_COLORS = {
  brand: 'var(--color-chart-1)',
  amber: 'var(--color-chart-3)',
  teal: 'var(--color-chart-6)',
  red: 'var(--color-danger)',
  blue: 'var(--color-chart-4)',
  soft: 'var(--color-chart-5)',
}

/** Ordered 0-7 → 90+ days: fresh receivables green, oldest red. */
const AGING_COLORS = [
  'var(--color-success)',
  CHART_COLORS.amber,
  'var(--color-chart-7)',
  CHART_COLORS.soft,
  CHART_COLORS.red,
]
const DONUT_COLORS = [CHART_COLORS.brand, CHART_COLORS.amber, CHART_COLORS.teal, CHART_COLORS.blue, CHART_COLORS.soft, 'var(--color-chart-7)']

type CashMode = 'combined' | 'revenue' | 'capital'

function KpiCard({
  title,
  value,
  to,
  icon,
}: {
  title: string
  value: number
  to: string
  icon: ReactNode
}) {
  return (
    <Link
      to={to}
      className="block bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm hover:border-brand/30 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted flex items-center gap-1.5">
            {title}
          </p>
          <p className="text-2xl font-semibold text-ink mt-2 tabular-nums">{fmt(value)}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </Link>
  )
}

function InvoiceTable({
  rows,
  partyLabel,
  emptyLabel,
}: {
  rows: OpsInvoiceRow[]
  partyLabel: string
  emptyLabel: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-subtle py-4">{emptyLabel}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-subtle">
            <th className="py-2 font-semibold">{partyLabel}</th>
            <th className="py-2 font-semibold">Invoice</th>
            <th className="py-2 font-semibold">Value</th>
            <th className="py-2 font-semibold">Due date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-canvas text-sm">
              <td className="py-2.5 text-ink max-w-[140px] truncate">{row.customer_name}</td>
              <td className="py-2.5 text-muted font-mono text-xs">{row.invoice_number}</td>
              <td className="py-2.5 font-medium tabular-nums text-ink">{fmt(row.amount)}</td>
              <td className="py-2.5 text-muted whitespace-nowrap">{row.due_date ?? row.pending_since}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartCard({
  title,
  linkTo,
  linkLabel = 'View All →',
  children,
  empty,
}: {
  title: string
  linkTo?: string
  linkLabel?: string
  children: ReactNode
  empty?: boolean
}) {
  return (
    <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 shadow-sm min-h-[280px] flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {linkTo ? (
          <Link to={linkTo} className="text-xs font-medium text-brand hover:text-brand-hover shrink-0">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <div className="flex-1 min-h-[200px]">
        {empty ? <p className="text-sm text-subtle py-12 text-center">No data yet</p> : children}
      </div>
    </div>
  )
}

function BankRow({
  label,
  value,
  tone = 'default',
  pending,
}: {
  label: string
  value: number | null | undefined
  tone?: 'default' | 'out' | 'warn' | 'in'
  pending?: boolean
}) {
  const valueClass =
    tone === 'out'
      ? 'text-danger'
      : tone === 'warn'
        ? 'text-warning'
        : tone === 'in'
          ? 'text-success'
          : 'text-ink'
  const display =
    pending || value === null || value === undefined ? (pending ? 'Awaiting Seed book' : '—') : fmtCompact(value)
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span
        className={`font-medium tabular-nums ${pending || value === null || value === undefined ? 'text-muted text-xs' : valueClass}`}
      >
        {display}
      </span>
    </div>
  )
}

export default function Finance() {
  const [cashMode, setCashMode] = useState<CashMode>('combined')
  const [bankOpen, setBankOpen] = useState(true)
  const [agingOpen, setAgingOpen] = useState(false)
  const [payableAgingOpen, setPayableAgingOpen] = useState(false)
  const { from, to } = useDateRange()

  const summary = useQuery<OpsSummary>({
    queryKey: ['finance-ops-summary', from, to],
    queryFn: () => financeApi.opsSummary({ from, to }),
  })
  const series = useQuery<OpsDashboardSeries>({
    queryKey: ['finance-ops-dashboard-series', from, to],
    queryFn: () => financeApi.dashboardSeries({ from, to }),
  })
  const bankPosition = useQuery<BankPosition>({
    queryKey: ['finance-bank-position', from, to],
    queryFn: () => financeApi.bankPosition({ from, to }),
  })

  const data = summary.data
  const charts = series.data
  const bank = bankPosition.data

  const cashMetrics = useMemo(() => {
    if (!data) return { inflow: 0, outflow: 0, net: 0 }
    const m = data.cashflow_metrics
    if (cashMode === 'revenue') {
      return {
        inflow: m.revenue_inflow,
        outflow: m.revenue_outflow,
        net: m.revenue_inflow - m.revenue_outflow,
      }
    }
    if (cashMode === 'capital') {
      return {
        inflow: m.capital_inflow,
        outflow: m.capital_outflow,
        net: m.capital_inflow - m.capital_outflow,
      }
    }
    return {
      inflow: m.total_inflow,
      outflow: m.total_outflow,
      net: m.net_cash_movement,
    }
  }, [data, cashMode])

  const refresh = () => {
    void summary.refetch()
    void series.refetch()
    void bankPosition.refetch()
  }

  if (summary.isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-4">
        <div className="h-8 w-64 bg-canvas rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-canvas rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (summary.isError || !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-subtle">Could not load finance data.</p>
        <button type="button" onClick={refresh} className="mt-2 text-sm text-brand">
          Retry
        </button>
      </div>
    )
  }

  const rec = data.receivables
  const dueShare = rec.total > 0 ? (rec.due / rec.total) * 100 : 0
  const overdueShare = rec.total > 0 ? (rec.overdue / rec.total) * 100 : 0
  const duePreview = rec.due_invoices.slice(0, 5)
  const overduePreview = rec.overdue_invoices.slice(0, 5)
  const pay = data.payables
  const payDueShare = pay.total > 0 ? (pay.due / pay.total) * 100 : 0
  const payOverdueShare = pay.total > 0 ? (pay.overdue / pay.total) * 100 : 0
  const payDuePreview = pay.due_invoices.slice(0, 5)
  const payOverduePreview = pay.overdue_invoices.slice(0, 5)
  const asOfLabel = new Date(`${data.as_of}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const donutData = (charts?.inflow_by_category ?? []).slice(0, 6)
  const agingData = charts?.aging ?? []
  const netBars = (charts?.net_cash_monthly ?? []).map((row) => ({
    ...row,
    positive: row.net >= 0 ? row.net : 0,
    negative: row.net < 0 ? Math.abs(row.net) : 0,
  }))

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-8 min-w-0">
      {/* Financial Overview */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Financial Control</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h2 className="text-2xl font-semibold text-ink">Financial Overview</h2>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-soft text-brand border border-brand/20">
                {from && to ? formatRangeLabel(from, to) : 'All dates'} · as of {asOfLabel}
              </span>
            </div>
          </div>
          <button type="button" className={btnSecondaryClass} onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            Refresh Data
          </button>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand/70 mb-3">Revenue Overview</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              title="Total PO Value"
              value={data.po_metrics.total_po_value}
              to="/finance/purchase-orders"
              icon={<FileText className="w-5 h-5" strokeWidth={2} aria-hidden />}
            />
            <KpiCard
              title="Total Invoiced"
              value={data.revenue_metrics.invoiced}
              to="/finance/invoices"
              icon={<IndianRupee className="w-5 h-5" strokeWidth={2} aria-hidden />}
            />
            <KpiCard
              title="Open PO"
              value={data.po_metrics.open_po}
              to="/finance/purchase-orders"
              icon={<FolderOpen className="w-5 h-5" strokeWidth={2} aria-hidden />}
            />
            <KpiCard
              title="To Be Invoiced"
              value={data.po_metrics.to_be_invoiced}
              to="/finance/invoices"
              icon={<CalendarClock className="w-5 h-5" strokeWidth={2} aria-hidden />}
            />
          </div>
        </div>

        <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-ink">Receivables</h3>
            <Link to="/finance/invoices" className="text-xs font-medium text-brand hover:text-brand-hover">
              View All →
            </Link>
          </div>

          <div className="rounded-xl bg-canvas/80 border border-line px-4 py-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Total Receivables</p>
              <p className="text-3xl font-semibold text-brand mt-1 tabular-nums">{fmt(rec.total)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-2.5 rounded-full overflow-hidden flex bg-canvas">
              <div className="h-full bg-emerald-500" style={{ width: `${dueShare}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${overdueShare}%` }} />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                Due {fmt(rec.due)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden />
                Overdue {fmt(rec.overdue)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-ink">Due (not yet past due date)</p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">{fmt(rec.due)}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                <li className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                    Due in 0–7 days
                  </span>
                  <span className="tabular-nums text-ink font-medium">{fmt(rec.due_0_7)}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500" aria-hidden />
                    Due later
                  </span>
                  <span className="tabular-nums text-ink font-medium">{fmt(rec.due_8_30)}</span>
                </li>
              </ul>
              <div className="mt-3">
                <InvoiceTable rows={duePreview} partyLabel="Customer" emptyLabel="No invoices in this bucket" />
              </div>
              <Link
                to="/finance/invoices?status=due"
                className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-brand hover:text-brand-hover"
              >
                View All ({rec.due_invoices.length})
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
              </Link>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Overdue (past due date)</p>
              <p className="text-lg font-semibold text-danger mt-1 tabular-nums">{fmt(rec.overdue)}</p>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
                onClick={() => setAgingOpen((o) => !o)}
              >
                Expand aging breakdown
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${agingOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
              {agingOpen ? (
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {(charts?.aging ?? [])
                    .filter((row) => row.bucket !== 'Due')
                    .map((row) => (
                      <li key={row.bucket} className="flex items-center justify-between gap-2">
                        <span>{row.bucket} days</span>
                        <span className="tabular-nums text-ink font-medium">{fmt(row.amount)}</span>
                      </li>
                    ))}
                </ul>
              ) : null}
              <div className="mt-3">
                <InvoiceTable rows={overduePreview} partyLabel="Customer" emptyLabel="No invoices in this bucket" />
              </div>
              <Link
                to="/finance/invoices?status=overdue"
                className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-brand hover:text-brand-hover"
              >
                View All ({rec.overdue_invoices.length})
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-ink">Payables</h3>
            <Link to="/finance/payables" className="text-xs font-medium text-brand hover:text-brand-hover">
              View All →
            </Link>
          </div>

          <div className="rounded-xl bg-canvas/80 border border-line px-4 py-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Total Payables</p>
              <p className="text-3xl font-semibold text-brand mt-1 tabular-nums">{fmt(pay.total)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-2.5 rounded-full overflow-hidden flex bg-canvas">
              <div className="h-full bg-emerald-500" style={{ width: `${payDueShare}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${payOverdueShare}%` }} />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                Due {fmt(pay.due)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden />
                Overdue {fmt(pay.overdue)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-ink">Due (not yet past due date)</p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">{fmt(pay.due)}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                <li className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                    Due in 0–7 days
                  </span>
                  <span className="tabular-nums text-ink font-medium">{fmt(pay.due_0_7)}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500" aria-hidden />
                    Due later
                  </span>
                  <span className="tabular-nums text-ink font-medium">{fmt(pay.due_8_30)}</span>
                </li>
              </ul>
              <div className="mt-3">
                <InvoiceTable rows={payDuePreview} partyLabel="Vendor" emptyLabel="No bills in this bucket" />
              </div>
              <Link
                to="/finance/payables?status=due"
                className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-brand hover:text-brand-hover"
              >
                View All ({pay.due_invoices.length})
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
              </Link>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Overdue (past due date)</p>
              <p className="text-lg font-semibold text-danger mt-1 tabular-nums">{fmt(pay.overdue)}</p>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
                onClick={() => setPayableAgingOpen((open) => !open)}
              >
                Expand aging breakdown
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${payableAgingOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
              {payableAgingOpen ? (
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {pay.aging.map((row) => (
                    <li key={row.bucket} className="flex items-center justify-between gap-2">
                      <span>{row.bucket} days</span>
                      <span className="tabular-nums text-ink font-medium">{fmt(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3">
                <InvoiceTable rows={payOverduePreview} partyLabel="Vendor" emptyLabel="No bills in this bucket" />
              </div>
              <Link
                to="/finance/payables?status=overdue"
                className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-brand hover:text-brand-hover"
              >
                View All ({pay.overdue_invoices.length})
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Cash Health */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-end gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              All Cash (Revenue + Capital)
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span>
                Inflow{' '}
                <span className="font-semibold text-success tabular-nums">{fmt(cashMetrics.inflow)}</span>
              </span>
              <span>
                Outflow{' '}
                <span className="font-semibold text-danger tabular-nums">{fmt(cashMetrics.outflow)}</span>
              </span>
              <span>
                Net{' '}
                <span
                  className={`font-semibold tabular-nums ${
                    cashMetrics.net >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {fmt(cashMetrics.net)}
                </span>
              </span>
            </div>
          </div>
          <div className="inline-flex rounded-xl border border-line bg-canvas/60 p-0.5 self-start">
            {(
              [
                { id: 'combined', label: 'Combined' },
                { id: 'revenue', label: 'Revenue' },
                { id: 'capital', label: 'Capital' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCashMode(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-[10px] transition-colors ${
                  cashMode === opt.id ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-surface border border-brand/30 rounded-2xl p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Total Inflow</p>
            <p className="text-2xl font-semibold text-success mt-2 tabular-nums inline-flex items-center gap-1.5">
              {fmt(cashMetrics.inflow)}
              <ArrowUpRight className="w-4 h-4" strokeWidth={2} aria-hidden />
            </p>
          </div>
          <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Total Outflow</p>
            <p className="text-2xl font-semibold text-danger mt-2 tabular-nums inline-flex items-center gap-1.5">
              {fmt(cashMetrics.outflow)}
              <ArrowDownRight className="w-4 h-4" strokeWidth={2} aria-hidden />
            </p>
          </div>
          <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Net Cash Movement</p>
            <p
              className={`text-2xl font-semibold mt-2 tabular-nums inline-flex items-center gap-1.5 ${
                cashMetrics.net >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {fmt(cashMetrics.net)}
              {cashMetrics.net >= 0 ? (
                <ArrowUpRight className="w-4 h-4" strokeWidth={2} aria-hidden />
              ) : (
                <ArrowDownRight className="w-4 h-4" strokeWidth={2} aria-hidden />
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Bank Position — Operational from Bank book; Seed awaiting Seed book */}
      <section className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setBankOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-brand-soft/60 border-b border-brand/10 text-left"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <LayoutGrid className="w-4 h-4 text-brand shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-sm font-semibold text-ink uppercase tracking-wide">Bank Position</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-brand text-white">
              {bank?.period_label || 'Bank book'}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface/80 backdrop-blur-md border border-line text-muted">
              {bank?.combined_scope === 'operational' ? 'Operational' : 'Combined'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted hidden sm:inline">
              Closing: {bank?.operational.available ? fmtCompact(bank.combined_closing) : '—'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-muted transition-transform ${bankOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
              aria-hidden
            />
          </div>
        </button>

        {bankOpen ? (
          <>
            {bankPosition.isLoading ? (
              <div className="p-4 sm:p-6 text-sm text-muted">Loading bank position…</div>
            ) : bankPosition.isError ? (
              <div className="p-6">
                <p className="text-sm text-subtle">Could not load bank position.</p>
                <button type="button" onClick={() => void bankPosition.refetch()} className="mt-2 text-sm text-brand">
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
                  <div className="rounded-2xl border border-line p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">{bank?.seed.label ?? 'Seed Fund Account'}</p>
                        <p className="text-xs text-muted mt-0.5">{bank?.seed.subtitle ?? 'Seedfund · Capital Pool'}</p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        Capital
                      </span>
                    </div>
                    <div className="mt-3 divide-y divide-canvas">
                      <BankRow label="Opening Balance" value={bank?.seed.opening} pending />
                      <BankRow label="− Disbursements" value={bank?.seed.disbursements} tone="out" pending />
                      <BankRow
                        label="− Transfer to Ops"
                        value={bank?.seed.transfer_to_ops}
                        tone="warn"
                        pending={bank?.seed.transfer_to_ops == null}
                      />
                    </div>
                    <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">Closing Balance</span>
                      <span className="text-xs font-medium text-muted">Awaiting Seed bank book</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Internal</p>
                    <div className="w-14 h-14 rounded-full border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-[11px] font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                      {bank && bank.internal_transfer > 0 ? fmtCompact(bank.internal_transfer) : '—'}
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Transfer</p>
                  </div>

                  <div className="rounded-2xl border border-line p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {bank?.operational.label ?? 'Operational Account'}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {bank?.operational.subtitle ?? 'Current A/c · Day-to-Day'}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        Revenue
                      </span>
                    </div>
                    <div className="mt-3 divide-y divide-canvas">
                      <BankRow label="Opening Balance" value={bank?.operational.opening ?? 0} />
                      <BankRow label="+ Transfer In" value={bank?.operational.transfer_in ?? 0} tone="warn" />
                      <BankRow label="+ Revenue Receipts" value={bank?.operational.revenue_receipts ?? 0} tone="in" />
                      <BankRow label="− All Outflows" value={bank?.operational.all_outflows ?? 0} tone="out" />
                      {(bank?.operational.transfer_out ?? 0) > 0 ? (
                        <BankRow label="− Transfer Out" value={bank?.operational.transfer_out ?? 0} tone="warn" />
                      ) : null}
                    </div>
                    <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">Closing Balance</span>
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          (bank?.operational.closing ?? 0) >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {bank?.operational.available ? fmtCompact(bank.operational.closing ?? 0) : '—'}
                      </span>
                    </div>
                    {!bank?.operational.available ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1">
                        <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                        Upload MIS Bank book to populate
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="px-4 py-3 bg-brand-soft/40 border-t border-brand/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <p className="text-xs text-muted">
                    Combined Closing (Operational
                    {bank?.seed.available ? ' + Seed Fund' : ''}
                    ) · {bank?.period_label || 'Bank book'}
                    {!bank?.seed.available ? ' · Seed awaiting bank book' : ''}
                  </p>
                  <p className="text-sm font-semibold text-brand tabular-nums">
                    {bank?.operational.available ? fmtCompact(bank.combined_closing) : '—'}
                  </p>
                </div>
              </>
            )}
          </>
        ) : null}
      </section>

      {/* Analytics */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Analytics</p>
          {series.isLoading ? <span className="text-xs text-subtle">Loading charts…</span> : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Billing vs Collections"
            linkTo="/finance/invoices"
            empty={!charts || charts.billing_vs_collections.every((r) => !r.billed && !r.received)}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts?.billing_vs_collections ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtCompact(Number(v))}
                  width={56}
                />
                <Tooltip {...tooltipProps} formatter={(value) => fmt(Number(value ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="billed" name="Billed" fill={CHART_COLORS.brand} radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Received" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Inflow by Category"
            linkTo="/finance/cashflow/current"
            empty={!donutData.length}
          >
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {donutData.map((_, i) => (
                    <Cell key={donutData[i].category} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} formatter={(value) => fmt(Number(value ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Cash Inflow vs Outflow"
            linkTo="/finance/cashflow/current"
            empty={!charts || charts.cash_in_out.every((r) => !r.inflow && !r.outflow)}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts?.cash_in_out ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtCompact(Number(v))}
                  width={56}
                />
                <Tooltip {...tooltipProps} formatter={(value) => fmt(Number(value ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inflow" name="Inflow" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflow" name="Outflow" fill={CHART_COLORS.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Aging Breakdown"
            linkTo="/finance/invoices"
            empty={!agingData.some((r) => r.amount > 0)}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingData} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  tickFormatter={(v) => `${v} d`}
                  axisLine={{ stroke: 'var(--color-line)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtCompact(Number(v))}
                  width={64}
                />
                <Tooltip
                  {...tooltipProps}
                  cursor={chartCursor}
                  labelFormatter={(label) => `${label} days`}
                  formatter={(value) => fmt(Number(value ?? 0))}
                />
                <Bar dataKey="amount" name="Outstanding" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {agingData.map((row, i) => (
                    <Cell key={row.bucket} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="amount"
                    position="top"
                    formatter={(v) => (Number(v) > 0 ? fmtCompact(Number(v)) : '')}
                    style={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-ink)' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Net Cash Position" linkTo="/finance/cashflow/current">
            <div className="h-full flex flex-col">
              <p
                className={`text-3xl font-semibold tabular-nums ${
                  cashMetrics.net >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {fmt(cashMetrics.net)}
              </p>
              <p className="text-xs text-muted mt-1">Combined net cash movement (all time)</p>
              <div className="flex-1 mt-3 min-h-[120px]">
                {!netBars.length ? (
                  <p className="text-sm text-subtle py-8 text-center">No monthly data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={netBars}>
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} />
                      <Tooltip {...tooltipProps} formatter={(value) => fmt(Number(value ?? 0))} />
                      <Bar dataKey="positive" name="Surplus" stackId="net" fill={CHART_COLORS.teal} />
                      <Bar dataKey="negative" name="Deficit" stackId="net" fill={CHART_COLORS.red} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </ChartCard>

          <ChartCard
            title="Receivables Trend"
            linkTo="/finance/invoices"
            empty={!charts || charts.receivables_trend.every((r) => !r.amount)}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={charts?.receivables_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtCompact(Number(v))}
                  width={56}
                />
                <Tooltip {...tooltipProps} formatter={(value) => fmt(Number(value ?? 0))} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Receivables"
                  stroke={CHART_COLORS.brand}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS.brand }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>
    </div>
  )
}
