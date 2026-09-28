import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { reportsApi } from '../api/reports'
import { getErrorMessage } from '../api/errors'
import type {
  CompanyStats,
  CustomerRevenueReport,
  DealStage,
  FinancialReportMetrics,
  FinancialSummaryReport,
  MonthlySummaryReport,
  ReportPeriodOption,
  SalesPipelineReport,
} from '../types'

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const PipelineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3v18h18" />
    <path d="M18 9l-5 5-4-4-3 3" />
  </svg>
)

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const PrinterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
)

type ReportId = 'monthly-summary' | 'sales-pipeline' | 'financial-summary' | 'customer-revenue'

interface ReportCardData {
  id: ReportId
  title: string
  description: string
  icon: ReactNode
}

const reports: ReportCardData[] = [
  {
    id: 'monthly-summary',
    title: 'Monthly Business Summary',
    description:
      'A complete overview of business activity, deals closed, revenue, and key highlights for the month.',
    icon: <CalendarIcon />,
  },
  {
    id: 'sales-pipeline',
    title: 'Sales Pipeline Report',
    description:
      'Breakdown of all active deals by stage, owner, and expected close date with weighted pipeline analysis.',
    icon: <PipelineIcon />,
  },
  {
    id: 'financial-summary',
    title: 'Financial Summary',
    description:
      'Profit & Loss, Balance Sheet highlights, cash position, receivables and payables summary.',
    icon: <ChartIcon />,
  },
  {
    id: 'customer-revenue',
    title: 'Customer Revenue Report',
    description: 'Revenue contribution by customer, top accounts, and concentration risk analysis.',
    icon: <UsersIcon />,
  },
]

const stageLabels: Record<DealStage, string> = {
  LEAD: 'Lead',
  QUALIFIED: 'Qualified',
  REQUIREMENT: 'Requirement',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
}

const incomeRows = [
  ['revenue', 'Revenue'],
  ['cost_of_goods_sold', 'Cost of Goods Sold'],
  ['gross_profit', 'Gross Profit'],
  ['operating_expenses', 'Operating Expenses'],
  ['operating_profit', 'Operating Profit'],
  ['tax', 'Tax'],
  ['net_profit', 'Net Profit'],
  ['expenses', 'Expenses'],
] as const

const balanceRows = [
  ['cash', 'Cash'],
  ['receivables', 'Receivables'],
  ['assets', 'Assets'],
  ['payables', 'Payables'],
  ['liabilities', 'Liabilities'],
  ['equity', 'Equity'],
] as const

const fmtCurrency = (n: number, compact = false) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n)

const fmtNumber = (n: number) => new Intl.NumberFormat('en-IN').format(n)

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

const fmtPct = (value: number | null | undefined) =>
  typeof value === 'number' ? `${value.toFixed(1)}%` : '—'

const fmtRatio = (value: number | null | undefined) =>
  typeof value === 'number' ? value.toFixed(2) : '—'

function readMetric(metrics: FinancialReportMetrics, code: string): number {
  const value = metrics[code as keyof FinancialReportMetrics]
  return typeof value === 'number' ? value : 0
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#f5f5f7] rounded-xl ${className ?? ''}`} />
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  )
}

function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-surface border border-[#e5e5ea] rounded-2xl p-8 text-center shadow-sm">
      <p className="text-sm text-[#6e6e73]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 text-xs text-violet-600 hover:text-violet-700"
      >
        Retry
      </button>
    </div>
  )
}

function PrintButton() {
  return (
    <button
      type="button"
      title="Print report"
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-2 px-4 py-2 bg-surface border border-[#e5e5ea] hover:border-[#d1d1d6] text-[#6e6e73] hover:text-[#1a1a1a] text-sm font-medium rounded-xl transition-colors"
    >
      <PrinterIcon />
      Print / Export
    </button>
  )
}

function PeriodSelect({
  periods,
  value,
  onChange,
}: {
  periods: ReportPeriodOption[]
  value: string
  onChange: (id: string) => void
}) {
  if (periods.length === 0) {
    return <p className="text-xs text-[#aeaeb2]">No financial periods yet</p>
  }
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="print:hidden bg-surface border border-[#e5e5ea] rounded-xl px-3 py-2 text-sm text-[#1a1a1a] focus:outline-none focus:border-violet-400"
    >
      {periods.map((period) => (
        <option key={period.id} value={period.id}>
          {period.label}
        </option>
      ))}
    </select>
  )
}

