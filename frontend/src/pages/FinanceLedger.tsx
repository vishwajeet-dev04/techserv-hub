import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  TrendingUp,
} from 'lucide-react'
import { financeApi } from '../api/finance'
import type {
  CapitalRow,
  CashflowAccount,
  CashflowRow,
  LedgerCashflowCard,
  LedgerCashflowSummary,
  LedgerInvoicesSummary,
  LedgerPayablesSummary,
  LedgerPoSummary,
  OpsInvoice,
  OpsPayable,
  PurchaseOrder,
} from '../types'
import {
  FinancePageShell,
  KpiCard,
  StatusBadge,
  formatInr,
  useFinanceFilters,
} from '../components/finance/FinancePageShell'
import { PulsePaginationFooter } from '../components/pulse/PulseTableShell'

const fmt = formatInr

function TableWrap({
  headers,
  children,
  footer,
}: {
  headers: string[]
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-pin-first w-full min-w-[760px]">
          <thead>
            <tr className="bg-canvas border-b border-line">
              {headers.map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-subtle">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3 border-t border-line">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

function PageFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Financial Control</p>
        <h2 className="text-xl sm:text-2xl font-semibold text-ink mt-1">{title}</h2>
        <p className="text-xs text-muted mt-1">{subtitle}</p>
      </div>
      <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl overflow-x-auto shadow-sm">{children}</div>
    </div>
  )
}

const CAPITAL_LABELS: Record<string, string> = {
  'investments-received': 'INVESTMENT_RECEIVED',
  'investments-made': 'INVESTMENT_MADE',
  'loans-provided': 'LOAN_PROVIDED',
  'loans-taken': 'LOAN_TAKEN',
}

function priorPeriodRange(from: string, to: string): { from: string; to: string } | null {
  if (!from || !to) return null
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  const dayMs = 24 * 60 * 60 * 1000
  const lengthDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1
  const priorEnd = new Date(start.getTime() - dayMs)
  const priorStart = new Date(priorEnd.getTime() - (lengthDays - 1) * dayMs)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(priorStart), to: iso(priorEnd) }
}

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

function formatPctDelta(pct: number | null): string | null {
  if (pct === null || !Number.isFinite(pct)) return null
  const rounded = Math.round(pct * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}% vs last period`
}

function CashflowMetricCard({
  label,
  value,
  delta,
  icon,
  wash,
  iconTone,
}: {
  label: string
  value: string
  delta?: string | null
  icon: ReactNode
  wash: string
  iconTone: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-surface/80 backdrop-blur-md px-4 py-4 shadow-sm ${wash}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
          <p className="text-xl font-semibold text-ink mt-1.5 tabular-nums">{value}</p>
          {delta ? <p className="text-xs text-subtle mt-1.5">{delta}</p> : null}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconTone}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function SideMetric({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string
  value: string
  icon: ReactNode
  valueClass: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-base font-semibold tabular-nums mt-2 ${valueClass}`}>{value}</p>
    </div>
  )
}

function CashflowCategoryCard({ card }: { card: LedgerCashflowCard }) {
  const isIn = card.direction === 'Inflow'
  return (
    <div
      className={`rounded-2xl border border-line px-4 py-3.5 shadow-sm ${
        isIn ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : 'bg-rose-50/70 dark:bg-rose-950/30'
      }`}
    >
      <p className="text-xs font-medium text-muted truncate" title={card.category}>
        {card.category}
      </p>
      <p
        className={`text-lg font-semibold tabular-nums mt-2 ${
          isIn ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
        }`}
      >
        {fmt(card.amount)}
      </p>
    </div>
  )
}

