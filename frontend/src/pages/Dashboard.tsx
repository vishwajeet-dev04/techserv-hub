import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api/dashboard'
import type { DashboardData, FinancialSummary, PipelineSummary } from '../types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

const fmtNumber = (n: number) =>
  new Intl.NumberFormat('en-IN').format(n)

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`relative rounded-2xl p-5 border overflow-hidden ${
      accent
        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 border-violet-600 shadow-sm'
        : 'bg-white border-[#e5e5ea] shadow-sm'
    }`}>
      <p className={`text-[11px] font-medium uppercase tracking-widest ${accent ? 'text-violet-100' : 'text-[#6e6e73]'}`}>{label}</p>
      <p className={`text-2xl font-semibold mt-2 leading-none ${accent ? 'text-white' : 'text-[#1a1a1a]'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1.5 ${accent ? 'text-violet-100' : 'text-[#aeaeb2]'}`}>{sub}</p>}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-[#1a1a1a]">{title}</h3>
      {sub && <p className="text-xs text-[#6e6e73] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#f5f5f7] last:border-0">
      <span className="text-sm text-[#6e6e73]">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-violet-600' : 'text-[#1a1a1a]'}`}>
        {value}
      </span>
    </div>
  )
}

// ─── Stage Badge ──────────────────────────────────────────────────────────────
const stageColors: Record<string, string> = {
  LEAD: 'bg-slate-100 text-slate-600',
  QUALIFIED: 'bg-blue-50 text-blue-700',
  REQUIREMENT: 'bg-cyan-50 text-cyan-700',
  PROPOSAL: 'bg-amber-50 text-amber-700',
  NEGOTIATION: 'bg-orange-50 text-orange-700',
  WON: 'bg-emerald-50 text-emerald-700',
  LOST: 'bg-red-50 text-red-700',
}

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${stageColors[stage] || 'bg-[#f5f5f7] text-[#aeaeb2]'}`}>
      {stage}
    </span>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#e5e5ea] rounded-xl px-4 py-3 shadow-lg">
      <p className="text-xs text-[#6e6e73] mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs text-[#6e6e73]">{p.name === 'revenue' ? 'Revenue' : 'Net Profit'}</span>
          <span className="text-xs font-medium text-[#1a1a1a] ml-auto pl-4">{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#f5f5f7] rounded-xl ${className}`} />
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  )
}

const EMPTY_FINANCIAL: FinancialSummary = {
  revenue: 0,
  expenses: 0,
  gross_profit: 0,
  operating_profit: 0,
  net_profit: 0,
  cash: 0,
  receivables: 0,
  payables: 0,
  assets: 0,
  liabilities: 0,
  equity: 0,
  profit_margin: null,
}

