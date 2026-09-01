import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dealsApi } from '../api/deals'
import { useAuth } from '../hooks/useAuth'
import type { Deal, DealStage } from '../types'
import DealFormModal from '../components/DealFormModal'
import { PipelineBoard, StageBadge } from '../components/PipelineViews'
import { fmtCurrency, fmtDate, fmtFullCurrency, isOverdue, STAGE_ORDER, stageConfig } from '../lib/display'

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

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

const CalendarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const BuildingIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M3 7v14M21 7v14M6 21V7M18 21V7M3 7l9-4 9 4M9 21v-4h6v4" />
  </svg>
)

const STAGE_FILTERS: { label: string; value: DealStage | '' }[] = [
  { label: 'All', value: '' },
  ...STAGE_ORDER.map((stage) => ({ label: stageConfig[stage].label, value: stage })),
]

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#f5f5f7] rounded-xl ${className ?? ''}`} />
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-14 h-14 bg-[#f5f5f7] rounded-2xl flex items-center justify-center mb-4 text-[#aeaeb2]">
        <TrendingIcon />
      </div>
      <p className="text-sm font-medium text-[#6e6e73]">
        {filtered ? 'No deals match your filters' : 'No deals yet'}
      </p>
      <p className="text-xs text-[#aeaeb2] mt-1">
        {filtered ? 'Try adjusting your filters' : 'Add your first deal to start tracking'}
      </p>
    </div>
  )
}

function PipelineBar({ data }: { data: { stage: DealStage; count: number; total_value: number }[] }) {
  const total = data.reduce((sum, s) => sum + (s.total_value || 0), 0)
  if (total === 0) return null
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-[#f5f5f7]">
      {data.map((s) => {
        const pct = ((s.total_value || 0) / total) * 100
        if (pct < 1) return null
        return (
          <div
            key={s.stage}
            className={`${stageConfig[s.stage].bar} first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${pct}%` }}
            title={`${stageConfig[s.stage].label}: ${fmtCurrency(s.total_value || 0)}`}
          />
        )
      })}
    </div>
  )
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95 ${
        active
          ? 'bg-[#7C3AED] text-white border border-[#7C3AED]'
          : 'bg-white border border-[#e5e5ea] text-[#6e6e73] hover:border-[#d1d1d6] hover:text-[#1a1a1a]'
      }`}
    >
      {label}
    </button>
  )
}

function DealRow({ deal }: { deal: Deal }) {
  const navigate = useNavigate()
  const overdue = isOverdue(deal.expected_close_date) && deal.stage !== 'WON' && deal.stage !== 'LOST'

  return (
    <tr
      className="group border-b border-[#f5f5f7] last:border-0 hover:bg-[#f9f9fb] transition-colors duration-100 cursor-pointer"
      onClick={() => navigate(`/deals/${deal.id}`)}
    >
      <td className="px-5 py-3.5">
        <div>
          <p className="text-sm font-medium text-[#1a1a1a]">{deal.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[#aeaeb2]"><BuildingIcon /></span>
            <span className="text-xs text-[#6e6e73]">{deal.company_name}</span>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <p className="text-xs text-[#1a1a1a]">{deal.service_pillar || '—'}</p>
        {deal.sub_category ? <p className="text-[11px] text-[#aeaeb2] mt-0.5">{deal.sub_category}</p> : null}
      </td>
      <td className="px-5 py-3.5">
        <StageBadge stage={deal.stage} />
      </td>
      <td className="px-5 py-3.5" title={fmtFullCurrency(deal.value, deal.currency)}>
        <p className="text-sm font-semibold text-[#1a1a1a]">{fmtCurrency(deal.value, deal.currency)}</p>
        <p className="text-xs text-[#aeaeb2] mt-0.5">{fmtCurrency(deal.weighted_value, deal.currency)} weighted</p>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2" title={`${deal.probability}%`}>
          <div className="w-20 h-1.5 bg-[#f5f5f7] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, deal.probability))}%` }}
            />
          </div>
          <span className="text-xs text-[#6e6e73]">{deal.probability}%</span>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          {overdue ? <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" /> : null}
          <span className={overdue ? 'text-red-600' : 'text-[#aeaeb2]'}>
            <CalendarIcon />
          </span>
          <span className={`text-xs ${overdue ? 'text-red-600' : 'text-[#6e6e73]'}`}>
            {fmtDate(deal.expected_close_date)}
            {overdue ? ' · Overdue' : ''}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-xs text-[#6e6e73]">{deal.owner_name ?? '—'}</span>
      </td>
    </tr>
  )
}