function CashflowCardColumn({
  title,
  total,
  cards,
  tone,
}: {
  title: string
  total: number
  cards: LedgerCashflowCard[]
  tone: 'in' | 'out'
}) {
  const isIn = tone === 'in'
  return (
    <section aria-label={title} className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {isIn ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" strokeWidth={2} aria-hidden />
          )}
          {title}
        </p>
        <p className={`text-xs font-semibold tabular-nums ${isIn ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
          {fmt(total)}
        </p>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs text-subtle">
          No {isIn ? 'inflows' : 'outflows'} in this period.
        </p>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {cards.map((card) => (
            <CashflowCategoryCard key={card.category} card={card} />
          ))}
        </div>
      )}
    </section>
  )
}

const CASHFLOW_PAGE_COPY: Record<CashflowAccount, { title: string; subtitle: string }> = {
  CURRENT: {
    title: 'Cashflow · Current / Operational',
    subtitle: 'Day-to-day Current A/c inflow and outflow across revenue, operating, and capital',
  },
  SEED: {
    title: 'Cashflow · Seed Account',
    subtitle: 'Seed fund capital pool movements',
  },
}

export function CashflowPage({ account = 'CURRENT' }: { account?: CashflowAccount }) {
  const { filters, setFilters } = useFinanceFilters()
  const prior = useMemo(() => priorPeriodRange(filters.from, filters.to), [filters.from, filters.to])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const list = useQuery({
    queryKey: ['cashflow', account, filters.from, filters.to, filters.search, page, pageSize],
    queryFn: () =>
      financeApi.listCashflow({
        account,
        from: filters.from,
        to: filters.to,
        search: filters.search,
        page,
        page_size: pageSize,
      }),
    placeholderData: keepPreviousData,
  })
  const summary = useQuery({
    queryKey: ['ledger-summary', 'cashflow', account, filters.from, filters.to],
    queryFn: () => financeApi.ledgerSummary('cashflow', { account, from: filters.from, to: filters.to }),
  })
  const priorSummary = useQuery({
    queryKey: ['ledger-summary', 'cashflow', account, 'prior', prior?.from, prior?.to],
    queryFn: () => financeApi.ledgerSummary('cashflow', { account, from: prior!.from, to: prior!.to }),
    enabled: Boolean(prior),
  })
  const invoicesSummary = useQuery({
    queryKey: ['ledger-summary', 'invoices', filters.from, filters.to],
    queryFn: () => financeApi.ledgerSummary('invoices', { from: filters.from, to: filters.to }),
  })
  const payablesSummary = useQuery({
    queryKey: ['ledger-summary', 'payables', filters.from, filters.to],
    queryFn: () => financeApi.ledgerSummary('payables', { from: filters.from, to: filters.to }),
  })
  const rows: CashflowRow[] = list.data?.results ?? []
  const kpi = (summary.data || {}) as LedgerCashflowSummary
  const prev = (priorSummary.data || {}) as LedgerCashflowSummary
  const ar = (invoicesSummary.data || {}) as LedgerInvoicesSummary
  const ap = (payablesSummary.data || {}) as LedgerPayablesSummary

  const showDelta = Boolean(prior && priorSummary.data)
  const inflowDelta = showDelta ? formatPctDelta(pctChange(kpi.total_inflow || 0, prev.total_inflow || 0)) : null
  const outflowDelta = showDelta ? formatPctDelta(pctChange(kpi.total_outflow || 0, prev.total_outflow || 0)) : null
  const netDelta = showDelta ? formatPctDelta(pctChange(kpi.net || 0, prev.net || 0)) : null
  const accountEmpty = summary.isSuccess && !kpi.has_entries
  const copy = CASHFLOW_PAGE_COPY[account]

  return (
    <FinancePageShell
      title={copy.title}
      subtitle={copy.subtitle}
      filters={filters}
      onFiltersChange={(next) => {
        setPage(1)
        setFilters(next)
      }}
      onRefresh={() => {
        void list.refetch()
        void summary.refetch()
        void priorSummary.refetch()
        void invoicesSummary.refetch()
        void payablesSummary.refetch()
      }}
      updatedAt={list.dataUpdatedAt ? new Date(list.dataUpdatedAt) : null}
      searchPlaceholder="Search particulars, category, type, or notes…"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <CashflowMetricCard
          label="Total Inflow"
          value={fmt(kpi.total_inflow || 0)}
          delta={inflowDelta}
          icon={<ArrowUpRight className="w-5 h-5" strokeWidth={2} aria-hidden />}
          wash="bg-gradient-to-br from-emerald-50/80 via-white to-white dark:from-emerald-950/40 dark:via-surface dark:to-surface"
          iconTone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
        />
        <CashflowMetricCard
          label="Total Outflow"
          value={fmt(kpi.total_outflow || 0)}
          delta={outflowDelta}
          icon={<ArrowDownRight className="w-5 h-5" strokeWidth={2} aria-hidden />}
          wash="bg-gradient-to-br from-rose-50/80 via-white to-white dark:from-rose-950/40 dark:via-surface dark:to-surface"
          iconTone="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
        />
        <CashflowMetricCard
          label="Net"
          value={fmt(kpi.net || 0)}
          delta={netDelta}
          icon={<TrendingUp className="w-5 h-5" strokeWidth={2} aria-hidden />}
          wash="bg-gradient-to-br from-violet-50/80 via-white to-white dark:from-violet-950/40 dark:via-surface dark:to-surface"
          iconTone="bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
        />
      </div>

      {accountEmpty ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface/80 backdrop-blur-md px-6 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-ink">
            No {account === 'SEED' ? 'Seed account' : 'Current account'} entries yet
          </p>
          <p className="text-xs text-muted mt-1.5">
            {account === 'SEED'
              ? "Upload an MIS file with a 'Seed Bank book' sheet to populate this account."
              : "Upload an MIS file with a 'Bank book' sheet to populate this account."}
          </p>
        </div>
      ) : summary.isSuccess ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface/60 backdrop-blur-md p-4 shadow-sm grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-5">
          <CashflowCardColumn title="Inflow" total={kpi.total_inflow || 0} cards={kpi.inflow_cards ?? []} tone="in" />
          <div className="h-px lg:h-auto lg:w-px bg-line" role="separator" aria-orientation="vertical" />
          <CashflowCardColumn title="Outflow" total={kpi.total_outflow || 0} cards={kpi.outflow_cards ?? []} tone="out" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="rounded-2xl border border-line bg-surface/80 backdrop-blur-md p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Receivable</p>
            <Link
              to="/finance/invoices"
              className="text-xs font-medium text-brand hover:text-brand-hover inline-flex items-center gap-1"
            >
              View Details →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <SideMetric
              label="Total Receivable"
              value={fmt(ar.billed || 0)}
              icon={<CreditCard className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-brand"
            />
            <SideMetric
              label="Total Received"
              value={fmt(ar.received || 0)}
              icon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-success"
            />
            <SideMetric
              label="Outstanding"
              value={fmt(ar.outstanding || 0)}
              icon={<Clock3 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-danger"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface/80 backdrop-blur-md p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Payable</p>
            <Link
              to="/finance/payables"
              className="text-xs font-medium text-brand hover:text-brand-hover inline-flex items-center gap-1"
            >
              View Details →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <SideMetric
              label="Total Payable"
              value={fmt(ap.total_payable || 0)}
              icon={<CreditCard className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-brand"
            />
            <SideMetric
              label="Total Paid"
              value={fmt(ap.total_paid || 0)}
              icon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-success"
            />
            <SideMetric
              label="Outstanding"
              value={fmt(ap.outstanding || 0)}
              icon={<Clock3 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-danger"
            />
          </div>
        </div>
      </div>

      <div className="mt-5" id="cashflow-recent-transactions">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-ink">Recent Transactions</h3>
          {list.data ? <p className="text-xs text-muted tabular-nums">{list.data.count} entries</p> : null}
        </div>
        {list.isLoading ? (
          <p className="p-5 text-sm text-subtle bg-surface/80 backdrop-blur-md border border-line rounded-2xl">Loading…</p>
        ) : (
          <TableWrap
            headers={['Date', 'Type', 'Particulars', 'Category', 'Sub', 'Amount']}
            footer={
              <PulsePaginationFooter
                page={page}
                pageSize={pageSize}
                total={list.data?.count ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            }
          >
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-subtle">
                  No transactions in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-canvas last:border-0">
                  <td className="px-5 py-3 text-sm text-ink whitespace-nowrap">{row.entry_date}</td>
                  <td className="px-5 py-3 text-sm">
                    <StatusBadge status={row.direction} />
                  </td>
                  <td className="px-5 py-3 text-sm text-ink">{row.entity || '—'}</td>
                  <td className="px-5 py-3 text-sm text-ink">{row.category}</td>
                  <td className="px-5 py-3 text-sm text-muted">{row.sub_category || '—'}</td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums text-ink">{fmt(row.amount)}</td>
                </tr>
              ))
            )}
          </TableWrap>
        )}
      </div>
    </FinancePageShell>
  )
}

type PayableTab = 'ALL' | 'PAID' | 'PENDING'
type InvoiceTab = 'all' | 'outstanding' | 'overdue' | 'paid'

const INVOICE_TABS: { key: InvoiceTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
]

/** Mirrors the backend receivables rule: unpaid balance pending more than 30 days since due (or invoice) date. */
function invoiceOverdue(row: OpsInvoice, today: Date): boolean {
  if (row.status === 'PAID' || Number(row.balance) <= 0) return false
  const since = new Date(`${row.due_date || row.invoice_date}T00:00:00`)
  return (today.getTime() - since.getTime()) / 86_400_000 > 30
}

function matchesInvoiceTab(row: OpsInvoice, tab: InvoiceTab, today: Date): boolean {
  const paid = row.status === 'PAID' || Number(row.balance) <= 0
  if (tab === 'paid') return paid
  if (tab === 'outstanding') return !paid
  if (tab === 'overdue') return invoiceOverdue(row, today)
  return true
}

/** Status tab backed by `?status=` so other pages can deep-link into a filtered ledger. */
function useStatusParam<T extends string>(allowed: readonly T[], fallback: T, normalise: (raw: string) => string = (v) => v) {
  const [params, setParams] = useSearchParams()
  const raw = normalise(params.get('status') ?? '')
  const value = (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
  const setValue = (next: T) => {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev)
        if (next === fallback) out.delete('status')
        else out.set('status', next.toLowerCase())
        return out
      },
      { replace: true },
    )
  }
  return [value, setValue] as const
}

/** Unpaid invoices: red once past due, amber inside the 3-day reminder window. */
function invoiceDueTone(row: OpsInvoice, todayStart: number): string {
  if (row.status === 'PAID' || !row.due_date) return 'text-muted'
  const days = (new Date(`${row.due_date}T00:00:00`).getTime() - todayStart) / 86_400_000
  if (days < 0) return 'text-danger font-medium'
  if (days <= 3) return 'text-warning font-medium'
  return 'text-muted'
}

/** Pending bills: red once past due, amber inside the 3-day reminder window. */
function payableDueTone(row: OpsPayable, todayStart: number): string {
  if (row.status === 'PAID' || !row.due_date) return 'text-muted'
  const days = (new Date(`${row.due_date}T00:00:00`).getTime() - todayStart) / 86_400_000
  if (days < 0) return 'text-danger font-medium'
  if (days <= 3) return 'text-warning font-medium'
  return 'text-muted'
}

export function PayablesPage() {
  const { filters, setFilters } = useFinanceFilters()
  const [tab, setTab] = useStatusParam<PayableTab>(['ALL', 'PAID', 'PENDING'], 'ALL', (v) => v.toUpperCase())
  const list = useQuery({
    queryKey: ['payables', filters.from, filters.to, filters.vendor, filters.search, tab],
    queryFn: () =>
      financeApi.listPayables({
        from: filters.from,
        to: filters.to,
        vendor: filters.vendor,
        search: filters.search,
        status: tab === 'ALL' ? '' : tab,
      }),
  })
  const summary = useQuery({
    queryKey: ['ledger-summary', 'payables', filters.from, filters.to],
    queryFn: () => financeApi.ledgerSummary('payables', { from: filters.from, to: filters.to }),
  })
  const rows: OpsPayable[] = list.data?.results ?? []
  const kpi = (summary.data || {}) as LedgerPayablesSummary
  const [todayStart] = useState(() => new Date().setHours(0, 0, 0, 0))
  const vendors = useMemo(
    () => Array.from(new Set(rows.map((r) => r.vendor).filter(Boolean))).sort(),
    [rows],
  )

  return (
    <FinancePageShell
      title="Payables"
      subtitle="Vendor bills, GST, TDS, and outstanding payments"
      filters={filters}
      onFiltersChange={setFilters}
      onRefresh={() => {
        void list.refetch()
        void summary.refetch()
      }}
      updatedAt={list.dataUpdatedAt ? new Date(list.dataUpdatedAt) : null}
      showVendorFilter
      vendors={vendors}
      searchPlaceholder="Search vendor…"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Total Payable" value={fmt(kpi.total_payable || 0)} />
        <KpiCard label="Paid" value={fmt(kpi.total_paid || 0)} tone="in" hint={`${kpi.paid_count || 0} bills`} />
        <KpiCard label="Outstanding" value={fmt(kpi.outstanding || 0)} tone="out" hint={`${kpi.pending_count || 0} bills`} />
        <KpiCard label="TDS Deducted" value={fmt(kpi.tds_deducted || 0)} tone="net" />
      </div>

      {(kpi.by_category || []).length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {kpi.by_category.slice(0, 8).map((row) => (
            <div key={row.category} className="rounded-xl border border-line bg-surface/80 backdrop-blur-md px-3 py-2 text-xs shadow-sm">
              <span className="text-muted">{row.category}</span>
              <span className="ml-2 font-semibold text-ink tabular-nums">{fmt(row.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        {(['ALL', 'PAID', 'PENDING'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
              tab === key ? 'bg-brand text-white border-brand' : 'bg-surface text-muted border-line hover:text-ink'
            }`}
          >
            {key === 'PENDING' ? 'Outstanding' : key === 'ALL' ? 'All' : 'Paid'}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {list.isLoading ? (
          <p className="p-5 text-sm text-subtle">Loading…</p>
        ) : (
          <TableWrap
            headers={['Vendor', 'Category', 'Invoice', 'Invoice Date', 'Basic/Pretax', 'GST', 'TDS', 'Total', 'Payable', 'Due Date', 'Status']}
          >
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-canvas">
                <td className="px-5 py-3 text-sm font-medium text-ink">{row.vendor}</td>
                <td className="px-5 py-3 text-sm text-muted">{row.category}</td>
                <td className="px-5 py-3 text-xs font-mono text-ink">{row.invoice_number}</td>
                <td className="px-5 py-3 text-sm text-muted whitespace-nowrap">{row.invoice_date ?? '—'}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.taxable_amount)}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.gst_amount)}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.tds_amount)}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.total_amount)}</td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.payable_amount)}</td>
                <td className={`px-5 py-3 text-sm whitespace-nowrap ${payableDueTone(row, todayStart)}`}>{row.due_date ?? '—'}</td>
                <td className="px-5 py-3 text-sm"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </TableWrap>
        )}
      </div>
    </FinancePageShell>
  )
}