const EMPTY_PIPELINE: PipelineSummary = {
  total_pipeline: 0,
  weighted_pipeline: 0,
  active_deals_count: 0,
  closing_soon_count: 0,
  won_this_month_count: 0,
  won_this_month_value: 0,
  by_stage: [],
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getSummary,
  })

  if (isLoading) return <DashboardSkeleton />

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-[#aeaeb2] text-sm">Failed to load dashboard</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs text-violet-600 hover:text-violet-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const financial: FinancialSummary = { ...EMPTY_FINANCIAL, ...data.financial }
  const pipeline: PipelineSummary = {
    ...EMPTY_PIPELINE,
    ...data.pipeline,
    by_stage: data.pipeline?.by_stage ?? [],
  }
  const business = data.business
  const revenue_trend = data.revenue_trend ?? []
  const period = data.period

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Dashboard</h2>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            {period ? `Financial period: ${period}` : 'No financial period set'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs">Live data</span>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Revenue"
          value={fmtCurrency(financial.revenue)}
          sub={period ?? undefined}
          accent
        />
        <KpiCard
          label="Net Profit"
          value={fmtCurrency(financial.net_profit)}
          sub={typeof financial.profit_margin === 'number' ? `${financial.profit_margin.toFixed(1)}% margin` : undefined}
        />
        <KpiCard
          label="Pipeline"
          value={fmtCurrency(pipeline.total_pipeline)}
          sub={`${pipeline.active_deals_count} active deals`}
        />
        <KpiCard
          label="Weighted Pipeline"
          value={fmtCurrency(pipeline.weighted_pipeline)}
          sub="Risk adjusted"
          accent
        />
        <KpiCard
          label="Cash"
          value={fmtCurrency(financial.cash)}
        />
        <KpiCard
          label="Receivables"
          value={fmtCurrency(financial.receivables)}
        />
        <KpiCard
          label="Payables"
          value={fmtCurrency(financial.payables)}
        />
        <KpiCard
          label="Closing Soon"
          value={String(pipeline.closing_soon_count)}
          sub="Within 30 days"
        />
      </div>

      {/* ── Revenue Chart + Business Stats ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-5">
          <SectionHeader
            title="Revenue Trend"
            sub="Last 6 periods"
          />
          {revenue_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenue_trend} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
                <XAxis
                  dataKey="period"
                  tick={{ fill: '#aeaeb2', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#aeaeb2', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtCurrency(v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                />
                <Area
                  type="monotone"
                  dataKey="net_profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorProfit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-sm text-[#aeaeb2]">No financial data yet</p>
            </div>
          )}
          {/* Legend */}
          <div className="flex items-center gap-5 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span className="text-xs text-[#6e6e73]">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-[#6e6e73]">Net Profit</span>
            </div>
          </div>
        </div>

        {/* Business Stats */}
        <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-5">
          <SectionHeader title="Business" sub="Company overview" />
          <StatRow label="Total Companies" value={fmtNumber(business.total)} />
          <StatRow label="Customers" value={fmtNumber(business.customers)} highlight />
          <StatRow label="Prospects" value={fmtNumber(business.prospects)} />
          <StatRow label="Partners" value={fmtNumber(business.partners)} />
          <StatRow label="Inactive" value={fmtNumber(business.inactive)} />

          <div className="mt-5 pt-4 border-t border-[#f5f5f7]">
            <SectionHeader title="Finance" />
            <StatRow label="Gross Profit" value={fmtCurrency(financial.gross_profit)} />
            <StatRow label="Expenses" value={fmtCurrency(financial.expenses)} />
            <StatRow label="Equity" value={fmtCurrency(financial.equity)} />
          </div>
        </div>

      </div>

      {/* ── Pipeline by Stage ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stage Breakdown */}
        <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-5">
          <SectionHeader title="Pipeline by Stage" sub="Active deals breakdown" />
          {pipeline.by_stage.length > 0 ? (
            <div className="space-y-2.5">
              {pipeline.by_stage.map((s) => (
                <div key={s.stage} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <StageBadge stage={s.stage} />
                    <span className="text-xs text-[#6e6e73]">{s.count} deals</span>
                  </div>
                  <span className="text-sm font-medium text-[#1a1a1a]">
                    {fmtCurrency(s.total_value || 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#aeaeb2] py-4">No active deals</p>
          )}
        </div>

        {/* Won This Month + Financial Position */}
        <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-5">
          <SectionHeader title="This Month" sub="Performance snapshot" />
          <StatRow
            label="Won This Month"
            value={fmtNumber(pipeline.won_this_month_count)}
            highlight
          />
          <StatRow
            label="Won Value"
            value={fmtCurrency(pipeline.won_this_month_value)}
            highlight
          />
          <StatRow
            label="Closing Soon"
            value={`${pipeline.closing_soon_count} deals`}
          />

          <div className="mt-5 pt-4 border-t border-[#f5f5f7]">
            <SectionHeader title="Balance Sheet" />
            <StatRow label="Assets" value={fmtCurrency(financial.assets)} />
            <StatRow label="Liabilities" value={fmtCurrency(financial.liabilities)} />
            <StatRow label="Cash Position" value={fmtCurrency(financial.cash)} highlight />
          </div>
        </div>

      </div>

    </div>
  )
}