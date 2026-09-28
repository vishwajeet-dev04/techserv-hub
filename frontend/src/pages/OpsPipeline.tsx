import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Ban,
  BarChart3,
  Calendar,
  CheckCircle2,
  FileText,
  Flag,
  Layers3,
  MessageSquare,
  PieChart,
  Search,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
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
import type { PulseOpportunity, PulsePipelineDashboard, PulsePipelineFlowItem } from '../types'

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

const chartTick = { fontSize: 11, fill: 'var(--color-muted)' }
const tooltipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 1px 2px rgb(0 0 0 / 0.06)',
}
const chartWellClass =
  'rounded-2xl bg-surface/70 border border-white/80 p-3 flex-1 min-h-0 shadow-inner shadow-violet-100/30'

function truncateLabel(value: string, max = 20) {
  const text = String(value ?? '')
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function formatShortNumber(n: number) {
  const fixed = n.toFixed(1).replace(/\.0$/, '')
  const [intPart, decPart] = fixed.split('.')
  const grouped = Number(intPart).toLocaleString('en-IN')
  return decPart ? `${grouped}.${decPart}` : grouped
}

function fmtCurrency(n: number) {
  const value = Number(n) || 0
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e7) {
    return `${sign}₹${formatShortNumber(abs / 1e7)} Cr`
  }
  if (abs >= 1e5) {
    return `${sign}₹${formatShortNumber(abs / 1e5)}L`
  }
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
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
  if (stage === 'Win') return '#059669'
  if (stage === 'Lost') return 'var(--color-danger)'
  if (stage === 'Cancelled') return '#64748b'
  if (stage === 'Negotiation' || stage === 'Commercial') return '#d97706'
  return 'var(--color-brand)'
}

function flowFamily(key: string): 'win' | 'lost' | 'cancelled' | 'mid' | 'base' | 'total' {
  if (key === 'prospects') return 'total'
  if (key === 'Win') return 'win'
  if (key === 'Lost') return 'lost'
  if (key === 'Cancelled') return 'cancelled'
  if (key === 'Commercial' || key === 'Negotiation' || key === 'Demo') return 'mid'
  return 'base'
}

function flowTileTone(key: string) {
  const family = flowFamily(key)
  if (family === 'total') {
    return {
      card: 'bg-gradient-to-br from-[#7C3AED]/[12%] via-white to-violet-50 dark:from-brand/20 dark:via-surface dark:to-surface border-violet-200/80 dark:border-violet-800 shadow-sm hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-shadow',
      icon: 'bg-brand text-white shadow-md shadow-brand/30',
      accent: 'text-brand',
    }
  }
  if (family === 'win') {
    return {
      card: 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-surface border-emerald-200/80 dark:border-emerald-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-shadow',
      icon: 'bg-emerald-500 text-white',
      accent: 'text-emerald-700 dark:text-emerald-300',
    }
  }
  if (family === 'lost') {
    return {
      card: 'bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-surface border-rose-200/70 dark:border-rose-800 shadow-sm hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md transition-shadow',
      icon: 'bg-rose-500 text-white',
      accent: 'text-rose-700 dark:text-rose-300',
    }
  }
  if (family === 'cancelled') {
    return {
      card: 'bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-surface border-slate-200 dark:border-slate-600 shadow-sm hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-md transition-shadow',
      icon: 'bg-slate-500 text-white',
      accent: 'text-slate-600 dark:text-slate-300',
    }
  }
  if (family === 'mid') {
    return {
      card: 'bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/40 dark:to-surface border-amber-200/70 dark:border-amber-800 shadow-sm hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-shadow',
      icon: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      accent: 'text-amber-800 dark:text-amber-300',
    }
  }
  return {
    card: 'bg-gradient-to-br from-violet-50/90 to-white dark:from-violet-950/40 dark:to-surface border-violet-100 dark:border-violet-800 shadow-sm hover:border-violet-200 dark:hover:border-violet-700 hover:shadow-md transition-shadow',
    icon: 'bg-surface text-brand border border-violet-100',
    accent: 'text-brand',
  }
}