export function PurchaseOrdersPage() {
  const { filters, setFilters } = useFinanceFilters()
  const list = useQuery({
    queryKey: ['purchase-orders', filters.from, filters.to, filters.client, filters.search],
    queryFn: () =>
      financeApi.listPurchaseOrders({
        from: filters.from,
        to: filters.to,
        client: filters.client,
        search: filters.search,
      }),
  })
  const summary = useQuery({
    queryKey: ['ledger-summary', 'purchase-orders'],
    queryFn: () => financeApi.ledgerSummary('purchase-orders'),
  })
  const rows: PurchaseOrder[] = list.data?.results ?? []
  const kpi = (summary.data || {}) as LedgerPoSummary
  const clients = useMemo(
    () => Array.from(new Set(rows.map((r) => r.customer_name).filter(Boolean))).sort(),
    [rows],
  )

  return (
    <FinancePageShell
      title="PO Management"
      subtitle="Purchase orders, billing cycle, and remaining billable value"
      filters={filters}
      onFiltersChange={setFilters}
      onRefresh={() => {
        void list.refetch()
        void summary.refetch()
      }}
      updatedAt={list.dataUpdatedAt ? new Date(list.dataUpdatedAt) : null}
      showClientFilter
      clients={clients}
      searchPlaceholder="Search client…"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <KpiCard label="POs tracked" value={String(kpi.count || rows.length)} />
        <KpiCard label="Active" value={String(kpi.active || 0)} tone="in" />
      </div>
      {list.isLoading ? (
        <p className="p-5 text-sm text-subtle">Loading…</p>
      ) : (
        <TableWrap headers={['PO', 'Customer', 'Service', 'Billing', 'Value', 'Progress', 'Remaining', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-canvas">
              <td className="px-5 py-3 text-xs font-mono text-ink">{row.po_number}</td>
              <td className="px-5 py-3 text-sm font-medium text-ink">{row.customer_name}</td>
              <td className="px-5 py-3 text-sm text-muted">{row.service_category}</td>
              <td className="px-5 py-3 text-sm text-muted">{row.billing_cycle || '—'}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.total_value)}</td>
              <td className="px-5 py-3 min-w-[140px]">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-canvas overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(100, row.progress || 0)}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-muted w-10 text-right">{Math.round(row.progress || 0)}%</span>
                </div>
                <p className="text-[11px] text-subtle mt-1">{fmt(row.invoiced_value)} invoiced</p>
              </td>
              <td className="px-5 py-3 text-sm tabular-nums text-ink">{fmt(row.remaining_value ?? Math.max(0, row.total_value - row.invoiced_value))}</td>
              <td className="px-5 py-3 text-sm"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </TableWrap>
      )}
    </FinancePageShell>
  )
}

