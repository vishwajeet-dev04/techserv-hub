import { useNavigate } from 'react-router-dom'
import type { Deal, DealStage, PipelineBreakdown, PipelineStageRow } from '../types'
import { fmtCurrency, fmtDate, isOverdue, pillarColor, STAGE_ORDER, stageConfig } from '../lib/display'

export function StageBadge({ stage }: { stage: DealStage }) {
  const config = stageConfig[stage]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

export function FunnelChart({ rows }: { rows: PipelineStageRow[] }) {
  const byStage = Object.fromEntries(rows.map((row) => [row.stage, row]))
  const visible = STAGE_ORDER.filter((stage) => stage !== 'LOST')
  const max = Math.max(...visible.map((stage) => byStage[stage]?.count ?? 0), 1)

  return (
    <div className="space-y-3">
      {visible.map((stage, index) => {
        const row = byStage[stage]
        const count = row?.count ?? 0
        const value = row?.total_value ?? 0
        const width = 42 + (count / max) * 58
        return (
          <div key={stage} className="flex items-center gap-3">
            <div className="w-28 shrink-0">
              <p className="text-xs font-medium text-[#1a1a1a]">{stageConfig[stage].label}</p>
              <p className="text-[11px] text-[#aeaeb2]">{count} deals</p>
            </div>
            <div className="flex-1">
              <div
                className={`h-9 rounded-xl flex items-center justify-end px-3 text-white text-xs font-semibold shadow-sm ${stageConfig[stage].bar} funnel-bar`}
                style={{ width: `${width}%`, animationDelay: `${index * 60}ms` }}
                title={fmtCurrency(value)}
              >
                {fmtCurrency(value)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function PillarBreakdown({ rows }: { rows: PipelineBreakdown[] }) {
  const max = Math.max(...rows.map((row) => row.total_value), 1)
  if (rows.length === 0) {
    return <p className="text-sm text-[#aeaeb2] py-6 text-center">No pillar data yet</p>
  }
  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((row) => (
        <div key={row.name}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="text-sm font-medium text-[#1a1a1a] truncate">{row.name}</p>
            <p className="text-xs font-semibold text-[#1a1a1a] shrink-0">{fmtCurrency(row.total_value)}</p>
          </div>
          <div className="h-2 rounded-full bg-[#f5f5f7] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(4, (row.total_value / max) * 100)}%`,
                background: pillarColor(row.name),
              }}
            />
          </div>
          <p className="text-[11px] text-[#aeaeb2] mt-1">
            {row.active_count} active · {row.won_count} won · {row.count} total
          </p>
        </div>
      ))}
    </div>
  )
}

export function OwnerPerformance({ rows }: { rows: PipelineBreakdown[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#aeaeb2] py-6 text-center">No owner data yet</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map((row) => {
        const closed = row.won_count + row.lost_count
        const winRate = closed > 0 ? Math.round((row.won_count / closed) * 100) : 0
        return (
          <div key={row.name} className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#1a1a1a]">{row.name}</p>
                <p className="text-xs text-[#6e6e73] mt-0.5">{row.active_count} active deals</p>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-100">
                {winRate}% win
              </span>
            </div>
            <p className="text-lg font-semibold text-[#1a1a1a] mt-3">{fmtCurrency(row.weighted_value)}</p>
            <p className="text-[11px] text-[#aeaeb2]">Weighted pipeline · {fmtCurrency(row.total_value)} gross</p>
          </div>
        )
      })}
    </div>
  )
}

export function PipelineBoard({
  deals,
  canMove,
  onMove,
}: {
  deals: Deal[]
  canMove: boolean
  onMove: (dealId: string, stage: DealStage) => void
}) {
  const navigate = useNavigate()
  const grouped = STAGE_ORDER.map((stage) => ({
    stage,
    deals: deals.filter((deal) => deal.stage === stage),
  }))

  return (
    <div className="overflow-x-auto pb-2 -mx-1 px-1">
      <div className="flex gap-3 min-w-max">
        {grouped.map((column) => (
          <div
            key={column.stage}
            className={`w-72 shrink-0 rounded-2xl border p-3 ${stageConfig[column.stage].board}`}
            onDragOver={(event) => {
              if (canMove) event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              const dealId = event.dataTransfer.getData('text/deal-id')
              if (dealId && canMove) onMove(dealId, column.stage)
            }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <StageBadge stage={column.stage} />
              <span className="text-[11px] font-medium text-[#6e6e73]">{column.deals.length}</span>
            </div>
            <div className="space-y-2 min-h-24">
              {column.deals.map((deal) => {
                const overdue = isOverdue(deal.expected_close_date) && deal.stage !== 'WON' && deal.stage !== 'LOST'
                return (
                  <button
                    key={deal.id}
                    type="button"
                    draggable={canMove}
                    onDragStart={(event) => event.dataTransfer.setData('text/deal-id', deal.id)}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    className="w-full text-left bg-white border border-[#e5e5ea] rounded-xl p-3 shadow-sm hover:border-violet-200 hover:shadow-md transition-all"
                  >
                    <p className="text-sm font-medium text-[#1a1a1a] leading-snug">{deal.name}</p>
                    <p className="text-xs text-[#6e6e73] mt-1">{deal.company_name}</p>
                    {deal.service_pillar ? (
                      <p className="text-[11px] text-violet-600 mt-1">{deal.service_pillar}</p>
                    ) : null}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold text-[#1a1a1a]">{fmtCurrency(deal.value, deal.currency)}</span>
                      <span className={`text-[11px] ${overdue ? 'text-red-600' : 'text-[#aeaeb2]'}`}>
                        {fmtDate(deal.expected_close_date)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