function FlowLucideIcon({ stageKey }: { stageKey: string }) {
  const cls = 'w-4 h-4'
  if (stageKey === 'prospects') return <Users className={cls} strokeWidth={2.25} />
  if (stageKey === 'Demo' || stageKey === 'Commercial') return <FileText className={cls} strokeWidth={2.25} />
  if (stageKey === 'Negotiation') return <MessageSquare className={cls} strokeWidth={2.25} />
  if (stageKey === 'Win') return <Trophy className={cls} strokeWidth={2.25} />
  if (stageKey === 'Lost') return <XCircle className={cls} strokeWidth={2.25} />
  if (stageKey === 'Cancelled') return <Ban className={cls} strokeWidth={2.25} />
  if (stageKey === 'Approach') return <Flag className={cls} strokeWidth={2.25} />
  return <CheckCircle2 className={cls} strokeWidth={2.25} />
}

function OpenPipelineBracket({ valueLabel }: { valueLabel: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0 text-brand" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center">
        <span className="w-px h-3 bg-brand shrink-0 self-center" />
        <span className="flex-1 h-px bg-brand/70" />
        <span className="w-px h-3 bg-brand shrink-0 self-center" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="rounded-full border border-brand/30 bg-brand-soft px-3 py-1 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-brand tabular-nums leading-none whitespace-nowrap">
            OPEN {valueLabel}
          </p>
        </div>
      </div>
    </div>
  )
}

