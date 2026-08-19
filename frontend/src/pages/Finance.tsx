import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
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
  return <div className={`animate-pulse bg-[#f5f5f7] rounded-xl ${className ?? ''}`} />
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
        : 'bg-white border-[#e5e5ea]'
    }`}>
      <div className="flex items-start justify-between mb-3 gap-2">
        <p className={`text-[11px] font-medium uppercase tracking-widest leading-tight ${accent ? 'text-violet-100' : 'text-[#6e6e73]'}`}>
          {label}
        </p>
        {isManual ? (
          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 shrink-0">
            <span className="text-[10px] text-emerald-700 font-medium">Manual</span>
          </span>
        ) : null}
      </div>
      <p className={`text-xl font-semibold leading-none ${
        accent ? 'text-white' : isNegative ? 'text-red-600' : 'text-[#1a1a1a]'
      }`}>
        {fmtCurrency(value)}
      </p>
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
              : 'bg-white text-[#6e6e73] border border-[#e5e5ea] hover:border-[#d1d1d6]'
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
    <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#e5e5ea] shadow-sm rounded-2xl">
      <div className="w-16 h-16 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mb-4 text-[#aeaeb2]">
        <ChartIcon />
      </div>
      <p className="text-sm font-medium text-[#6e6e73]">{title}</p>
      <p className="text-xs text-[#aeaeb2] mt-1">{description}</p>
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
  defaultOpen,
}: {
  periodId: string
  metricMap: Record<string, FinancialMetric>
  prefillKey: string
  defaultOpen: boolean
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(defaultOpen)
  const [values, setValues] = useState<Record<string, string>>(emptyMetricValues)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setOpen(defaultOpen)
    setError('')
    setSuccess('')
    // Only reset expand/messages when the selected period changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId])

  useEffect(() => {
    const next = emptyMetricValues()
    for (const code of ALL_METRIC_CODES) {
      const existing = metricMap[code]
      next[code] = existing != null ? String(existing.value) : ''
    }
    setValues(next)
    // metricMap is recreated each parent render; prefillKey fingerprints values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, prefillKey])

  const mutation = useMutation({
    mutationFn: async (codes: string[]) => {
      await Promise.all(
        codes.map((code) =>
          financeApi.createMetric({
            financial_period: periodId,
            metric_code: code,
            value: Number(values[code]),
            currency: 'INR',
          }),
        ),
      )
    },
    onSuccess: async () => {
      setError('')
      setSuccess('Metrics saved.')
      await queryClient.invalidateQueries({ queryKey: ['financial-metrics'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => {
      setSuccess('')
      setError(getErrorMessage(err, 'Could not save metrics.'))
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    const filled = ALL_METRIC_CODES.filter((code) => values[code]?.trim())
    if (filled.length === 0) {
      setError('Enter at least one metric value.')
      return
    }
    mutation.mutate(filled)
  }

  return (
    <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#f9f9fb] transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-[#1a1a1a]">Enter Metrics</p>
          <p className="text-xs text-[#6e6e73] mt-0.5">Manual income statement and balance sheet values</p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-[#aeaeb2] transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-5 border-t border-[#e5e5ea] pt-4">
          {error ? (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : null}
          {success ? (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-sm text-emerald-700">{success}</p>
            </div>
          ) : null}

          {metricGroups.map((group) => (
            <div key={group.label} className="space-y-3">
              <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.codes.map((code) => (
                  <div key={code} className="flex items-center gap-4">
                    <label className="w-48 shrink-0 text-sm text-[#1a1a1a]">
                      {metricLabels[code] ?? code}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={values[code] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [code]: e.target.value }))
                      }
                      className="flex-1 px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-xl text-sm text-[#1a1a1a] placeholder-[#aeaeb2] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors text-right"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 shadow-sm disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save Metrics'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

export default function Finance() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [showPeriod, setShowPeriod] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

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
    <div className="p-6 max-w-screen-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Finance</h2>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            {selectedPeriod ? `Period: ${selectedPeriod.label}` : 'Financial metrics and documents'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5ea] hover:border-[#d1d1d6] hover:text-[#1a1a1a] text-[#6e6e73] text-sm font-medium rounded-xl transition-colors"
          >
            <UploadIcon />
            Upload Document
          </button>
          <button
            type="button"
            onClick={() => setShowPeriod(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
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
        <PeriodSelector
          periods={periods}
          selectedId={activePeriodId}
          onSelect={setSelectedPeriodId}
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
                    <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">
                      {group.label}
                    </p>
                    <div className="flex-1 h-px bg-[#e5e5ea]" />
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
          ) : null}

          {!metricsLoading ? (
            <MetricsEntryForm
              periodId={activePeriodId}
              metricMap={metricMap}
              prefillKey={metrics.map((m) => `${m.metric_code}:${m.value}`).sort().join('|')}
              defaultOpen={metrics.length === 0}
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
