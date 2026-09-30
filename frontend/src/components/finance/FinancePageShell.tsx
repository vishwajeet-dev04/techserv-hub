import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Upload } from 'lucide-react'
import { financeApi } from '../../api/finance'
import { getErrorMessage } from '../../api/errors'
import { useAuth } from '../../hooks/useAuth'
import { useDateRange } from '../../hooks/useDateRange'
import { invalidateFinanceQueries } from '../../lib/financeQueries'
import { notify } from '../../lib/notify'
import { btnPrimaryClass, btnSecondaryClass, fieldClass } from '../Modal'
import type { MisImportResult } from '../../types'

export type FinanceFilters = {
  from: string
  to: string
  client: string
  vendor: string
  search: string
  preset: string
}

function formatImportResult(result?: MisImportResult | null) {
  if (!result) return 'Uploaded.'
  const parts = [
    `Invoices ${result.invoices.created + result.invoices.updated}`,
    `Payables ${result.payables.created + result.payables.updated}`,
    `Cashflow ${result.cashflow.created + result.cashflow.updated}`,
  ]
  const err = result.errors?.length ? ` · ${result.errors.length} row warning(s)` : ''
  return `Parsed into ledgers — ${parts.join(', ')}${err}`
}

type Props = {
  title: string
  subtitle: string
  clients?: string[]
  vendors?: string[]
  showClientFilter?: boolean
  showVendorFilter?: boolean
  showSearch?: boolean
  searchPlaceholder?: string
  actions?: ReactNode
  /** Optional promo card shown beside the title (Cashflow mock). */
  promo?: ReactNode
  filters: FinanceFilters
  onFiltersChange: (next: FinanceFilters) => void
  onRefresh: () => void
  updatedAt?: Date | null
  children: ReactNode
}

export function FinancePageShell({
  title,
  subtitle,
  clients = [],
  vendors = [],
  showClientFilter = false,
  showVendorFilter = false,
  showSearch = true,
  searchPlaceholder = 'Search…',
  actions,
  promo,
  filters,
  onFiltersChange,
  onRefresh,
  updatedAt,
  children,
}: Props) {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: (file: File) => financeApi.uploadMis(file),
    onSuccess: async (row) => {
      notify.success(formatImportResult(row.import_result))
      await invalidateFinanceQueries(queryClient)
      onRefresh()
    },
    onError: (err) => notify.error(getErrorMessage(err, 'Could not upload MIS file.')),
  })

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return null
    const seconds = Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 1000))
    if (seconds < 15) return 'Updated just now'
    if (seconds < 60) return `Updated ${seconds}s ago`
    return `Updated ${Math.floor(seconds / 60)}m ago`
  }, [updatedAt])

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Financial Control</p>
          <h2 className="text-2xl font-semibold text-ink mt-1">{title}</h2>
          <p className="text-sm text-muted mt-1">{subtitle}</p>
          {updatedLabel ? <p className="text-xs text-subtle mt-2">{updatedLabel}</p> : null}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          {promo}
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <button type="button" className={btnSecondaryClass} onClick={onRefresh}>
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
              Refresh Data
            </button>
            {isAdmin ? (
              <>
                <button
                  type="button"
                  className={btnPrimaryClass}
                  disabled={upload.isPending}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                  {upload.isPending ? 'Uploading…' : 'Upload Data'}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    upload.mutate(file)
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      {showClientFilter || showVendorFilter || showSearch ? (
      <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-3 shadow-sm flex flex-col xl:flex-row xl:items-center gap-3">
        {showClientFilter ? (
          <select
            className={`${fieldClass} xl:max-w-[200px]`}
            value={filters.client}
            onChange={(e) => onFiltersChange({ ...filters, client: e.target.value })}
          >
            <option value="">All Clients</option>
            {clients.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : null}
        {showVendorFilter ? (
          <select
            className={`${fieldClass} xl:max-w-[200px]`}
            value={filters.vendor}
            onChange={(e) => onFiltersChange({ ...filters, vendor: e.target.value })}
          >
            <option value="">All Vendors</option>
            {vendors.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : null}
        {showSearch ? (
          <input
            className={fieldClass}
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
        ) : null}
      </div>
      ) : null}

      {children}
    </div>
  )
}

export function useFinanceFilters(initial?: Partial<Pick<FinanceFilters, 'client' | 'vendor' | 'search'>>) {
  const { from, to } = useDateRange()
  const [local, setLocal] = useState({
    client: initial?.client ?? '',
    vendor: initial?.vendor ?? '',
    search: initial?.search ?? '',
  })
  const filters: FinanceFilters = {
    from,
    to,
    client: local.client,
    vendor: local.vendor,
    search: local.search,
    preset: 'custom',
  }
  const setFilters = (next: FinanceFilters) => {
    setLocal({ client: next.client, vendor: next.vendor, search: next.search })
  }
  return { filters, setFilters }
}

export function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)
}

export function KpiCard({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string
  value: string
  tone?: 'default' | 'in' | 'out' | 'net'
  hint?: string
}) {
  const toneClass =
    tone === 'in'
      ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
      : tone === 'out'
        ? 'border-rose-200 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30'
        : tone === 'net'
          ? 'border-brand/30 bg-brand-soft/40'
          : 'border-line bg-surface/80 backdrop-blur-md'
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-xl font-semibold text-ink mt-1 tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-subtle mt-1">{hint}</p> : null}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase()
  const tone =
    upper.includes('PAID') || upper === 'ACTIVE' || upper === 'INFLOW'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
      : upper.includes('PENDING') || upper.includes('SENT') || upper.includes('PARTIAL')
        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
        : upper.includes('OUTFLOW') || upper.includes('OVERDUE') || upper.includes('CANCEL')
          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          : 'bg-canvas text-muted border-line'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${tone}`}>
      {status}
    </span>
  )
}
