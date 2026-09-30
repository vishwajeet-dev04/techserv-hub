import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Calendar, Layers3, PieChart, Search } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { pulseApi } from '../api/pulse'
import { getErrorMessage } from '../api/errors'
import { useAuth } from '../hooks/useAuth'
import Modal, { fieldClass, btnSecondaryClass } from '../components/Modal'
import { useDateRange } from '../hooks/useDateRange'
import {
  defaultPeriodForMode,
  periodsForMode,
  priorPeriodFor,
  resolvePeriodOption,
  type PeriodOption,
} from '../lib/dateRange'
import { fmtInrShort as fmtCurrency } from '../lib/format'
import { chartCursor, chartTick, legendStyle, tooltipProps } from '../lib/chartTheme'
import PipelineFlow from '../components/pulse/PipelineFlow'
import type { PulseOpportunity, PulsePipelineDashboard } from '../types'

type CompareMode = 'week' | 'month' | 'quarter'

const COMPARE_OPTIONS: {
  id: CompareMode
  label: string
  hint: string
  Icon: typeof Calendar
}[] = [
  { id: 'week', label: 'Week', hint: 'Sun–Sat week', Icon: Calendar },
  { id: 'month', label: 'Month', hint: 'Calendar month', Icon: Calendar },
  { id: 'quarter', label: 'Quarter', hint: 'FY quarter (Apr–Mar)', Icon: PieChart },
]

