import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  MoreHorizontal,
  TrendingUp,
} from 'lucide-react'
import { financeApi } from '../api/finance'
import type {
  CapitalRow,
  CashflowRow,
  LedgerCashflowSummary,
  LedgerClientsSummary,
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
import Modal, { btnSecondaryClass, labelClass } from '../components/Modal'

const fmt = formatInr

function TableWrap({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full">
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
  )
}

function PageFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Financial Control</p>
        <h2 className="text-2xl font-semibold text-ink mt-1">{title}</h2>
        <p className="text-xs text-muted mt-1">{subtitle}</p>
      </div>
      <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl overflow-hidden shadow-sm">{children}</div>
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

function CashflowPromo() {
  return (
    <div className="hidden lg:flex items-center gap-3 rounded-2xl border border-violet-200/80 dark:border-violet-800 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 dark:from-violet-950/40 dark:via-surface dark:to-surface px-4 py-3 shadow-sm max-w-xs">
      <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
        <BarChart3 className="w-5 h-5" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink leading-tight">Track. Analyze. Grow.</p>
        <p className="text-xs text-muted mt-0.5 leading-snug">Live cash movement across inflows and outflows.</p>
      </div>
    </div>
  )
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

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="text-sm text-ink">{children}</div>
    </div>
  )
}

