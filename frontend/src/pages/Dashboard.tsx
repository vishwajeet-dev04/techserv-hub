import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { pulseApi } from '../api/pulse'
import { getErrorMessage } from '../api/errors'
import { useAuth } from '../hooks/useAuth'
import { btnSecondaryClass } from '../components/Modal'
import { useDateRange } from '../hooks/useDateRange'
import OpsSummaryPanel from '../components/ops/OpsSummaryPanel'
import PipelineSections from './OpsPipeline'
import { chartGridStroke, chartTick, seriesColor, STATUS_COLORS, tooltipProps } from '../lib/chartTheme'
import { fmtInr as fmtMoney, fmtInrCompact as fmtCompact } from '../lib/format'

type VolumeTab = 'leads' | 'revenue' | 'winloss'
type RevenueMode = 'win' | 'closed' | 'both'

function fmtWeek(week: string) {
  const parsed = new Date(`${week}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return week
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function Dashboard() {
  const { hasAccess } = useAuth()
  const queryClient = useQueryClient()
  const { from: dateFrom, to: dateTo } = useDateRange()
  const [volumeTab, setVolumeTab] = useState<VolumeTab>('leads')
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('both')
  const allowed = hasAccess('pulse')

  const executive = useQuery({
    queryKey: ['pulse-executive', dateFrom, dateTo],
    queryFn: () => pulseApi.executive({ from: dateFrom, to: dateTo }),
    enabled: allowed,
  })

  if (!allowed) {
    return <p className="p-4 sm:p-6 text-sm text-muted">Pulse CRM is not available for this role.</p>
  }

  if (executive.isLoading) {
    return <p className="p-4 sm:p-6 text-sm text-muted">Loading executive summary…</p>
  }

  if (executive.isError || !executive.data) {
    return (
      <p className="p-4 sm:p-6 text-sm text-danger">
        {getErrorMessage(executive.error, 'Could not load executive summary.')}
      </p>
    )
  }

  const data = executive.data
  const revenueRows = data.by_pillar_revenue[revenueMode]
  const volume = data.volume.map((row) => ({ ...row, weekLabel: fmtWeek(row.week) }))

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Deal-to-Billing Ops</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-ink mt-1">Summary</h2>
          <p className="text-sm text-muted mt-1">
            Live Pulse contacts and opportunities, filtered by created date.
          </p>
        </div>
        <button
          type="button"
          className={`${btnSecondaryClass} w-fit`}
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ['pulse-executive'] })
          }}
        >
          Refresh
        </button>
      </div>

      <OpsSummaryPanel data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">Pipeline health</h3>
            <p className="text-xs text-muted mt-0.5">Stages with at least one opportunity in range</p>
          </div>
          {data.pipeline_health.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No opportunities in this created-date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted bg-canvas border-b border-line">
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Count</th>
                    <th className="px-4 py-3 font-semibold">Expected value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pipeline_health.map((row) => (
                    <tr key={row.stage} className="border-b border-canvas">
                      <td className="px-4 py-3 text-ink">{row.stage}</td>
                      <td className="px-4 py-3 text-ink">{row.count}</td>
                      <td className="px-4 py-3 text-ink whitespace-nowrap">{fmtMoney(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">Needs attention</h3>
          <p className="text-xs text-muted mt-0.5 mb-3">Highest non-Win stages</p>
          {data.attention.length === 0 ? (
            <p className="text-sm text-muted">Nothing queued outside Win.</p>
          ) : (
            <ul className="space-y-2">
              {data.attention.map((row) => (
                <li key={row.stage} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink truncate">{row.stage}</span>
                  <span className="text-muted shrink-0">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Deals won by pillar">
          {data.by_pillar_won.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.by_pillar_won} dataKey="count" nameKey="name" innerRadius={52} outerRadius={86}>
                  {data.by_pillar_won.map((row, index) => (
                    <Cell key={row.name} fill={seriesColor(index)} />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard
          title="Revenue by pillar"
          action={
            <div className="flex gap-1">
              {(['win', 'closed', 'both'] as RevenueMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRevenueMode(mode)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium capitalize ${
                    revenueMode === mode ? 'bg-brand text-white' : 'bg-canvas text-muted'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          }
        >
          {revenueRows.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={revenueRows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86}>
                  {revenueRows.map((row, index) => (
                    <Cell key={row.name} fill={seriesColor(index)} />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} formatter={(value) => fmtMoney(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <section className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Volume</h3>
            <p className="text-xs text-muted mt-0.5">Weekly creates in the selected range</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['leads', 'Leads & Deals'],
                ['revenue', 'Deals & Revenue'],
                ['winloss', 'Win vs Loss'],
              ] as [VolumeTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVolumeTab(id)}
                className={`px-3 py-2 rounded-xl text-xs font-medium ${
                  volumeTab === id ? 'bg-brand text-white' : 'bg-canvas text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {volume.length === 0 ? <EmptyChart /> : <VolumeChart tab={volumeTab} rows={volume} />}
      </section>

      <PipelineSections />
    </div>
  )
}

function VolumeChart({
  tab,
  rows,
}: {
  tab: VolumeTab
  rows: { week: string; weekLabel: string; leads: number; deals: number; won_value: number; win: number; lost: number }[]
}) {
  if (tab === 'leads') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
          <XAxis dataKey="weekLabel" tick={chartTick} />
          <YAxis tick={chartTick} allowDecimals={false} />
          <Tooltip {...tooltipProps} />
          <Legend />
          <Line type="monotone" dataKey="leads" name="Leads" stroke={seriesColor(0)} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="deals" name="Deals" stroke={seriesColor(3)} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
  if (tab === 'revenue') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
          <XAxis dataKey="weekLabel" tick={chartTick} />
          <YAxis yAxisId="left" tick={chartTick} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={chartTick} tickFormatter={(v) => fmtCompact(Number(v))} />
          <Tooltip
            {...tooltipProps}
            formatter={(value, name) => (name === 'Won value' ? fmtMoney(Number(value)) : Number(value))}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="deals" name="Deals" fill={seriesColor(3)} radius={[6, 6, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="won_value" name="Won value" stroke={seriesColor(2)} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
        <XAxis dataKey="weekLabel" tick={chartTick} />
        <YAxis tick={chartTick} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Legend />
        <Bar dataKey="win" name="Win" fill={STATUS_COLORS.success} radius={[6, 6, 0, 0]} />
        <Bar dataKey="lost" name="Lost" fill={STATUS_COLORS.danger} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 sm:p-5 shadow-sm min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return <p className="text-sm text-muted py-16 text-center">No records in this created-date range.</p>
}
