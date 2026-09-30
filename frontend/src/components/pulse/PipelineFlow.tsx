import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Ban, CheckCircle2, FileText, Flag, MessageSquare, Trophy, Users, XCircle } from 'lucide-react'
import { fmtInrShort } from '../../lib/format'
import type { PulsePipelineDashboard, PulsePipelineFlowItem } from '../../types'

type FlowFamily = 'win' | 'lost' | 'cancelled' | 'mid' | 'base' | 'total'

function flowFamily(key: string): FlowFamily {
  if (key === 'prospects') return 'total'
  if (key === 'Win') return 'win'
  if (key === 'Lost') return 'lost'
  if (key === 'Cancelled') return 'cancelled'
  if (key === 'Commercial' || key === 'Negotiation' || key === 'Demo') return 'mid'
  return 'base'
}

const HOVER = 'shadow-sm hover:shadow-md transition-shadow'

const TONES: Record<FlowFamily, { card: string; icon: string; accent: string }> = {
  total: {
    card: `bg-gradient-to-br from-brand/15 via-surface to-brand-soft/60 border-brand/30 hover:border-brand/50 ${HOVER}`,
    icon: 'bg-brand text-white shadow-md shadow-brand/30',
    accent: 'text-brand',
  },
  win: {
    card: `bg-gradient-to-br from-success-soft to-surface border-success/30 hover:border-success/50 ${HOVER}`,
    icon: 'bg-emerald-500 text-white',
    accent: 'text-success',
  },
  lost: {
    card: `bg-gradient-to-br from-danger-soft to-surface border-danger/30 hover:border-danger/50 ${HOVER}`,
    icon: 'bg-rose-500 text-white',
    accent: 'text-danger',
  },
  cancelled: {
    card: `bg-gradient-to-br from-canvas to-surface border-line hover:border-subtle ${HOVER}`,
    icon: 'bg-slate-500 text-white',
    accent: 'text-muted',
  },
  mid: {
    card: `bg-gradient-to-br from-warning-soft to-surface border-warning/30 hover:border-warning/50 ${HOVER}`,
    icon: 'bg-warning-soft text-warning border border-warning/30',
    accent: 'text-warning',
  },
  base: {
    card: `bg-gradient-to-br from-brand-soft/70 to-surface border-brand/20 hover:border-brand/40 ${HOVER}`,
    icon: 'bg-surface text-brand border border-brand/25',
    accent: 'text-brand',
  },
}

function FlowIcon({ stageKey }: { stageKey: string }) {
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

export function PipelineStageCard({
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
  const tone = TONES[flowFamily(step.key)]
  const isTotal = step.key === 'prospects'
  const isEmpty = !isTotal && step.count === 0
  const valueText = !isTotal ? (step.value && step.value > 0 ? fmtInrShort(step.value) : '—') : null

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
        <FlowIcon stageKey={step.key} />
      </span>
      <p className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-2.5 leading-none tabular-nums">{step.count}</p>
      <p className="text-[13px] font-medium text-muted mt-1.5 leading-snug">{step.label}</p>
      {isTotal ? (
        <p className="text-[13px] font-medium text-muted mt-auto pt-2">All stages</p>
      ) : (
        <p className={`text-[13px] font-semibold tabular-nums mt-auto pt-2 ${tone.accent}`}>{valueText}</p>
      )}
    </motion.div>
  )
}

/** On mobile the cards scroll sideways; from lg they sit in a grid. */
const scrollRow = 'flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 lg:mx-0 lg:px-0 lg:pb-0 lg:overflow-visible'
const scrollItem = 'w-[9rem] shrink-0 snap-start lg:w-auto lg:shrink'

export default function PipelineFlow({
  data,
  selectedStage,
  onSelectStage,
  action,
  subtitle,
}: {
  data: PulsePipelineDashboard
  selectedStage?: string
  onSelectStage?: (key: string) => void
  action?: ReactNode
  subtitle?: string
}) {
  const totalTile = data.flow.find((step) => step.key === 'prospects')
  const openKeys = new Set((data.open_pipeline?.by_stage ?? []).map((row) => row.stage))
  const openSteps = data.flow.filter((step) => openKeys.has(step.key))
  const closedSteps = data.flow.filter((step) => step.key !== 'prospects' && !openKeys.has(step.key))
  const openValue = data.open_pipeline?.value ?? data.pipeline_value ?? 0
  let cardIndex = 0

  return (
    <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-surface via-surface to-brand-soft/40 p-4 sm:p-5 md:p-6 shadow-[0_20px_50px_-28px_rgba(124,58,237,0.35)]">
      <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-brand/15 blur-3xl" />
      <div className="relative mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-ink">Deal pipeline flow</h3>
          <p className="text-[13px] text-muted mt-1">{subtitle ?? data.insight}</p>
        </div>
        {action ?? (
          <p className="text-[12px] font-medium text-brand bg-surface/80 border border-brand/20 rounded-full px-2.5 py-1 w-fit shrink-0">
            Open pipeline
          </p>
        )}
      </div>

      <div className="relative flex flex-col lg:flex-row gap-4 items-stretch">
        {totalTile ? (
          <div className="w-[9rem] lg:w-[9.5%] lg:min-w-[6.5rem] lg:shrink-0 lg:pt-9">
            <PipelineStageCard
              step={totalTile}
              index={cardIndex++}
              selected={!selectedStage}
              onSelect={onSelectStage}
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 flex flex-col">
          <p className="lg:hidden mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand text-white text-xs font-semibold px-3 py-1 shadow-md shadow-brand/25">
              OPEN {fmtInrShort(openValue)}
            </span>
          </p>
          <div className="relative flex-1 flex flex-col">
            <div className="hidden lg:block relative h-5 mb-4 shrink-0">
              <OpenPipelineBracket valueLabel={fmtInrShort(openValue)} />
            </div>
            <div
              className={`${scrollRow} lg:grid lg:grid-cols-6 lg:gap-4 flex-1 lg:auto-rows-fr`}
              aria-label={`Open pipeline ${fmtInrShort(openValue)}, Prospect to Negotiation`}
            >
              {openSteps.map((step) => (
                <div key={step.key} className={scrollItem}>
                  <PipelineStageCard
                    step={step}
                    index={cardIndex++}
                    selected={selectedStage === step.key}
                    onSelect={onSelectStage}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${scrollRow} lg:grid lg:grid-cols-3 lg:gap-4 lg:w-[28%] lg:min-w-[12rem] lg:shrink-0 lg:pt-9`}>
          {closedSteps.map((step) => (
            <div key={step.key} className={scrollItem}>
              <PipelineStageCard
                step={step}
                index={cardIndex++}
                selected={selectedStage === step.key}
                onSelect={onSelectStage}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
