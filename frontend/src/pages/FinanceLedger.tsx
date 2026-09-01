import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import type { CapitalRow, CashflowRow, OpsInvoice, OpsPayable, PurchaseOrder } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)

const CAPITAL_LABELS: Record<string, string> = {
  'investments-received': 'INVESTMENT_RECEIVED',
  'investments-made': 'INVESTMENT_MADE',
  'loans-provided': 'LOAN_PROVIDED',
  'loans-taken': 'LOAN_TAKEN',
}

function PageFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C3AED]">TechPay Financial Control</p>
        <h2 className="text-2xl font-semibold text-[#1a1a1a] mt-1">{title}</h2>
        <p className="text-xs text-[#6e6e73] mt-1">{subtitle}</p>
      </div>
      <div className="bg-white border border-[#e5e5ea] rounded-2xl overflow-hidden shadow-sm">{children}</div>
    </div>
  )
}

function TableWrap({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-[#f9f9fb] border-b border-[#e5e5ea]">
          {headers.map((h) => (
            <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#aeaeb2]">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

export function CashflowPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cashflow'], queryFn: financeApi.listCashflow })
  const rows: CashflowRow[] = data?.results ?? []
  return (
    <PageFrame title="Cashflow" subtitle="Inflow and outflow across revenue, operating, and capital">
      {isLoading ? <p className="p-5 text-sm text-[#aeaeb2]">Loading…</p> : (
        <TableWrap headers={['Date', 'Type', 'Category', 'Entity', 'Amount']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[#f5f5f7]">
              <td className="px-5 py-3 text-sm">{row.entry_date}</td>
              <td className="px-5 py-3 text-sm">
                <span className={row.direction === 'INFLOW' ? 'text-emerald-700' : 'text-red-600'}>{row.direction}</span>
              </td>
              <td className="px-5 py-3 text-sm">{row.category}</td>
              <td className="px-5 py-3 text-sm text-[#6e6e73]">{row.entity}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.amount)}</td>
            </tr>
          ))}
        </TableWrap>
      )}
    </PageFrame>
  )
}

export function PayablesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['payables'], queryFn: financeApi.listPayables })
  const rows: OpsPayable[] = data?.results ?? []
  return (
    <PageFrame title="Payables" subtitle="Vendor bills, GST, and pending payments">
      {isLoading ? <p className="p-5 text-sm text-[#aeaeb2]">Loading…</p> : (
        <TableWrap headers={['Vendor', 'Category', 'Invoice', 'Total', 'Payable', 'Due', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[#f5f5f7]">
              <td className="px-5 py-3 text-sm font-medium">{row.vendor}</td>
              <td className="px-5 py-3 text-sm text-[#6e6e73]">{row.category}</td>
              <td className="px-5 py-3 text-xs font-mono">{row.invoice_number}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.total_amount)}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.payable_amount)}</td>
              <td className="px-5 py-3 text-sm text-[#6e6e73]">{row.due_date ?? '—'}</td>
              <td className="px-5 py-3 text-xs">{row.status}</td>
            </tr>
          ))}
        </TableWrap>
      )}
    </PageFrame>
  )
}

export function PurchaseOrdersPage() {
  const { data, isLoading } = useQuery({ queryKey: ['purchase-orders'], queryFn: financeApi.listPurchaseOrders })
  const rows: PurchaseOrder[] = data?.results ?? []
  return (
    <PageFrame title="PO Management" subtitle="Purchase orders, billing cycle, and open value">
      {isLoading ? <p className="p-5 text-sm text-[#aeaeb2]">Loading…</p> : (
        <TableWrap headers={['PO', 'Customer', 'Service', 'PO date', 'Value', 'Invoiced', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[#f5f5f7]">
              <td className="px-5 py-3 text-xs font-mono">{row.po_number}</td>
              <td className="px-5 py-3 text-sm font-medium">{row.customer_name}</td>
              <td className="px-5 py-3 text-sm text-[#6e6e73]">{row.service_category}</td>
              <td className="px-5 py-3 text-sm">{row.po_date ?? '—'}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.total_value)}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.invoiced_value)}</td>
              <td className="px-5 py-3 text-xs">{row.status}</td>
            </tr>
          ))}
        </TableWrap>
      )}
    </PageFrame>
  )
}

