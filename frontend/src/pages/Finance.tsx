import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import type { OpsInvoiceRow, OpsSummary } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)

function Kpi({
  title,
  value,
  to,
}: {
  title: string
  value: number
  to: string
}) {
  return (
    <Link
      to={to}
      className="block bg-white border border-[#e5e5ea] rounded-2xl p-5 shadow-sm hover:border-violet-200 hover:shadow-md transition-all"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6e6e73]">{title}</p>
      <p className="text-2xl font-semibold text-[#1a1a1a] mt-2 tabular-nums">{fmt(value)}</p>
    </Link>
  )
}

function InvoiceTable({ rows }: { rows: OpsInvoiceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#aeaeb2] py-4">No invoices in this bucket</p>
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-widest text-[#aeaeb2]">
          <th className="py-2 font-semibold">Customer</th>
          <th className="py-2 font-semibold">Invoice</th>
          <th className="py-2 font-semibold">Value</th>
          <th className="py-2 font-semibold">Pending since</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-[#f5f5f7] text-sm">
            <td className="py-2.5 text-[#1a1a1a]">{row.customer_name}</td>
            <td className="py-2.5 text-[#6e6e73] font-mono text-xs">{row.invoice_number}</td>
            <td className="py-2.5 font-medium tabular-nums">{fmt(row.amount)}</td>
            <td className="py-2.5 text-[#6e6e73]">{row.pending_since}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Finance() {
  const { data, isLoading, isError, refetch } = useQuery<OpsSummary>({
    queryKey: ['finance-ops-summary'],
    queryFn: financeApi.opsSummary,
  })

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-4">
        <div className="h-8 w-64 bg-[#ececef] rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#ececef] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-[#aeaeb2]">Could not load TechPay data.</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-sm text-violet-600">
          Retry
        </button>
      </div>
    )
  }

  const rec = data.receivables
  const dueShare = rec.total > 0 ? (rec.due / rec.total) * 100 : 0
  const overdueShare = rec.total > 0 ? (rec.overdue / rec.total) * 100 : 0

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C3AED]">TechPay Financial Control</p>
          <h2 className="text-2xl font-semibold text-[#1a1a1a] mt-1">Dashboard</h2>
          <p className="text-xs text-[#6e6e73] mt-1">
            Cashflow, receivables, invoices, and capital · as of {data.as_of}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-[#e5e5ea] text-[#6e6e73] hover:text-[#1a1a1a]"
          >
            Refresh Data
          </button>
          <Link
            to="/finance/books"
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-[#e5e5ea] text-[#6e6e73] hover:text-[#1a1a1a]"
          >
            Period books
          </Link>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A78BFA] mb-3">Revenue Overview</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi title="Total PO Value" value={data.po_metrics.total_po_value} to="/finance/purchase-orders" />
          <Kpi title="Total Invoiced" value={data.revenue_metrics.invoiced} to="/finance/invoices" />
          <Kpi title="Open PO" value={data.po_metrics.open_po} to="/finance/purchase-orders" />
          <Kpi title="To Be Invoiced" value={data.po_metrics.to_be_invoiced} to="/finance/invoices" />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A78BFA] mb-3">Receivables</p>
        <div className="bg-white border border-[#e5e5ea] rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-[#6e6e73]">Total Receivables</p>
              <p className="text-3xl font-semibold text-[#1a1a1a] tabular-nums">{fmt(rec.total)}</p>
            </div>
            <div className="text-right text-xs">
              <p className="text-emerald-700">Due {fmt(rec.due)}</p>
              <p className="text-red-600 mt-0.5">Overdue {fmt(rec.overdue)}</p>
            </div>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-[#f5f5f7]">
            <div className="h-full bg-emerald-500" style={{ width: `${dueShare}%` }} />
            <div className="h-full bg-red-500" style={{ width: `${overdueShare}%` }} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a]">Due (≤30 days)</p>
              <p className="text-lg font-semibold text-emerald-700 mt-1">{fmt(rec.due)}</p>
              <p className="text-xs text-[#6e6e73] mt-1">
                0–7 days {fmt(rec.due_0_7)} · 8–30 days {fmt(rec.due_8_30)}
              </p>
              <InvoiceTable rows={rec.due_invoices} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a]">Overdue (&gt;30 days)</p>
              <p className="text-lg font-semibold text-red-600 mt-1">{fmt(rec.overdue)}</p>
              <p className="text-xs text-[#6e6e73] mt-1">Aging beyond one month</p>
              <InvoiceTable rows={rec.overdue_invoices} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A78BFA] mb-3">Cash Health</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-[#e5e5ea] rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest text-[#6e6e73]">Inflow</p>
            <p className="text-xl font-semibold text-emerald-700 mt-1">{fmt(data.cashflow_metrics.total_inflow)}</p>
          </div>
          <div className="bg-white border border-[#e5e5ea] rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest text-[#6e6e73]">Outflow</p>
            <p className="text-xl font-semibold text-red-600 mt-1">{fmt(data.cashflow_metrics.total_outflow)}</p>
          </div>
          <div className="bg-white border border-[#e5e5ea] rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest text-[#6e6e73]">Net movement</p>
            <p className="text-xl font-semibold text-[#1a1a1a] mt-1">{fmt(data.cashflow_metrics.net_cash_movement)}</p>
          </div>
          <div className="bg-white border border-[#e5e5ea] rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest text-[#6e6e73]">Payables pending</p>
            <p className="text-xl font-semibold text-amber-600 mt-1">{fmt(data.payables_pending)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