export function CashflowPage() {
  const { filters, setFilters } = useFinanceFilters()
  const prior = useMemo(() => priorPeriodRange(filters.from, filters.to), [filters.from, filters.to])
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [detailRow, setDetailRow] = useState<CashflowRow | null>(null)
  const actionsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openActionId) return
    const onPointer = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setOpenActionId(null)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenActionId(null)
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [openActionId])

  const list = useQuery({
    queryKey: ['cashflow', filters.from, filters.to, filters.search],
    queryFn: () =>
      financeApi.listCashflow({
        from: filters.from,
        to: filters.to,
        search: filters.search,
      }),
  })
  const summary = useQuery({
    queryKey: ['ledger-summary', 'cashflow', filters.from, filters.to],
    queryFn: () => financeApi.ledgerSummary('cashflow', { from: filters.from, to: filters.to }),
  })
  const priorSummary = useQuery({
    queryKey: ['ledger-summary', 'cashflow', 'prior', prior?.from, prior?.to],
    queryFn: () => financeApi.ledgerSummary('cashflow', { from: prior!.from, to: prior!.to }),
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

  const closeDetail = () => {
    setDetailRow(null)
    setOpenActionId(null)
  }

  return (
    <>
    <FinancePageShell
      title="Cashflow"
      subtitle="Inflow and outflow across revenue, operating, and capital"
      filters={filters}
      onFiltersChange={setFilters}
      onRefresh={() => {
        void list.refetch()
        void summary.refetch()
        void priorSummary.refetch()
        void invoicesSummary.refetch()
        void payablesSummary.refetch()
      }}
      updatedAt={list.dataUpdatedAt ? new Date(list.dataUpdatedAt) : null}
      searchPlaceholder="Search particulars, category, type, or notes…"
      promo={<CashflowPromo />}
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

      {(kpi.cards?.length || kpi.by_category?.length) ? (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {(kpi.cards?.length ? kpi.cards : kpi.by_category).map((row) => {
            const direction = row.direction || 'Net'
            const isIn = direction === 'Inflow'
            const isOut = direction === 'Outflow'
            return (
              <div
                key={`${row.category}-${direction}`}
                className={`rounded-2xl border border-line px-4 py-3.5 shadow-sm ${
                  isIn
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                    : isOut
                      ? 'bg-rose-50/70 dark:bg-rose-950/30'
                      : 'bg-surface/80 backdrop-blur-md'
                }`}
              >
                <p className="text-xs font-medium text-muted truncate" title={row.category}>
                  {row.category}
                </p>
                <p
                  className={`text-lg font-semibold tabular-nums mt-2 ${
                    isIn ? 'text-emerald-700 dark:text-emerald-400' : isOut ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {fmt(row.amount)}
                </p>
                <span
                  className={`inline-flex mt-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    isIn
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : isOut
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-canvas text-muted'
                  }`}
                >
                  {direction}
                </span>
              </div>
            )
          })}
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
              valueClass="text-violet-700"
            />
            <SideMetric
              label="Total Received"
              value={fmt(ar.received || 0)}
              icon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-emerald-700"
            />
            <SideMetric
              label="Outstanding"
              value={fmt(ar.outstanding || 0)}
              icon={<Clock3 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-rose-700"
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
              valueClass="text-violet-700"
            />
            <SideMetric
              label="Total Paid"
              value={fmt(ap.total_paid || 0)}
              icon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-emerald-700"
            />
            <SideMetric
              label="Outstanding"
              value={fmt(ap.outstanding || 0)}
              icon={<Clock3 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
              valueClass="text-rose-700"
            />
          </div>
        </div>
      </div>

      <div className="mt-5" id="cashflow-recent-transactions">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-ink">Recent Transactions</h3>
          <a
            href="#cashflow-recent-transactions"
            className="text-xs font-medium text-brand hover:text-brand-hover"
          >
            View All →
          </a>
        </div>
        {list.isLoading ? (
          <p className="p-5 text-sm text-subtle bg-surface/80 backdrop-blur-md border border-line rounded-2xl">Loading…</p>
        ) : (
          <TableWrap headers={['Date', 'Type', 'Particulars', 'Category', 'Sub', 'Amount', 'Actions']}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-canvas last:border-0">
                <td className="px-5 py-3 text-sm text-ink whitespace-nowrap">{row.entry_date}</td>
                <td className="px-5 py-3 text-sm">
                  <StatusBadge status={row.direction} />
                </td>
                <td className="px-5 py-3 text-sm text-ink">{row.entity || '—'}</td>
                <td className="px-5 py-3 text-sm text-ink">{row.category}</td>
                <td className="px-5 py-3 text-sm text-muted">{row.sub_category || '—'}</td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums text-ink">{fmt(row.amount)}</td>
                <td className="px-5 py-3">
                  <div
                    className="relative inline-flex"
                    ref={openActionId === row.id ? actionsRef : undefined}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:bg-canvas hover:text-ink"
                      aria-label="More actions"
                      aria-expanded={openActionId === row.id}
                      onClick={() =>
                        setOpenActionId((current) => (current === row.id ? null : row.id))
                      }
                    >
                      <MoreHorizontal className="w-4 h-4" strokeWidth={2} aria-hidden />
                    </button>
                    {openActionId === row.id ? (
                      <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-xl border border-line bg-surface/80 backdrop-blur-md py-1 shadow-lg">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
                          onClick={() => {
                            setDetailRow(row)
                            setOpenActionId(null)
                          }}
                        >
                          View details
                        </button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </TableWrap>
        )}
      </div>
    </FinancePageShell>

    <Modal
      open={Boolean(detailRow)}
      title={detailRow ? `${detailRow.direction} · ${detailRow.category}` : 'Transaction'}
      onClose={closeDetail}
      footer={
        <button type="button" className={btnSecondaryClass} onClick={closeDetail}>
          Close
        </button>
      }
    >
      {detailRow ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailField label="Date">{detailRow.entry_date}</DetailField>
          <DetailField label="Type">
            <StatusBadge status={detailRow.direction} />
          </DetailField>
          <DetailField label="Category">{detailRow.category || '—'}</DetailField>
          <DetailField label="Sub">{detailRow.sub_category || '—'}</DetailField>
          <DetailField label="Amount">
            <span className="font-medium tabular-nums">{fmt(detailRow.amount)}</span>
          </DetailField>
          <DetailField label="Particulars">{detailRow.entity || '—'}</DetailField>
          <DetailField label="Voucher no">{detailRow.voucher_no || '—'}</DetailField>
          <DetailField label="Notes">
            <p className="whitespace-pre-wrap break-words">{detailRow.notes || '—'}</p>
          </DetailField>
        </div>
      ) : null}
    </Modal>
    </>
  )
}

export function PayablesPage() {
  const { filters, setFilters } = useFinanceFilters()
  const [tab, setTab] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL')
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
          <TableWrap headers={['Vendor', 'Category', 'Invoice', 'Basic/Pretax', 'GST', 'TDS', 'Total', 'Payable', 'Due', 'Status']}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-canvas">
                <td className="px-5 py-3 text-sm font-medium text-ink">{row.vendor}</td>
                <td className="px-5 py-3 text-sm text-muted">{row.category}</td>
                <td className="px-5 py-3 text-xs font-mono text-ink">{row.invoice_number}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.taxable_amount)}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.gst_amount)}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.tds_amount)}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.total_amount)}</td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.payable_amount)}</td>
                <td className="px-5 py-3 text-sm text-muted">{row.due_date ?? '—'}</td>
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
  const rows: OpsInvoice[] = list.data?.results ?? []
  const kpi = (summary.data || {}) as LedgerInvoicesSummary
  const clients = useMemo(
    () => Array.from(new Set(rows.map((r) => r.customer_name).filter(Boolean))).sort(),
    [rows],
  )

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
      {list.isLoading ? (
        <p className="p-5 text-sm text-subtle">Loading…</p>
      ) : (
        <TableWrap headers={['Invoice', 'Customer', 'Date', 'Basic/Pretax', 'GST', 'TDS', 'Gross', 'Net', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-canvas">
              <td className="px-5 py-3 text-xs font-mono text-ink">{row.invoice_number}</td>
              <td className="px-5 py-3 text-sm font-medium text-ink">{row.customer_name}</td>
              <td className="px-5 py-3 text-sm text-muted">{row.invoice_date}</td>
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

export function FinanceClientsPage() {
  const { filters, setFilters } = useFinanceFilters()
  const summary = useQuery({
    queryKey: ['ledger-summary', 'clients'],
    queryFn: () => financeApi.ledgerSummary('clients'),
  })
  const kpi = (summary.data || {}) as LedgerClientsSummary
  const clients = useMemo(() => {
    const rows = kpi.clients || []
    const q = filters.search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => row.name.toLowerCase().includes(q) || row.gst_number.toLowerCase().includes(q))
  }, [kpi.clients, filters.search])

  return (
    <FinancePageShell
      title="Clients"
      subtitle="Billing accounts across invoices and purchase orders"
      filters={filters}
      onFiltersChange={setFilters}
      onRefresh={() => {
        void summary.refetch()
      }}
      updatedAt={summary.dataUpdatedAt ? new Date(summary.dataUpdatedAt) : null}
      searchPlaceholder="Search client or GSTN…"
      showSearch
    >
      <p className="text-sm text-muted mb-4">
        <span className="font-semibold text-ink">{kpi.active_clients || clients.length}</span> active clients with ledger activity
      </p>
      {summary.isLoading ? (
        <p className="p-5 text-sm text-subtle">Loading…</p>
      ) : (
        <TableWrap headers={['Client', 'Service line', 'GSTN', 'Active POs', 'Total invoiced', 'Total paid']}>
          {clients.map((row) => (
            <tr key={row.id} className="border-b border-canvas">
              <td className="px-5 py-3 text-sm font-medium text-ink">{row.name}</td>
              <td className="px-5 py-3 text-sm text-muted">{row.service_line || '—'}</td>
              <td className="px-5 py-3 text-xs font-mono text-muted">{row.gst_number || '—'}</td>
              <td className="px-5 py-3 text-sm tabular-nums text-ink">{row.active_pos}</td>
              <td className="px-5 py-3 text-sm tabular-nums text-ink">{fmt(row.total_invoiced)}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums text-ink">{fmt(row.total_paid)}</td>
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
        <table className="w-full">
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