export default function Deals() {
  const { isManagement } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<DealStage | ''>('')
  const [pillarFilter, setPillarFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [view, setView] = useState<'board' | 'table'>('board')

  const boardMode = view === 'board'
  const { data, isLoading } = useQuery({
    queryKey: ['deals', search, stageFilter, pillarFilter, sourceFilter, page, view],
    queryFn: () =>
      dealsApi.list({
        search: search || undefined,
        stage: stageFilter || undefined,
        service_pillar: pillarFilter || undefined,
        source: sourceFilter || undefined,
        page: boardMode ? 1 : page,
        page_size: boardMode ? 200 : 20,
      }),
    placeholderData: (prev) => prev,
  })

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline-summary'],
    queryFn: dealsApi.pipelineSummary,
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) => dealsApi.update(id, { stage }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      await queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const isFiltered = Boolean(search) || Boolean(stageFilter) || Boolean(pillarFilter) || Boolean(sourceFilter)
  const deals = data?.results ?? []
  const pillars = useMemo(
    () => (pipeline?.by_pillar ?? []).map((row) => row.name).filter((name) => name !== 'Uncategorised'),
    [pipeline],
  )
  const sources = useMemo(
    () => (pipeline?.by_source ?? []).map((row) => row.name).filter((name) => name !== 'Unspecified'),
    [pipeline],
  )

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C3AED]">Deal pipeline</p>
          <h2 className="text-2xl font-semibold text-[#1a1a1a] mt-1">Deals</h2>
          <p className="text-xs text-[#aeaeb2] mt-0.5">
            {data ? `${data.count} deals across services and software` : 'Pipeline and deal tracking'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-white border border-[#e5e5ea] rounded-xl">
            {(['board', 'table'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setView(item)
                  setPage(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                  view === item ? 'bg-[#7C3AED] text-white' : 'text-[#6e6e73]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {!isManagement ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#7C3AED] hover:bg-violet-700 text-white text-sm font-medium rounded-xl active:scale-95 transition-transform shadow-sm"
            >
              <PlusIcon />
              Add Deal
            </button>
          ) : null}
        </div>
      </div>

      {pipeline ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-4">
            <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">Total Pipeline</p>
            <p className="text-xl font-semibold text-[#1a1a1a] mt-1.5">{fmtCurrency(pipeline.total_pipeline)}</p>
            <p className="text-xs text-[#aeaeb2] mt-1">{pipeline.active_deals_count} active deals</p>
          </div>
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 border border-violet-600 shadow-sm rounded-2xl p-4 kpi-shine">
            <p className="text-[11px] font-medium text-violet-100 uppercase tracking-widest">Weighted Pipeline</p>
            <p className="text-xl font-semibold text-white mt-1.5">{fmtCurrency(pipeline.weighted_pipeline)}</p>
            <p className="text-xs text-violet-100 mt-1">Risk adjusted</p>
          </div>
          <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-4">
            <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">Won</p>
            <p className="text-xl font-semibold text-emerald-600 mt-1.5">{fmtCurrency(pipeline.won_value ?? pipeline.won_this_month_value)}</p>
            <p className="text-xs text-[#aeaeb2] mt-1">{pipeline.won_count ?? pipeline.won_this_month_count} deals · {pipeline.win_rate ?? 0}% win rate</p>
          </div>
          <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-4">
            <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">Closing Soon</p>
            <p className="text-xl font-semibold text-amber-600 mt-1.5">{pipeline.closing_soon_count}</p>
            <p className="text-xs text-[#aeaeb2] mt-1">Within 30 days</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {pipeline?.by_stage && pipeline.by_stage.length > 0 ? (
        <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-4 space-y-3">
          <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">Stage Distribution</p>
          <PipelineBar data={pipeline.by_stage} />
          <div className="flex items-center gap-4 flex-wrap">
            {pipeline.by_stage.map((s) => (
              <div key={s.stage} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${stageConfig[s.stage].dot}`} />
                <span className="text-xs text-[#6e6e73]">
                  {stageConfig[s.stage].label} ({s.count})
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aeaeb2]">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search deals, companies, pillars..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9 pr-4 py-2 bg-white border border-[#e5e5ea] rounded-xl text-sm text-[#1a1a1a] placeholder:text-[#aeaeb2] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors w-72"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {STAGE_FILTERS.map((filter) => (
            <FilterBtn
              key={filter.label}
              label={filter.label}
              active={stageFilter === filter.value}
              onClick={() => {
                setStageFilter(filter.value)
                setPage(1)
              }}
            />
          ))}
        </div>
        {sources.length > 0 ? (
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 rounded-xl text-xs bg-white border border-[#e5e5ea] text-[#6e6e73]"
          >
            <option value="">All pipelines</option>
            {sources.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        ) : null}
        {pillars.length > 0 ? (
          <select
            value={pillarFilter}
            onChange={(e) => {
              setPillarFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 rounded-xl text-xs bg-white border border-[#e5e5ea] text-[#6e6e73]"
          >
            <option value="">All pillars</option>
            {pillars.map((pillar) => (
              <option key={pillar} value={pillar}>{pillar}</option>
            ))}
          </select>
        ) : null}
      </div>

      {boardMode ? (
        <div className="bg-white/70 border border-[#e5e5ea] shadow-sm rounded-2xl p-4">
          {isLoading ? (
            <TableSkeleton />
          ) : deals.length === 0 ? (
            <EmptyState filtered={isFiltered} />
          ) : (
            <PipelineBoard
              deals={deals}
              canMove={!isManagement}
              onMove={(id, stage) => moveMutation.mutate({ id, stage })}
            />
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : !data || deals.length === 0 ? (
            <EmptyState filtered={isFiltered} />
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e5ea] bg-[#f9f9fb]">
                    {['Deal', 'Pillar', 'Stage', 'Value', 'Probability', 'Close Date', 'Owner'].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-widest"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((deal) => (
                    <DealRow key={deal.id} deal={deal} />
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#e5e5ea]">
                <p className="text-xs text-[#6e6e73]">
                  Page {page} · {data.count} total
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={!data.previous}
                    className="px-3 py-1.5 rounded-xl text-xs text-[#6e6e73] bg-white border border-[#e5e5ea] disabled:opacity-30 hover:text-[#1a1a1a] hover:border-[#d1d1d6] transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data.next}
                    className="px-3 py-1.5 rounded-xl text-xs text-[#6e6e73] bg-white border border-[#e5e5ea] disabled:opacity-30 hover:text-[#1a1a1a] hover:border-[#d1d1d6] transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <DealFormModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