export function InvoicesPage() {
  const { filters, setFilters } = useFinanceFilters()
  const list = useQuery({
    queryKey: ['invoices', filters.from, filters.to, filters.client, filters.search],
    queryFn: () =>
      financeApi.listInvoices({
        from: filters.from,
        to: filters.to,
        client: filters.client,
        search: filters.search,
      }),
  })
  const summary = useQuery({
    queryKey: ['ledger-summary', 'invoices', filters.from, filters.to],
    queryFn: () => financeApi.ledgerSummary('invoices', { from: filters.from, to: filters.to }),
  })
  const [tab, setTab] = useStatusParam<InvoiceTab>(['all', 'outstanding', 'overdue', 'paid'], 'all', (v) => v.toLowerCase())
  const allRows = useMemo<OpsInvoice[]>(() => list.data?.results ?? [], [list.data])
  const rows = useMemo(() => {
    const today = new Date()
    return allRows.filter((row) => matchesInvoiceTab(row, tab, today))
  }, [allRows, tab])
  const kpi = (summary.data || {}) as LedgerInvoicesSummary
  const clients = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.customer_name).filter(Boolean))).sort(),
    [allRows],
  )
  const todayStart = useMemo(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  }, [])

  return (
    <FinancePageShell
      title="Receivable"
      subtitle="Raised invoices with basic/pretax, GST, TDS, and net payable"
      filters={filters}
      onFiltersChange={setFilters}
      onRefresh={() => {
        void list.refetch()
        void summary.refetch()
      }}
      updatedAt={list.dataUpdatedAt ? new Date(list.dataUpdatedAt) : null}
      showClientFilter
      clients={clients}
      searchPlaceholder="Search customer…"
    >
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Invoices" value={String(kpi.count || rows.length)} />
        <KpiCard label="Billed" value={fmt(kpi.billed || 0)} />
        <KpiCard label="Basic/Pretax" value={fmt(kpi.taxable || 0)} />
        <KpiCard label="GST" value={fmt(kpi.gst || 0)} tone="net" />
        <KpiCard label="TDS" value={fmt(kpi.tds || 0)} tone="out" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {INVOICE_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
              tab === key ? 'bg-brand text-white border-brand' : 'bg-surface text-muted border-line hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <p className="p-5 text-sm text-subtle">Loading…</p>
      ) : (
        <TableWrap headers={['Invoice', 'Customer', 'Date', 'Due Date', 'Basic/Pretax', 'GST', 'TDS', 'Gross', 'Net', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-canvas">
              <td className="px-5 py-3 text-xs font-mono text-ink">{row.invoice_number}</td>
              <td className="px-5 py-3 text-sm font-medium text-ink">{row.customer_name}</td>
              <td className="px-5 py-3 text-sm text-muted whitespace-nowrap">{row.invoice_date}</td>
              <td className={`px-5 py-3 text-sm whitespace-nowrap ${invoiceDueTone(row, todayStart)}`}>{row.due_date ?? '—'}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.taxable_amount)}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.gst_amount)}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.tds_amount)}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.gross_payable ?? row.amount)}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.net_payable ?? row.amount)}</td>
              <td className="px-5 py-3 text-sm"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </TableWrap>
      )}
    </FinancePageShell>
  )
}