function ReportHeader({
  title,
  generatedAt,
  extra,
}: {
  title: string
  generatedAt: string
  extra?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 py-3 mb-2 bg-[#f5f5f7]/90 backdrop-blur-sm flex items-start justify-between gap-3 flex-wrap print:static print:bg-transparent">
      <div>
        <h3 className="text-sm font-semibold text-[#1a1a1a]">{title}</h3>
        <p className="text-xs text-[#aeaeb2] mt-0.5">Generated {fmtWhen(generatedAt)}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {extra}
        <PrintButton />
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-[#e5e5ea] shadow-sm rounded-2xl p-4">
      <p className="text-[11px] font-medium uppercase tracking-widest text-[#6e6e73]">{label}</p>
      <p className="text-xl font-semibold text-[#1a1a1a] mt-2 leading-none">{value}</p>
      {sub ? <p className="text-xs text-[#aeaeb2] mt-1.5">{sub}</p> : null}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-surface border border-[#e5e5ea] shadow-sm rounded-2xl p-5">
      <p className="text-[#6e6e73] text-xs font-semibold uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: string[]
  rows: (string | number)[][]
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#aeaeb2] py-4">{empty}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-[#f9f9fb] border-b border-[#e5e5ea]">
            {columns.map((column) => (
              <th
                key={column}
                className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-widest"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-b border-[#f5f5f7] last:border-0 hover:bg-[#f9f9fb] transition-colors duration-100">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${index}-${cellIndex}`}
                  className={`px-5 py-3.5 text-sm ${cellIndex === 0 ? 'text-[#3a3a3c] font-medium' : 'text-[#1a1a1a] text-right'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-[#e5e5ea] rounded-xl px-4 py-3 shadow-lg">
      <p className="text-xs text-[#6e6e73] mb-2">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
          <span className="text-xs text-[#6e6e73]">{item.name === 'revenue' ? 'Revenue' : 'Net Profit'}</span>
          <span className="text-xs font-medium text-[#1a1a1a] ml-auto pl-4">{fmtCurrency(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

function MonthlySummaryView({
  data,
  periodId,
  onPeriodChange,
}: {
  data: MonthlySummaryReport
  periodId: string
  onPeriodChange: (id: string) => void
}) {
  const financial = data.financial
  const pipeline = data.pipeline
  const business = data.business

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Monthly Business Summary"
        generatedAt={data.generated_at}
        extra={
          <PeriodSelect
            periods={data.available_periods}
            value={periodId || data.available_periods[0]?.id || ''}
            onChange={onPeriodChange}
          />
        }
      />

      <div className="flex flex-wrap gap-2">
        {data.highlights.map((highlight) => (
          <span
            key={highlight}
            className="px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700"
          >
            {highlight}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Revenue" value={fmtCurrency(financial.revenue, true)} sub={data.period ?? undefined} />
        <KpiCard label="Net Profit" value={fmtCurrency(financial.net_profit, true)} />
        <KpiCard label="Cash" value={fmtCurrency(financial.cash, true)} />
        <KpiCard label="Receivables" value={fmtCurrency(financial.receivables, true)} />
        <KpiCard label="Payables" value={fmtCurrency(financial.payables, true)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Pipeline summary">
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#6e6e73]">Total pipeline</span>
              <span className="font-medium text-[#1a1a1a]">{fmtCurrency(pipeline.total_pipeline)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6e6e73]">Weighted</span>
              <span className="font-medium text-[#1a1a1a]">{fmtCurrency(pipeline.weighted_pipeline)}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-[#f5f5f7] space-y-2">
              {pipeline.by_stage.length > 0 ? (
                pipeline.by_stage.map((row) => (
                  <div key={row.stage} className="flex justify-between text-sm">
                    <span className="text-[#6e6e73]">
                      {stageLabels[row.stage]} · {row.count}
                    </span>
                    <span className="font-medium text-[#1a1a1a]">{fmtCurrency(row.total_value || 0)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#aeaeb2]">No active deals</p>
              )}
            </div>
          </div>
        </Panel>
        <Panel title="Business">
          <BusinessRows business={business} />
        </Panel>
      </div>

      <Panel title="Revenue trend">
        {data.revenue_trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.revenue_trend} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="reportProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
              <XAxis dataKey="period" tick={{ fill: '#aeaeb2', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#aeaeb2', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => fmtCurrency(value, true)}
              />
              <Tooltip content={<TrendTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fill="url(#reportRevenue)" />
              <Area type="monotone" dataKey="net_profit" stroke="#10b981" strokeWidth={2} fill="url(#reportProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[#aeaeb2] py-8 text-center">No financial data yet</p>
        )}
      </Panel>
    </div>
  )
}

function BusinessRows({ business }: { business: CompanyStats }) {
  const rows = [
    ['Total companies', business.total],
    ['Customers', business.customers],
    ['Prospects', business.prospects],
    ['Partners', business.partners],
    ['Inactive', business.inactive],
  ] as const
  return (
    <div className="space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between text-sm">
          <span className="text-[#6e6e73]">{label}</span>
          <span className="font-medium text-[#1a1a1a]">{fmtNumber(value)}</span>
        </div>
      ))}
    </div>
  )
}

function SalesPipelineView({ data }: { data: SalesPipelineReport }) {
  const summary = data.summary
  return (
    <div className="space-y-5">
      <ReportHeader title="Sales Pipeline Report" generatedAt={data.generated_at} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total pipeline" value={fmtCurrency(summary.total_pipeline, true)} />
        <KpiCard label="Weighted" value={fmtCurrency(summary.weighted_pipeline, true)} />
        <KpiCard label="Active deals" value={fmtNumber(summary.active_deals_count)} />
      </div>
      <Panel title="By stage">
        <DataTable
          columns={['Stage', 'Count', 'Total value', 'Weighted value']}
          rows={data.by_stage.map((row) => [
            stageLabels[row.stage] ?? row.stage,
            fmtNumber(row.count),
            fmtCurrency(row.total_value || 0),
            fmtCurrency(row.weighted_value || 0),
          ])}
          empty="No active deals"
        />
      </Panel>
      <Panel title="By owner">
        <DataTable
          columns={['Owner', 'Deals', 'Total value', 'Weighted value']}
          rows={data.by_owner.map((row) => [
            row.owner_name,
            fmtNumber(row.deal_count),
            fmtCurrency(row.total_value),
            fmtCurrency(row.weighted_value),
          ])}
          empty="No owners"
        />
      </Panel>
      <Panel title="By company">
        <DataTable
          columns={['Company', 'Deals', 'Total value']}
          rows={data.by_company.map((row) => [
            row.company_name,
            fmtNumber(row.deal_count),
            fmtCurrency(row.total_value),
          ])}
          empty="No companies"
        />
      </Panel>
      <Panel title="Active deals">
        <DataTable
          columns={['Deal', 'Company', 'Stage', 'Owner', 'Value', 'Weighted']}
          rows={data.deals.map((deal) => [
            deal.name,
            deal.company_name,
            stageLabels[deal.stage] ?? deal.stage,
            deal.owner_name ?? 'Unassigned',
            fmtCurrency(Number(deal.value)),
            fmtCurrency(Number(deal.weighted_value)),
          ])}
          empty="No active deals"
        />
      </Panel>
    </div>
  )
}

function FinancialSummaryView({
  data,
  periodId,
  onPeriodChange,
}: {
  data: FinancialSummaryReport
  periodId: string
  onPeriodChange: (id: string) => void
}) {
  const metrics = data.metrics
  return (
    <div className="space-y-5">
      <ReportHeader
        title="Financial Summary"
        generatedAt={data.generated_at}
        extra={
          <PeriodSelect
            periods={data.available_periods}
            value={periodId || data.available_periods[0]?.id || ''}
            onChange={onPeriodChange}
          />
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <KpiCard label="Profit margin" value={fmtPct(data.ratios.profit_margin)} />
        <KpiCard label="Receivables / Revenue" value={fmtRatio(data.ratios.receivables_to_revenue)} />
        <KpiCard label="Debt / Equity" value={fmtRatio(data.ratios.debt_to_equity)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Income statement">
          <DataTable
            columns={['Metric', 'Value']}
            rows={incomeRows.map(([code, label]) => [label, fmtCurrency(readMetric(metrics, code))])}
            empty="No metrics"
          />
        </Panel>
        <Panel title="Balance sheet">
          <DataTable
            columns={['Metric', 'Value']}
            rows={balanceRows.map(([code, label]) => [label, fmtCurrency(readMetric(metrics, code))])}
            empty="No metrics"
          />
        </Panel>
      </div>
      <Panel title="All periods">
        <DataTable
          columns={['Period', 'Revenue', 'Net profit']}
          rows={data.all_periods.map((row) => [row.period, fmtCurrency(row.revenue), fmtCurrency(row.net_profit)])}
          empty="No periods"
        />
      </Panel>
    </div>
  )
}

function CustomerRevenueView({ data }: { data: CustomerRevenueReport }) {
  const risk = data.concentration_risk
  return (
    <div className="space-y-5">
      <ReportHeader title="Customer Revenue Report" generatedAt={data.generated_at} />
      {risk.is_concentrated ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">
          <p className="text-sm font-medium">Concentration risk</p>
          <p className="text-xs mt-0.5">
            Top customer is {fmtPct(risk.top_customer_percentage)} of deal value. Top 3 account for{' '}
            {fmtPct(risk.top_3_percentage)}.
          </p>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3">
          <p className="text-sm font-medium">All clear</p>
          <p className="text-xs mt-0.5">
            Top customer is {fmtPct(risk.top_customer_percentage)} of deal value. No concentration above 40%.
          </p>
        </div>
      )}
      <Panel title="Top customers">
        <DataTable
          columns={['Rank', 'Company', 'Deals', 'Won value', 'Active value']}
          rows={data.top_customers.map((row, index) => [
            String(index + 1),
            row.company_name,
            fmtNumber(row.deal_count),
            fmtCurrency(row.won_deal_value),
            fmtCurrency(row.active_deal_value),
          ])}
          empty="No customers"
        />
      </Panel>
      <Panel title="All companies">
        <DataTable
          columns={['Company', 'Status', 'Deals', 'Total value', 'Won value', 'Active value']}
          rows={data.companies.map((row) => [
            row.company_name,
            row.status,
            fmtNumber(row.deal_count),
            fmtCurrency(row.total_deal_value),
            fmtCurrency(row.won_deal_value),
            fmtCurrency(row.active_deal_value),
          ])}
          empty="No companies"
        />
      </Panel>
    </div>
  )
}

function ReportCard({
  report,
  selected,
  onSelect,
  generatedAt,
}: {
  report: ReportCardData
  selected: boolean
  onSelect: () => void
  generatedAt?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left bg-surface border shadow-sm rounded-2xl p-6 transition-all duration-200 cursor-pointer ${
        selected
          ? 'border-violet-300 ring-2 ring-violet-100'
          : 'border-[#e5e5ea] hover:shadow-md hover:border-[#d1d1d6]'
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white mb-4">
        {report.icon}
      </div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">{report.title}</h3>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-violet-50 border border-violet-200 shrink-0">
          <span className="text-xs text-violet-700 font-medium">{selected ? 'Viewing' : 'View'}</span>
        </span>
      </div>
      <p className="text-xs text-[#6e6e73] leading-relaxed">{report.description}</p>
      <p className="text-xs text-[#aeaeb2] mt-3">
        {generatedAt ? `Last generated ${fmtWhen(generatedAt)}` : 'Live from dashboard KPIs'}
      </p>
    </button>
  )
}

function ExpandedReport({
  reportId,
  periodId,
  onPeriodChange,
  onGenerated,
}: {
  reportId: ReportId
  periodId: string
  onPeriodChange: (id: string) => void
  onGenerated: (id: ReportId, generatedAt: string) => void
}) {
  const monthly = useQuery({
    queryKey: ['report', 'monthly-summary', periodId],
    queryFn: () => reportsApi.monthlySummary(periodId || undefined),
    enabled: reportId === 'monthly-summary',
  })
  const sales = useQuery({
    queryKey: ['report', 'sales-pipeline'],
    queryFn: reportsApi.salesPipeline,
    enabled: reportId === 'sales-pipeline',
  })
  const financial = useQuery({
    queryKey: ['report', 'financial-summary', periodId],
    queryFn: () => reportsApi.financialSummary(periodId || undefined),
    enabled: reportId === 'financial-summary',
  })
  const customers = useQuery({
    queryKey: ['report', 'customer-revenue'],
    queryFn: reportsApi.customerRevenue,
    enabled: reportId === 'customer-revenue',
  })

  const generatedAt =
    reportId === 'monthly-summary'
      ? monthly.data?.generated_at
      : reportId === 'sales-pipeline'
        ? sales.data?.generated_at
        : reportId === 'financial-summary'
          ? financial.data?.generated_at
          : customers.data?.generated_at

  useEffect(() => {
    if (generatedAt) onGenerated(reportId, generatedAt)
  }, [generatedAt, onGenerated, reportId])

  const active =
    reportId === 'monthly-summary'
      ? monthly
      : reportId === 'sales-pipeline'
        ? sales
        : reportId === 'financial-summary'
          ? financial
          : customers

  if (active.isLoading) return <ReportSkeleton />
  if (active.isError || !active.data) {
    return (
      <ReportError
        message={getErrorMessage(active.error, 'Failed to load report')}
        onRetry={() => void active.refetch()}
      />
    )
  }

  if (reportId === 'monthly-summary' && monthly.data) {
    return (
      <MonthlySummaryView
        data={monthly.data}
        periodId={periodId}
        onPeriodChange={onPeriodChange}
      />
    )
  }
  if (reportId === 'sales-pipeline' && sales.data) {
    return <SalesPipelineView data={sales.data} />
  }
  if (reportId === 'financial-summary' && financial.data) {
    return (
      <FinancialSummaryView
        data={financial.data}
        periodId={periodId}
        onPeriodChange={onPeriodChange}
      />
    )
  }
  if (reportId === 'customer-revenue' && customers.data) {
    return <CustomerRevenueView data={customers.data} />
  }
  return null
}

export default function Reports() {
  const [expanded, setExpanded] = useState<ReportId | null>(null)
  const [periodId, setPeriodId] = useState('')
  const [generatedAt, setGeneratedAt] = useState<Partial<Record<ReportId, string>>>({})

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-semibold text-[#1a1a1a]">Reports</h2>
        <p className="text-xs text-[#aeaeb2] mt-0.5">Pipeline, finance, and customer views from live data</p>
      </div>

      <div className="print:hidden flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="text-blue-700 mt-0.5">
          <InfoIcon />
        </div>
        <p className="text-xs text-blue-700 leading-relaxed">
          Reports use live KPI data from the same services that power the dashboard. All calculations
          are deterministic and traceable to source records.
        </p>
      </div>

      <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            selected={expanded === report.id}
            generatedAt={generatedAt[report.id]}
            onSelect={() => setExpanded((current) => (current === report.id ? null : report.id))}
          />
        ))}
      </div>

      {expanded ? (
        <ExpandedReport
          reportId={expanded}
          periodId={periodId}
          onPeriodChange={setPeriodId}
          onGenerated={(id, timestamp) =>
            setGeneratedAt((current) =>
              current[id] === timestamp ? current : { ...current, [id]: timestamp },
            )
          }
        />
      ) : null}
    </div>
  )
}