function PipelineStageCard({
  step,
  index,
  selected,
  onSelect,
}: {
  step: PulsePipelineFlowItem
  index: number
  selected?: boolean
  onSelect?: (key: string) => void
}) {
  const tone = flowTileTone(step.key)
  const isTotal = step.key === 'prospects'
  const value = !isTotal ? step.value : undefined
  const isEmpty = !isTotal && step.count === 0
  const valueText = !isTotal ? (value && value > 0 ? fmtCurrency(value) : '—') : null

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      onClick={() => onSelect?.(step.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(step.key)
        }
      }}
      className={`group relative min-w-0 h-full rounded-2xl border px-3 py-3 flex flex-col text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${tone.card} ${
        isEmpty ? 'opacity-50' : ''
      } ${selected ? 'ring-2 ring-brand/40 border-brand/40 shadow-md' : ''}`}
    >
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${tone.icon}`}>
        <FlowLucideIcon stageKey={step.key} />
      </span>
      <p className="text-3xl font-bold tracking-tight text-ink mt-2.5 leading-none tabular-nums">{step.count}</p>
      <p className="text-[13px] font-medium text-muted mt-1.5 leading-snug">{step.label}</p>
      {isTotal ? (
        <p className="text-[13px] font-medium text-muted mt-auto pt-2">All stages</p>
      ) : (
        <p className={`text-[13px] font-semibold tabular-nums mt-auto pt-2 ${tone.accent}`}>{valueText}</p>
      )}
    </motion.div>
  )
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
    <div className="rounded-2xl border border-violet-100/80 bg-surface p-4 shadow-sm min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-[11px] text-[#6e6e73] tabular-nums text-right">{rangeLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-violet-50/80 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[#6e6e73]">Open opps</p>
          <p className="text-xl font-bold tabular-nums text-ink leading-tight mt-0.5">{openCount}</p>
        </div>
        <div className="rounded-xl bg-violet-50/80 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[#6e6e73]">Open value</p>
          <p className="text-xl font-bold tabular-nums text-brand leading-tight mt-0.5">{fmtCurrency(openValue)}</p>
        </div>
      </div>
      <p className="text-[11px] text-[#6e6e73] mb-2">
        Total opportunities: <span className="font-semibold text-ink tabular-nums">{data.total_prospects}</span>
      </p>
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {stages.map((step) => (
          <li
            key={step.key}
            className="flex items-center justify-between gap-2 text-[12px] py-1 border-b border-canvas last:border-0"
          >
            <span className="text-ink truncate">{step.label}</span>
            <span className="tabular-nums text-[#6e6e73] shrink-0">
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
      <p className="p-6 text-sm text-muted">Pulse CRM is not available for this role.</p>
    )
  }

  if (pipeline.isLoading) {
    return <p className="p-6 text-sm text-muted">Loading pipeline…</p>
  }

  if (pipeline.isError || !data) {
    return <p className="p-6 text-sm text-danger">{getErrorMessage(pipeline.error, 'Could not load Pulse pipeline.')}</p>
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
                <span className="inline-flex items-center rounded-full bg-canvas border border-line px-3 py-1 text-[#6e6e73]">
                  Open count:{' '}
                  <span className="ml-1 font-semibold text-ink tabular-nums">
                    {deltaLabel(currentOpenCount, priorOpenCount)}
                  </span>
                </span>
                <span className="inline-flex items-center rounded-full bg-canvas border border-line px-3 py-1 text-[#6e6e73]">
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

      <div className="relative overflow-hidden rounded-3xl border border-violet-100/80 dark:border-violet-800 bg-gradient-to-br from-white via-[#faf8ff] to-violet-50/40 dark:from-surface dark:via-surface dark:to-brand/10 p-5 md:p-6 shadow-[0_20px_50px_-28px_rgba(124,58,237,0.35)]">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-violet-200/40 dark:bg-brand/20 blur-3xl" />
        <div className="relative mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-ink">Deal pipeline flow</h3>
            <p className="text-[13px] text-muted mt-1">{data.insight}</p>
          </div>
          <p className="text-[12px] font-medium text-brand bg-surface/80 border border-brand/20 rounded-full px-2.5 py-1 w-fit shrink-0">
            Open pipeline
          </p>
        </div>
        {(() => {
          const totalTile = data.flow.find((step) => step.key === 'prospects')
          const openKeys = new Set((data.open_pipeline?.by_stage ?? []).map((row) => row.stage))
          const openSteps = data.flow.filter((step) => openKeys.has(step.key))
          const closedSteps = data.flow.filter(
            (step) => step.key !== 'prospects' && !openKeys.has(step.key),
          )
          const openValue = data.open_pipeline?.value ?? data.pipeline_value ?? 0
          let cardIndex = 0

          return (
            <div className="relative flex flex-col lg:flex-row gap-4 items-stretch">
              {totalTile ? (
                <div className="lg:w-[9.5%] lg:min-w-[6.5rem] lg:shrink-0 lg:pt-9">
                  <PipelineStageCard
                    step={totalTile}
                    index={cardIndex++}
                    selected={!stageFilter}
                    onSelect={selectStage}
                  />
                </div>
              ) : null}

              <div className="min-w-0 flex-1 flex flex-col">
                <p className="lg:hidden mb-4 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand text-white text-xs font-semibold px-3 py-1 shadow-md shadow-brand/25">
                    OPEN {fmtCurrency(openValue)}
                  </span>
                </p>
                <div className="relative flex-1 flex flex-col">
                  <div className="hidden lg:block relative h-5 mb-4 shrink-0">
                    <OpenPipelineBracket valueLabel={fmtCurrency(openValue)} />
                  </div>
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 flex-1 auto-rows-fr"
                    aria-label={`Open pipeline ${fmtCurrency(openValue)}, Prospect to Negotiation`}
                  >
                    {openSteps.map((step) => (
                      <PipelineStageCard
                        key={step.key}
                        step={step}
                        index={cardIndex++}
                        selected={stageFilter === step.key}
                        onSelect={selectStage}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 lg:w-[28%] lg:min-w-[12rem] lg:shrink-0 lg:pt-9">
                {closedSteps.map((step) => (
                  <PipelineStageCard
                    key={step.key}
                    step={step}
                    index={cardIndex++}
                    selected={stageFilter === step.key}
                    onSelect={selectStage}
                  />
                ))}
              </div>
            </div>
          )
        })()}
      </div>

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
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(124,58,237,0.04)' }} />
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
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(124,58,237,0.04)' }} />
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
                    contentStyle={tooltipStyle}
                    formatter={(value) => fmtCurrency(Number(value))}
                    cursor={{ fill: 'rgba(124,58,237,0.04)' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#6e6e73', paddingTop: 8 }}
                    iconType="square"
                    iconSize={10}
                  />
                  <Bar dataKey="expected" name="Expected" fill="var(--color-brand)" radius={[0, 6, 6, 0]} maxBarSize={18} />
                  <Bar dataKey="negotiated" name="Negotiated" fill="#eab308" radius={[0, 6, 6, 0]} maxBarSize={18} />
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
            <table className="w-full min-w-[1100px] text-sm">
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
    <div className="group h-full flex flex-col rounded-2xl border border-violet-100/80 dark:border-violet-800 bg-gradient-to-br from-white via-[#faf8ff] to-violet-50/30 dark:from-surface dark:via-surface dark:to-brand/10 p-5 shadow-[0_12px_32px_-20px_rgba(124,58,237,0.35)] hover:border-violet-200 dark:hover:border-violet-700 hover:shadow-[0_16px_36px_-18px_rgba(124,58,237,0.4)] transition-shadow">
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