function deltaLabel(current: number, prior: number): string {
  if (prior === 0 && current === 0) return 'No change'
  if (prior === 0) return 'New vs prior'
  const pct = Math.round(((current - prior) / Math.abs(prior)) * 100)
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}% vs prior`
}

function defaultComparePair(mode: CompareMode): { current: PeriodOption; prior: PeriodOption } {
  const current = defaultPeriodForMode(mode)
  const priorRange = priorPeriodFor(mode, current)
  const { option: prior } = resolvePeriodOption(mode, priorRange, periodsForMode(mode))
  return { current, prior }
}

const STAGE_STYLE: Record<string, string> = {
  Win: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  Lost: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  Cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  Negotiation: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  Commercial: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  Demo: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  Approach: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  Qualify: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  Prospect: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
}

const AVATAR_COLORS = [
  'from-violet-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-blue-500 to-cyan-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
] as const

const selectField = `${fieldClass} !w-full md:!w-44`

const chartWellClass =
  'rounded-2xl bg-surface/70 border border-line/60 p-3 flex-1 min-h-0 shadow-inner shadow-brand/5'

function truncateLabel(value: string, max = 20) {
  const text = String(value ?? '')
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

function stageBarColor(stage: string) {
  if (stage === 'Win') return 'var(--color-success)'
  if (stage === 'Lost') return 'var(--color-danger)'
  if (stage === 'Cancelled') return 'var(--color-subtle)'
  if (stage === 'Negotiation' || stage === 'Commercial') return 'var(--color-warning)'
  return 'var(--color-brand)'
}

function IconBars() {
  return <BarChart3 className="w-4 h-4" strokeWidth={2} aria-hidden />
}

function IconLayers() {
  return <Layers3 className="w-4 h-4" strokeWidth={2} aria-hidden />
}

function IconCompare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3v18" />
      <path d="M5 8h5" />
      <path d="M5 12h5" />
      <path d="M14 12h5" />
      <path d="M14 16h5" />
    </svg>
  )
}

function IconSearch() {
  return <Search className="w-4 h-4 text-subtle" strokeWidth={2} aria-hidden />
}

function CompareSliceCard({
  title,
  rangeLabel,
  data,
}: {
  title: string
  rangeLabel: string
  data: PulsePipelineDashboard | undefined
}) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface/80 backdrop-blur-md p-4 min-h-[12rem] flex items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }
  const openCount = data.open_pipeline?.count ?? data.open_opportunities ?? 0
  const openValue = data.open_pipeline?.value ?? data.pipeline_value ?? 0
  const stages = data.flow.filter((step) => step.key !== 'prospects')

  return (
    <div className="rounded-2xl border border-brand/20 bg-surface p-4 shadow-sm min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-[11px] text-muted tabular-nums text-right">{rangeLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-brand-soft/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted">Open opps</p>
          <p className="text-xl font-bold tabular-nums text-ink leading-tight mt-0.5">{openCount}</p>
        </div>
        <div className="rounded-xl bg-brand-soft/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted">Open value</p>
          <p className="text-xl font-bold tabular-nums text-brand leading-tight mt-0.5">{fmtCurrency(openValue)}</p>
        </div>
      </div>
      <p className="text-[11px] text-muted mb-2">
        Total opportunities: <span className="font-semibold text-ink tabular-nums">{data.total_prospects}</span>
      </p>
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {stages.map((step) => (
          <li
            key={step.key}
            className="flex items-center justify-between gap-2 text-[12px] py-1 border-b border-canvas last:border-0"
          >
            <span className="text-ink truncate">{step.label}</span>
            <span className="tabular-nums text-muted shrink-0">
              {step.count}
              {step.value && step.value > 0 ? ` · ${fmtCurrency(step.value)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OpsPipeline() {
  const { hasAccess } = useAuth()
  const { from: dateFrom, to: dateTo } = useDateRange()
  const [search, setSearch] = useState('')
  const [pillar, setPillar] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [owner, setOwner] = useState('')
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareMode, setCompareMode] = useState<CompareMode>('month')
  const [currentPeriod, setCurrentPeriod] = useState<PeriodOption>(() => defaultComparePair('month').current)
  const [priorPeriod, setPriorPeriod] = useState<PeriodOption>(() => defaultComparePair('month').prior)
  const leadsRef = useRef<HTMLDivElement>(null)

  const selectStage = (key: string) => {
    setStageFilter(key === 'prospects' ? '' : key)
    window.requestAnimationFrame(() => {
      leadsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const periodOptionsBase = useMemo(() => periodsForMode(compareMode), [compareMode])

  const currentOptions = useMemo(() => {
    const { options } = resolvePeriodOption(compareMode, currentPeriod, periodOptionsBase)
    return options
  }, [compareMode, currentPeriod, periodOptionsBase])

  const priorOptions = useMemo(() => {
    const { options } = resolvePeriodOption(compareMode, priorPeriod, periodOptionsBase)
    return options
  }, [compareMode, priorPeriod, periodOptionsBase])

  const applyCompareMode = (mode: CompareMode) => {
    const pair = defaultComparePair(mode)
    setCompareMode(mode)
    setCurrentPeriod(pair.current)
    setPriorPeriod(pair.prior)
  }

  const openCompare = () => {
    applyCompareMode(compareMode)
    setCompareOpen(true)
  }

  const allowed = hasAccess('pulse')
  const pipeline = useQuery({
    queryKey: ['pulse-pipeline', dateFrom, dateTo],
    queryFn: () => pulseApi.pipeline({ from: dateFrom, to: dateTo }),
    enabled: allowed,
  })
  const compareCurrent = useQuery({
    queryKey: [
      'pulse-pipeline-compare',
      compareMode,
      'current',
      currentPeriod.from,
      currentPeriod.to,
    ],
    queryFn: () =>
      pulseApi.pipeline({
        from: currentPeriod.from,
        to: currentPeriod.to,
      }),
    enabled: allowed && compareOpen,
  })
  const comparePrior = useQuery({
    queryKey: [
      'pulse-pipeline-compare',
      compareMode,
      'prior',
      priorPeriod.from,
      priorPeriod.to,
    ],
    queryFn: () =>
      pulseApi.pipeline({
        from: priorPeriod.from,
        to: priorPeriod.to,
      }),
    enabled: allowed && compareOpen,
  })
  const settings = useQuery({
    queryKey: ['pulse-settings'],
    queryFn: pulseApi.settings,
    enabled: allowed,
  })
  const list = useQuery({
    queryKey: ['pulse-opportunities', search, stageFilter],
    queryFn: () => pulseApi.listOpportunities({ search: search || undefined, stage: stageFilter || undefined }),
    enabled: allowed,
  })

  const rows = list.data?.results ?? []
  const owners = useMemo(() => {
    const names = new Set(rows.map((row) => row.owner_display || row.owner_name).filter(Boolean))
    return [...names].sort()
  }, [rows])
  const table = rows.filter((row) => {
    if (pillar && row.service_pillar !== pillar) return false
    if (owner && (row.owner_display || row.owner_name) !== owner) return false
    return true
  })
  const pillars = settings.data?.service_pillars ?? []
  const stages = settings.data?.sales_stages ?? []
  const data = pipeline.data
  const stageChart = (data?.by_stage ?? []).filter((row) => row.count > 0)

  if (!allowed) {
    return (
      <p className="p-4 sm:p-6 text-sm text-muted">Pulse CRM is not available for this role.</p>
    )
  }

  if (pipeline.isLoading) {
    return <p className="p-4 sm:p-6 text-sm text-muted">Loading pipeline…</p>
  }

  if (pipeline.isError || !data) {
    return <p className="p-4 sm:p-6 text-sm text-danger">{getErrorMessage(pipeline.error, 'Could not load Pulse pipeline.')}</p>
  }

  const currentOpen = compareCurrent.data?.open_pipeline?.value ?? compareCurrent.data?.pipeline_value ?? 0
  const priorOpen = comparePrior.data?.open_pipeline?.value ?? comparePrior.data?.pipeline_value ?? 0
  const currentOpenCount = compareCurrent.data?.open_pipeline?.count ?? compareCurrent.data?.open_opportunities ?? 0
  const priorOpenCount = comparePrior.data?.open_pipeline?.count ?? comparePrior.data?.open_opportunities ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Deal-to-Billing Ops</p>
          <h2 className="text-2xl font-semibold text-ink mt-1">Pipeline</h2>
          <p className="text-sm text-muted mt-1">Live Pulse CRM leads and opportunities, filtered by created date.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCompare}
            className={`${btnSecondaryClass} !px-3 !py-2 text-xs`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-brand" strokeWidth={2} aria-hidden />
            Compare
          </button>
          <span className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live Pulse CRM
          </span>
        </div>
      </div>

      <Modal
        open={compareOpen}
        title="Compare"
        wide
        onClose={() => setCompareOpen(false)}
      >
        <p className="text-[12px] text-muted -mt-1">Analyze pipeline data by time period.</p>

        <div className="space-y-2">
          {COMPARE_OPTIONS.map((opt) => {
            const active = compareMode === opt.id
            const Icon = opt.Icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => applyCompareMode(opt.id)}
                className={`w-full flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  active
                    ? 'bg-brand-soft/80 border-brand/40'
                    : 'bg-surface border-line hover:bg-canvas'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    active ? 'bg-surface text-brand' : 'bg-canvas text-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${active ? 'text-ink' : 'text-ink'}`}>
                    {opt.label}
                  </span>
                  <span className="block text-[12px] text-muted mt-0.5">{opt.hint}</span>
                </span>
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    active ? 'border-brand' : 'border-line'
                  }`}
                  aria-hidden
                >
                  {active ? <span className="w-2.5 h-2.5 rounded-full bg-brand" /> : null}
                </span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Current</span>
            <select
              value={currentPeriod.id}
              onChange={(e) => {
                const next = currentOptions.find((p) => p.id === e.target.value)
                if (next) setCurrentPeriod(next)
              }}
              className={`${fieldClass} !w-full !text-sm`}
            >
              {currentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Prior</span>
            <select
              value={priorPeriod.id}
              onChange={(e) => {
                const next = priorOptions.find((p) => p.id === e.target.value)
                if (next) setPriorPeriod(next)
              }}
              className={`${fieldClass} !w-full !text-sm`}
            >
              {priorOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(compareCurrent.isError || comparePrior.isError) ? (
          <p className="text-sm text-danger">
            {getErrorMessage(compareCurrent.error ?? comparePrior.error, 'Could not load comparison.')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CompareSliceCard
                title="Current"
                rangeLabel={currentPeriod.label}
                data={compareCurrent.isLoading ? undefined : compareCurrent.data}
              />
              <CompareSliceCard
                title="Prior"
                rangeLabel={priorPeriod.label}
                data={comparePrior.isLoading ? undefined : comparePrior.data}
              />
            </div>
            {compareCurrent.data && comparePrior.data ? (
              <div className="flex flex-wrap gap-3 text-[12px]">
                <span className="inline-flex items-center rounded-full bg-canvas border border-line px-3 py-1 text-muted">
                  Open count:{' '}
                  <span className="ml-1 font-semibold text-ink tabular-nums">
                    {deltaLabel(currentOpenCount, priorOpenCount)}
                  </span>
                </span>
                <span className="inline-flex items-center rounded-full bg-canvas border border-line px-3 py-1 text-muted">
                  Open value:{' '}
                  <span className="ml-1 font-semibold text-ink tabular-nums">
                    {deltaLabel(currentOpen, priorOpen)}
                  </span>
                </span>
              </div>
            ) : null}
          </>
        )}
      </Modal>

      <PipelineFlow data={data} selectedStage={stageFilter} onSelectStage={selectStage} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <ChartCard title="Leads By Source" icon={<IconBars />}>
          {data.by_source.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className={chartWellClass}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.by_source} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                  <XAxis type="number" tick={chartTick} allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={chartTick} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipProps} cursor={chartCursor} />
                  <Bar dataKey="count" fill="var(--color-brand)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
        <ChartCard title="Deal Stages" icon={<IconLayers />}>
          {stageChart.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className={chartWellClass}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stageChart} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                  <XAxis type="number" tick={chartTick} allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="stage" width={120} tick={chartTick} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipProps} cursor={chartCursor} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {stageChart.map((row) => (
                      <Cell key={row.stage} fill={stageBarColor(row.stage)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
        <ChartCard title="Expected vs Negotiated" icon={<IconCompare />}>
          {data.expected_vs_negotiated.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className={chartWellClass}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data.expected_vs_negotiated}
                  layout="vertical"
                  margin={{ left: 4, right: 28, top: 8, bottom: 4 }}
                  barCategoryGap="18%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={chartTick}
                    tickFormatter={(v) => fmtCurrency(Number(v))}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 'auto']}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={chartTick}
                    tickFormatter={(v) => truncateLabel(String(v), 20)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    {...tooltipProps}
                    formatter={(value) => fmtCurrency(Number(value))}
                    cursor={chartCursor}
                  />
                  <Legend
                    wrapperStyle={{ ...legendStyle, paddingTop: 8 }}
                    iconType="square"
                    iconSize={10}
                  />
                  <Bar dataKey="expected" name="Expected" fill="var(--color-brand)" radius={[0, 6, 6, 0]} maxBarSize={18} />
                  <Bar dataKey="negotiated" name="Negotiated" fill="var(--color-chart-3)" radius={[0, 6, 6, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div
        ref={leadsRef}
        id="pipeline-leads"
        className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm overflow-hidden scroll-mt-4"
      >
        <div className="px-4 pt-4 pb-3 border-b border-line flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Leads</h3>
            <p className="text-xs text-muted">{list.isLoading ? 'Loading…' : `${table.length} shown`}</p>
          </div>
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
            <div className="relative w-full md:flex-1 md:max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <IconSearch />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads..."
                className={`${fieldClass} !pl-9`}
              />
            </div>
            <select value={pillar} onChange={(e) => setPillar(e.target.value)} className={selectField}>
              <option value="">All Pillars</option>
              {pillars.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={selectField}>
              <option value="">All Statuses</option>
              {stages.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={selectField}>
              <option value="">All Reps</option>
              {owners.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        {list.isLoading ? (
          <p className="px-4 py-8 text-sm text-muted">Loading opportunities…</p>
        ) : list.isError ? (
          <p className="px-4 py-8 text-sm text-danger">{getErrorMessage(list.error)}</p>
        ) : table.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No opportunities match these filters.</p>
        ) : (
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="table-pin-first w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted bg-canvas border-b border-line">
                  {['Lead Number', 'Company', 'Contact', 'Pillar', 'Sub Category', 'Assigned To', 'Source', 'Status', 'Created Date'].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((row: PulseOpportunity) => (
                  <LeadRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function LeadRow({ row }: { row: PulseOpportunity }) {
  const assignee = row.owner_display || row.owner_name
  const initials = assignee ? getInitials(assignee) : ''
  const avatarColor = AVATAR_COLORS[(assignee?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]

  return (
    <tr className="group border-b border-canvas hover:bg-brand-soft/50 transition-colors">
      <td className="px-4 py-3 border-l-[3px] border-l-transparent group-hover:border-l-brand">
        <Link
          to="/pulse/opportunities"
          className="font-medium text-brand hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          {row.prospect_number}
        </Link>
      </td>
      <td className="px-4 py-3 font-medium text-ink">{row.company_name}</td>
      <td className="px-4 py-3 text-muted">{row.contact_name}</td>
      <td className="px-4 py-3 text-muted">{row.service_pillar}</td>
      <td className="px-4 py-3 text-muted">{row.sub_category}</td>
      <td className="px-4 py-3">
        {assignee ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColor} text-white text-[10px] font-semibold flex items-center justify-center shrink-0`}>
              {initials}
            </span>
            <span className="text-ink truncate">{assignee}</span>
          </div>
        ) : (
          <span className="text-subtle">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted">{row.lead_source || '—'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border ${STAGE_STYLE[row.stage] ?? 'bg-canvas text-muted border-line'}`}>
          {row.stage}
        </span>
      </td>
      <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDate(row.created_at)}</td>
    </tr>
  )
}

function ChartCard({ title, icon, children }: { title: string; icon: ReactNode; children: React.ReactNode }) {
  return (
    <div className="group h-full flex flex-col rounded-2xl border border-brand/20 bg-gradient-to-br from-surface via-surface to-brand-soft/40 p-4 sm:p-5 shadow-[0_12px_32px_-20px_rgba(124,58,237,0.35)] hover:border-brand/35 hover:shadow-[0_16px_36px_-18px_rgba(124,58,237,0.4)] transition-shadow">
      <div className="flex items-center gap-2.5 mb-4 shrink-0">
        <span className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shadow-sm shadow-brand/10">
          {icon}
        </span>
        <p className="text-sm font-semibold tracking-tight text-ink">{title}</p>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  )
}

function EmptyChart() {
  return <p className="text-sm text-muted py-16 text-center">No records in this created-date range.</p>
}

export default OpsPipeline