export function InvoicesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['invoices'], queryFn: financeApi.listInvoices })
  const rows: OpsInvoice[] = data?.results ?? []
  return (
    <PageFrame title="Invoice Management" subtitle="Raised invoices, collections, and outstanding balance">
      {isLoading ? <p className="p-5 text-sm text-[#aeaeb2]">Loading…</p> : (
        <TableWrap headers={['Invoice', 'Customer', 'PO', 'Amount', 'Received', 'Balance', 'Due', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[#f5f5f7]">
              <td className="px-5 py-3 text-xs font-mono">{row.invoice_number}</td>
              <td className="px-5 py-3 text-sm font-medium">{row.customer_name}</td>
              <td className="px-5 py-3 text-xs font-mono text-[#6e6e73]">{row.po_number ?? '—'}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.amount)}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.amount_received)}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(Number(row.balance))}</td>
              <td className="px-5 py-3 text-sm text-[#6e6e73]">{row.due_date ?? '—'}</td>
              <td className="px-5 py-3 text-xs">{row.status}</td>
            </tr>
          ))}
        </TableWrap>
      )}
    </PageFrame>
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
    <PageFrame title={title} subtitle="Capital movements in the TechPay ledger">
      {isLoading ? <p className="p-5 text-sm text-[#aeaeb2]">Loading…</p> : (
        <TableWrap headers={['Counterparty', 'Amount', 'Date', 'Status', 'Notes']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[#f5f5f7]">
              <td className="px-5 py-3 text-sm font-medium">{row.counterparty}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.amount)}</td>
              <td className="px-5 py-3 text-sm">{row.entry_date}</td>
              <td className="px-5 py-3 text-xs">{row.status}</td>
              <td className="px-5 py-3 text-sm text-[#6e6e73]">{row.notes || '—'}</td>
            </tr>
          ))}
        </TableWrap>
      )}
    </PageFrame>
  )
}

export function FinanceClientsPage() {
  const { data: pos, isLoading: poLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: financeApi.listPurchaseOrders,
  })
  const { data: invoices, isLoading: invLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: financeApi.listInvoices,
  })
  const clients = useMemo(() => {
    const map = new Map<string, { name: string; poValue: number; invoiced: number; outstanding: number }>()
    for (const row of pos?.results ?? []) {
      const current = map.get(row.customer_name) ?? { name: row.customer_name, poValue: 0, invoiced: 0, outstanding: 0 }
      current.poValue += Number(row.total_value) || 0
      map.set(row.customer_name, current)
    }
    for (const row of invoices?.results ?? []) {
      const current = map.get(row.customer_name) ?? { name: row.customer_name, poValue: 0, invoiced: 0, outstanding: 0 }
      current.invoiced += Number(row.amount) || 0
      current.outstanding += Number(row.balance) || 0
      map.set(row.customer_name, current)
    }
    return Array.from(map.values()).sort((a, b) => b.poValue - a.poValue)
  }, [pos, invoices])

  return (
    <PageFrame title="Clients" subtitle="Billing accounts used across POs and invoices">
      {poLoading || invLoading ? (
        <p className="p-5 text-sm text-[#aeaeb2]">Loading…</p>
      ) : (
        <TableWrap headers={['Client', 'PO value', 'Invoiced', 'Outstanding']}>
          {clients.map((row) => (
            <tr key={row.name} className="border-b border-[#f5f5f7]">
              <td className="px-5 py-3 text-sm font-medium">{row.name}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.poValue)}</td>
              <td className="px-5 py-3 text-sm tabular-nums">{fmt(row.invoiced)}</td>
              <td className="px-5 py-3 text-sm font-medium tabular-nums">{fmt(row.outstanding)}</td>
            </tr>
          ))}
        </TableWrap>
      )}
    </PageFrame>
  )
}

export function FinanceSettingsPage() {
  return (
    <PageFrame title="Settings" subtitle="System settings and period books">
      <div className="p-5 text-sm text-[#6e6e73] space-y-2">
        <p>Period P&L and balance sheet entry remains on Period books.</p>
        <a href="/finance/books" className="text-violet-600">Open period books →</a>
      </div>
    </PageFrame>
  )
}
