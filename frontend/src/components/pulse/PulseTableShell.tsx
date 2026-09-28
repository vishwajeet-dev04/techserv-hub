import type { ReactNode } from 'react'

export default function PulseTableShell({
  children,
  minWidth,
  title,
  count,
  headerRight,
  footer,
}: {
  children: ReactNode
  minWidth?: string
  title?: string
  count?: number
  headerRight?: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="mt-5 bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm overflow-hidden">
      {title != null ? (
        <div className="px-4 py-3.5 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">
            {title}
            {typeof count === 'number' ? (
              <span className="text-muted font-medium"> ({count})</span>
            ) : null}
          </p>
          {headerRight ? <div className="flex items-center gap-2 shrink-0">{headerRight}</div> : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${minWidth ?? ''}`}>{children}</table>
      </div>
      {footer ? (
        <div className="px-4 py-3 border-t border-line bg-canvas/40 flex flex-wrap items-center justify-between gap-3">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function PulseTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-canvas border-b border-line">
      <tr className="text-left text-[10px] uppercase tracking-wider text-subtle">{children}</tr>
    </thead>
  )
}

export function PulsePaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)

  return (
    <>
      <p className="text-xs text-muted">
        Showing {from} to {to} of {total}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <label className="text-xs text-muted flex items-center gap-1.5">
            <select
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            className="px-2.5 py-1 text-xs rounded-lg border border-line bg-surface text-muted hover:text-ink disabled:opacity-40"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            Prev
          </button>
          <span className="px-2 text-xs text-ink tabular-nums">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="px-2.5 py-1 text-xs rounded-lg border border-line bg-surface text-muted hover:text-ink disabled:opacity-40"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  )
}

export function PulseLoadingRows() {
  return (
    <div className="mt-5 space-y-2 animate-pulse">
      <div className="h-10 bg-surface border border-line rounded-xl" />
      <div className="h-10 bg-surface border border-line rounded-xl" />
      <div className="h-10 bg-surface border border-line rounded-xl" />
    </div>
  )
}

export function PulseEmptyState({
  message,
  action,
}: {
  message: string
  action?: ReactNode
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface/80 backdrop-blur-md px-6 py-10 text-center">
      <p className="text-sm text-muted">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
