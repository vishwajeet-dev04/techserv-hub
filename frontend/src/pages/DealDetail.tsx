import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dealsApi } from '../api/deals'
import { getErrorMessage } from '../api/errors'
import { useAuth } from '../hooks/useAuth'
import type { DealActivity, DealActivityType, DealStage } from '../types'
import ActivityFormModal from '../components/ActivityFormModal'

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const TrendingIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const stageConfig: Record<DealStage, { label: string; className: string; dot: string }> = {
  LEAD: { label: 'Lead', className: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-500' },
  QUALIFIED: { label: 'Qualified', className: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
  REQUIREMENT: { label: 'Requirement', className: 'bg-cyan-50 text-cyan-700 border border-cyan-200', dot: 'bg-cyan-500' },
  PROPOSAL: { label: 'Proposal', className: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  NEGOTIATION: { label: 'Negotiation', className: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  WON: { label: 'Won', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  LOST: { label: 'Lost', className: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' },
}

const STAGES: DealStage[] = ['LEAD', 'QUALIFIED', 'REQUIREMENT', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']

const activityBadges: Record<DealActivityType, string> = {
  NOTE: 'bg-slate-100 text-slate-600',
  CALL: 'bg-blue-50 text-blue-700',
  MEETING: 'bg-violet-50 text-violet-700',
  EMAIL: 'bg-cyan-50 text-cyan-700',
  PROPOSAL: 'bg-amber-50 text-amber-700',
  FOLLOW_UP: 'bg-emerald-50 text-emerald-700',
}

const activityLabels: Record<DealActivityType, string> = {
  NOTE: 'Note',
  CALL: 'Call',
  MEETING: 'Meeting',
  EMAIL: 'Email',
  PROPOSAL: 'Proposal',
  FOLLOW_UP: 'Follow up',
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#f5f5f7] rounded-xl ${className ?? ''}`} />
}

function StageBadge({ stage }: { stage: DealStage }) {
  const config = stageConfig[stage]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function ActivityTypeBadge({ type }: { type: DealActivityType }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${activityBadges[type]}`}>
      {activityLabels[type]}
    </span>
  )
}

const fmtCurrency = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n) || 0)

const fmtDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#f5f5f7] last:border-0">
      <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest pt-0.5">{label}</p>
      <div className="text-sm text-[#1a1a1a] text-right max-w-[70%]">
        {value || <span className="text-[#aeaeb2]">—</span>}
      </div>
    </div>
  )
}

function StageMenu({
  current,
  disabled,
  onSelect,
}: {
  current: DealStage
  disabled: boolean
  onSelect: (stage: DealStage) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#6e6e73] bg-white border border-[#e5e5ea] hover:text-[#1a1a1a] hover:border-[#d1d1d6] disabled:opacity-50"
      >
        Edit stage
        <ChevronIcon />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-44 bg-white border border-[#e5e5ea] rounded-xl shadow-sm z-10 py-1">
          {STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => {
                setOpen(false)
                if (stage !== current) onSelect(stage)
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f5f5f7] ${
                stage === current ? 'text-violet-600 font-medium' : 'text-[#1a1a1a]'
              }`}
            >
              {stageConfig[stage].label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ActivityTimeline({ activities }: { activities: DealActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14">
        <div className="w-14 h-14 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mb-3 text-[#aeaeb2]">
          <TrendingIcon />
        </div>
        <p className="text-sm font-medium text-[#6e6e73]">No activities yet</p>
        <p className="text-xs text-[#aeaeb2] mt-1">Log a note, call, or meeting to start the timeline</p>
      </div>
    )
  }

  return (
    <div className="px-5 py-4 space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
            {index < activities.length - 1 ? <div className="w-px flex-1 bg-[#e5e5ea] mt-1" /> : null}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <ActivityTypeBadge type={activity.type} />
                <p className="text-sm font-medium text-[#1a1a1a]">{activity.subject}</p>
                {activity.description ? (
                  <p className="text-sm text-[#6e6e73]">{activity.description}</p>
                ) : null}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-[#6e6e73]">{fmtDate(activity.activity_date)}</p>
                <p className="text-[11px] text-[#aeaeb2] mt-0.5">{activity.created_by_name ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DealDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isManagement } = useAuth()
  const [showActivity, setShowActivity] = useState(false)
  const [stageError, setStageError] = useState('')

  const {
    data: deal,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => dealsApi.get(id),
    enabled: Boolean(id),
  })

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['deal-activities', id],
    queryFn: () => dealsApi.getActivities(id),
    enabled: Boolean(id),
  })

  const stageMutation = useMutation({
    mutationFn: (stage: DealStage) => dealsApi.update(id, { stage }),
    onSuccess: async () => {
      setStageError('')
      await queryClient.invalidateQueries({ queryKey: ['deal', id] })
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      await queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => setStageError(getErrorMessage(err, 'Could not update stage.')),
  })

  if (isLoading) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (isError || !deal) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl py-20 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mb-4 text-[#aeaeb2]">
            <TrendingIcon />
          </div>
          <p className="text-sm font-medium text-[#6e6e73]">Deal not found</p>
          <p className="text-xs text-[#aeaeb2] mt-1">
            {getErrorMessage(error, 'This deal does not exist or you cannot view it.')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/deals')}
            className="mt-4 text-sm text-violet-600 hover:text-violet-700"
          >
            Back to Deals
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-5">
      <Link to="/deals" className="text-xs text-[#6e6e73] hover:text-violet-600">
        ← Deals
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">{deal.name}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Link to={`/business/${deal.company}`} className="text-sm text-violet-600 hover:text-violet-700">
              {deal.company_name}
            </Link>
            <StageBadge stage={deal.stage} />
          </div>
        </div>
        {!isManagement ? (
          <div className="flex items-center gap-2 shrink-0">
            <StageMenu
              current={deal.stage}
              disabled={stageMutation.isPending}
              onSelect={(stage) => stageMutation.mutate(stage)}
            />
            <button
              type="button"
              onClick={() => setShowActivity(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
            >
              <PlusIcon />
              Add Activity
            </button>
          </div>
        ) : null}
      </div>

      {stageError ? (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{stageError}</p>
        </div>
      ) : null}

      <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-5">
        <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest mb-2">Deal</p>
        <InfoRow label="Value" value={fmtCurrency(deal.value, deal.currency || 'INR')} />
        <InfoRow label="Weighted value" value={fmtCurrency(deal.weighted_value, deal.currency || 'INR')} />
        <InfoRow label="Probability" value={`${deal.probability}%`} />
        <InfoRow label="Currency" value={deal.currency || 'INR'} />
        <InfoRow label="Expected close date" value={fmtDate(deal.expected_close_date)} />
        <InfoRow label="Owner" value={deal.owner_name} />
        <InfoRow label="Source" value={deal.source} />
        <InfoRow label="Description" value={deal.description} />
        <InfoRow label="Notes" value={deal.notes} />
      </div>

      <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5ea] flex items-center justify-between">
          <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">
            Activity timeline · {activities.length}
          </p>
        </div>
        {activitiesLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          <ActivityTimeline activities={activities} />
        )}
      </div>

      <ActivityFormModal open={showActivity} dealId={deal.id} onClose={() => setShowActivity(false)} />
    </div>
  )
}
