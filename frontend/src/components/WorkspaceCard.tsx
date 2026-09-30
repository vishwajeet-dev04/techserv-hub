import type { ReactNode } from 'react'
import { ArrowRight, Check } from 'lucide-react'

interface WorkspaceCardProps {
  title: string
  body: string
  badge: ReactNode
  active: boolean
  selected?: boolean
  onSelect?: () => void
}

export default function WorkspaceCard({ title, body, badge, active, selected, onSelect }: WorkspaceCardProps) {
  const base =
    'group relative w-full text-left flex items-start gap-4 bg-surface/80 backdrop-blur-md border rounded-2xl p-5 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
  const state = active
    ? `${selected ? 'border-brand ring-1 ring-brand' : 'border-line'} hover:border-brand/40 hover:shadow-md cursor-pointer`
    : 'border-line opacity-60 cursor-not-allowed'

  return (
    <button
      type="button"
      disabled={!active}
      aria-disabled={!active}
      onClick={active ? onSelect : undefined}
      className={`${base} ${state}`}
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-sm font-bold tracking-wide ${
          active ? 'bg-brand-soft text-brand' : 'bg-canvas text-subtle'
        }`}
      >
        {badge}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {!active ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-warning-soft text-warning">
              Coming soon
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted mt-1 leading-relaxed">{body}</p>
      </div>
      {active ? (
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors mt-1 bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white"
          aria-hidden
        >
          {selected ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <ArrowRight className="w-4 h-4" strokeWidth={2} />}
        </span>
      ) : null}
    </button>
  )
}
