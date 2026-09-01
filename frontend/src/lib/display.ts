import type { DealStage } from '../types'

export const STAGE_ORDER: DealStage[] = [
  'LEAD',
  'QUALIFIED',
  'REQUIREMENT',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
]

export const stageConfig: Record<
  DealStage,
  { label: string; className: string; dot: string; bar: string; board: string }
> = {
  LEAD: {
    label: 'Lead',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
    dot: 'bg-slate-500',
    bar: 'bg-slate-400',
    board: 'bg-slate-50 border-slate-200',
  },
  QUALIFIED: {
    label: 'Qualified',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-500',
    bar: 'bg-blue-500',
    board: 'bg-blue-50/60 border-blue-100',
  },
  REQUIREMENT: {
    label: 'Requirement',
    className: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    dot: 'bg-cyan-500',
    bar: 'bg-cyan-500',
    board: 'bg-cyan-50/60 border-cyan-100',
  },
  PROPOSAL: {
    label: 'Proposal',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    board: 'bg-amber-50/60 border-amber-100',
  },
  NEGOTIATION: {
    label: 'Negotiation',
    className: 'bg-orange-50 text-orange-700 border border-orange-200',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    board: 'bg-orange-50/60 border-orange-100',
  },
  WON: {
    label: 'Won',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    board: 'bg-emerald-50/60 border-emerald-100',
  },
  LOST: {
    label: 'Lost',
    className: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    bar: 'bg-red-500',
    board: 'bg-red-50/60 border-red-100',
  },
}

export const PILLAR_COLORS = [
  '#7C3AED',
  '#4F46E5',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#F97316',
  '#EC4899',
  '#64748B',
]

export function fmtCurrency(n: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n) || 0)
}

export function fmtFullCurrency(n: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)
}

export function fmtNumber(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function isOverdue(d: string | null) {
  if (!d) return false
  const close = new Date(d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return close < today
}

export function pillarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return PILLAR_COLORS[hash % PILLAR_COLORS.length] ?? '#7C3AED'
}