export function CapitalPage() {
  const { type = '' } = useParams()
  const capitalType = CAPITAL_LABELS[type] ?? ''
  const title = useMemo(() => {
    return {
      'investments-received': 'Investments Received',
      'investments-made': 'Investments Made',
      'loans-provided': 'Loans Provided',
      'loans-taken': 'Loans Taken',
    }[type] ?? 'Capital'
  }, [type])
  const { data, isLoading } = useQuery({
    queryKey: ['capital', capitalType],
    queryFn: () => financeApi.listCapital(capitalType || undefined),
  })
  const rows: CapitalRow[] = data?.results ?? []
  return (
    <PageFrame title={title} subtitle="Capital movements in the finance ledger">
      {isLoading ? <p className="p-5 text-sm text-subtle">Loading…</p> : (
        <table className="table-pin-first w-full min-w-[640px]">
          <thead>
            <tr className="bg-canvas border-b border-line">
              {['Counterparty', 'Amount', 'Date', 'Status', 'Notes'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-subtle">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-canvas">
                <td className="px-5 py-3 text-sm font-medium text-ink">{row.counterparty}</td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums text-ink">{fmt(row.amount)}</td>
                <td className="px-5 py-3 text-sm text-ink">{row.entry_date}</td>
                <td className="px-5 py-3 text-xs text-muted">{row.status}</td>
                <td className="px-5 py-3 text-sm text-muted">{row.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageFrame>
  )
}
