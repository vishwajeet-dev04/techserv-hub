import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import { useAuth } from '../hooks/useAuth'
import type { FinancialPeriod, FinancialMetric } from '../types'
import PeriodFormModal from '../components/PeriodFormModal'
import DocumentUploadModal from '../components/DocumentUploadModal'

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const ChartIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3v18h18" />
    <path d="M18 9l-5 5-4-4-3 3" />
  </svg>
)

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

const metricLabels: Record<string, string> = {
  revenue: 'Revenue',
  expenses: 'Expenses',
  gross_profit: 'Gross Profit',
  operating_profit: 'Operating Profit',
  net_profit: 'Net Profit',
  cash: 'Cash',
  receivables: 'Receivables',
  payables: 'Payables',
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  cost_of_goods_sold: 'Cost of Goods Sold',
  operating_expenses: 'Operating Expenses',
  tax: 'Tax',
}

const metricGroups = [
  {
    label: 'Income Statement',
    codes: ['revenue', 'cost_of_goods_sold', 'gross_profit', 'operating_expenses', 'operating_profit', 'tax', 'net_profit', 'expenses'],
  },
  {
    label: 'Balance Sheet',
    codes: ['cash', 'receivables', 'assets', 'payables', 'liabilities', 'equity'],
  },
]

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-canvas rounded-xl ${className ?? ''}`} />
}

function MetricCard({
  label,
  value,
  isManual,
  accent = false,
}: {
  label: string
  value: number
  isManual: boolean
  accent?: boolean
}) {
  const isNegative = value < 0
  return (
    <div className={`relative rounded-2xl p-4 border shadow-sm ${
      accent
        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 border-violet-600'
        : 'bg-surface border-line'
    }`}>
      <div className="flex items-start justify-between mb-3 gap-2">
      <p className={`text-xs font-medium uppercase tracking-wider leading-tight ${accent ? 'text-violet-100' : 'text-muted'}`}>
          {label}
        </p>
        {isManual ? (
          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shrink-0">
            <span className="text-[10px] text-success font-medium">Manual</span>
          </span>
        ) : null}
      </div>
      <p className={`text-xl font-semibold leading-none ${
        accent ? 'text-white' : isNegative ? 'text-danger' : 'text-ink'
      }`}>
        {fmtCurrency(value)}
      </p>
      <svg viewBox="0 0 80 24" className={`w-full h-6 mt-3 ${accent ? 'text-white/50' : isNegative ? 'text-red-300' : 'text-violet-300'}`}>
        <path d="M0 16 C10 16 14 8 24 10 S40 20 50 12 68 6 80 10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

function PeriodSelector({
  periods,
  selectedId,
  onSelect,
}: {
  periods: FinancialPeriod[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {periods.map((period) => (
        <button
          key={period.id}
          type="button"
          onClick={() => onSelect(period.id)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            selectedId === period.id
              ? 'bg-violet-600 text-white border border-violet-600'
              : 'bg-surface text-muted border border-line hover:border-line'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-surface border border-line shadow-sm rounded-2xl">
      <div className="w-14 h-14 bg-canvas rounded-2xl flex items-center justify-center mb-4 text-subtle">
        <ChartIcon />
      </div>
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="text-xs text-subtle mt-1">{description}</p>
    </div>
  )
}

const ALL_METRIC_CODES = metricGroups.flatMap((group) => group.codes)

function emptyMetricValues(): Record<string, string> {
  const values: Record<string, string> = {}
  for (const code of ALL_METRIC_CODES) {
    values[code] = ''
  }
  return values
}

function MetricsEntryForm({
  periodId,
  metricMap,
  prefillKey,
  onClose,
  onSaved,
}: {
  periodId: string
  metricMap: Record<string, FinancialMetric>
  prefillKey: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>(emptyMetricValues)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const next = emptyMetricValues()
    for (const code of ALL_METRIC_CODES) {
      const existing = metricMap[code]
      next[code] = existing != null ? String(existing.value) : ''
    }
    setValues(next)
    setError('')
    setNote('')
    // metricMap is recreated each parent render; prefillKey fingerprints values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, prefillKey])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const filled = ALL_METRIC_CODES.filter((code) => values[code]?.trim())
    if (filled.length === 0) {
      setError('Enter at least one metric value.')
      return
    }

    setSaving(true)
    const failed: string[] = []
    let saved = 0

    for (const code of filled) {
      const value = Number(values[code])
      if (Number.isNaN(value)) {
        failed.push(`${metricLabels[code] ?? code} (invalid number)`)
        continue
      }
      try {
        const existing = metricMap[code]
        if (existing) {
          await financeApi.updateMetric(existing.id, { value, currency: 'INR' })
        } else {
          await financeApi.createMetric({
            financial_period: periodId,
            metric_code: code,
            value,
            currency: 'INR',
          })
        }
        saved += 1
      } catch (err) {
        failed.push(`${metricLabels[code] ?? code}: ${getErrorMessage(err, 'could not save')}`)
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['financial-metrics', periodId] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] })
    setSaving(false)

    if (failed.length > 0) {
      const prefix = saved > 0 ? `Saved ${saved}. ` : ''
      const message = `${prefix}Failed to save: ${failed.join('; ')}`
      setError(message)
      notify.error(message)
      return
    }
    notify.success(`${saved} metric${saved === 1 ? '' : 's'} saved.`)
    onSaved(`${saved} metric${saved === 1 ? '' : 's'} saved.`)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-6">
      {error ? (
        <div className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      ) : null}
      {note ? (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-300">{note}</p>
        </div>
      ) : null}

      {metricGroups.map((group, groupIndex) => (
        <div
          key={group.label}
          className={groupIndex > 0 ? 'pt-5 border-t border-line' : ''}
        >
          <p className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
            {group.label}
          </p>
          <div>
            {group.codes.map((code) => (
              <div
                key={code}
                className="flex items-center justify-between gap-4 py-2.5 border-b border-canvas last:border-0"
              >
                <label htmlFor={`metric-${code}`} className="text-ink text-sm font-medium">
                  {metricLabels[code] ?? code}
                </label>
                <input
                  id={`metric-${code}`}
                  type="number"
                  step="0.01"
                  value={values[code] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [code]: e.target.value }))
                  }
                  className="w-48 bg-surface border border-line rounded-xl px-3 py-2 text-sm text-right text-ink placeholder:text-subtle focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => setNote('Contact admin to update existing metrics')}
          className="text-xs text-muted hover:text-ink"
        >
          Clear & Re-enter
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-muted bg-surface border border-line hover:text-ink hover:border-line"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
          >
            {saving ? 'Saving...' : 'Save Metrics'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function FinanceBooks() {
  const { isAdmin, isFinance } = useAuth()
  const canEditMetrics = isAdmin || isFinance
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [showPeriod, setShowPeriod] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const { data: periodsData, isLoading: periodsLoading } = useQuery({
    queryKey: ['financial-periods'],
    queryFn: financeApi.listPeriods,
  })

  const periods: FinancialPeriod[] = periodsData?.results ?? []
  const activePeriodId = selectedPeriodId || periods[0]?.id || ''
  const selectedPeriod = periods.find((p) => p.id === activePeriodId)

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['financial-metrics', activePeriodId],
    queryFn: () => financeApi.listMetrics(activePeriodId),
    enabled: Boolean(activePeriodId),
  })

  const metrics: FinancialMetric[] = metricsData?.results ?? []
  const metricMap: Record<string, FinancialMetric> = {}
  for (const metric of metrics) {
    metricMap[metric.metric_code] = metric
  }

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Financial Control · Books</p>
          <h2 className="text-2xl font-semibold text-ink mt-1">Period metrics</h2>
          <p className="text-xs text-subtle mt-0.5">
            {selectedPeriod ? `Period: ${selectedPeriod.label}` : 'Cash, receivables, and operating position'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-line hover:border-line hover:text-ink text-muted text-sm font-medium rounded-xl active:scale-95 transition-transform"
          >
            <UploadIcon />
            Upload Document
          </button>
          <button
            type="button"
            onClick={() => setShowPeriod(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl active:scale-95 transition-transform shadow-sm"
          >
            <PlusIcon />
            Add Period
          </button>
        </div>
      </div>

      {periodsLoading ? (
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      ) : periods.length > 0 ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PeriodSelector
            periods={periods}
            selectedId={activePeriodId}
            onSelect={(id) => {
              setSelectedPeriodId(id)
            }}
          />
          {canEditMetrics && activePeriodId ? (
            <button
              type="button"
              onClick={() => {
                setFormOpen((open) => !open)
              }}
              className="px-4 py-2 bg-surface border border-line hover:border-line text-muted hover:text-ink text-sm font-medium rounded-xl transition-colors shrink-0"
            >
              Enter / Edit Metrics
            </button>
          ) : null}
        </div>
      ) : null}

      {canEditMetrics && formOpen && activePeriodId && !metricsLoading ? (
        <MetricsEntryForm
          periodId={activePeriodId}
          metricMap={metricMap}
          prefillKey={metrics.map((m) => `${m.metric_code}:${m.value}`).sort().join('|')}
          onClose={() => setFormOpen(false)}
          onSaved={() => {}}
        />
      ) : null}

      {!periodsLoading && periods.length === 0 ? (
        <EmptyState
          title="No financial periods yet"
          description="Add a financial period and enter metrics to get started"
        />
      ) : null}

      {activePeriodId ? (
        <>
          {metricsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : metrics.length > 0 ? (
            metricGroups.map((group) => {
              const groupMetrics = group.codes
                .map((code) => ({ code, metric: metricMap[code] }))
                .filter((item): item is { code: string; metric: FinancialMetric } => Boolean(item.metric))

              if (groupMetrics.length === 0) return null

              return (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-medium text-muted uppercase tracking-wider border-l-2 border-l-violet-500 pl-3">
                      {group.label}
                    </p>
                    <div className="flex-1 h-px bg-line" />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {groupMetrics.map(({ code, metric }) => (
                      <MetricCard
                        key={code}
                        label={metricLabels[code] ?? code}
                        value={metric.value}
                        isManual={metric.is_manual}
                        accent={code === 'revenue' || code === 'net_profit'}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          ) : !formOpen ? (
            <EmptyState
              title="No metrics for this period"
              description={
                canEditMetrics
                  ? 'Use Enter / Edit Metrics to add income statement and balance sheet values'
                  : 'No metrics have been entered for this period'
              }
            />
          ) : null}
        </>
      ) : null}

      <PeriodFormModal open={showPeriod} onClose={() => setShowPeriod(false)} />
      <DocumentUploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        periods={periods}
        selectedPeriodId={activePeriodId}
      />
    </div>
  )
}
