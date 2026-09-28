import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
import { useAuth } from '../hooks/useAuth'
import { invalidateFinanceQueries } from '../lib/financeQueries'
import { notify } from '../lib/notify'
import { btnPrimaryClass } from '../components/Modal'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function FinanceMis() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const list = useQuery({
    queryKey: ['mis-uploads'],
    queryFn: financeApi.listMisUploads,
    enabled: isAdmin,
  })

  const upload = useMutation({
    mutationFn: (file: File) => financeApi.uploadMis(file),
    onSuccess: async (row) => {
      const result = row.import_result
      if (result) {
        notify.success(
          `Parsed ${row.file_name}: invoices ${result.invoices.created + result.invoices.updated}, payables ${result.payables.created + result.payables.updated}, cashflow ${result.cashflow.created + result.cashflow.updated}${result.errors?.length ? ` (${result.errors.length} warnings)` : ''}.`,
        )
      } else {
        notify.success(`Parsed ${row.file_name} into finance ledgers.`)
      }
      await invalidateFinanceQueries(queryClient)
    },
    onError: (err) => notify.error(getErrorMessage(err, 'Could not upload the file.')),
  })

  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted">MIS upload is only available for Admin.</p>
  }

  const rows = list.data?.results ?? []

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Financial Control</p>
          <h2 className="text-2xl font-semibold text-ink mt-1">MIS Upload</h2>
          <p className="text-sm text-muted mt-1">
            Upload the Sample MIS plate (.xlsx). Sales, Purchase, and Bank book rows are parsed into invoices, payables, and cashflow.
          </p>
        </div>
        <div>
          <button
            type="button"
            className={btnPrimaryClass}
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? 'Uploading…' : 'Upload .xlsx'}
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
        </div>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading uploads…</p>
      ) : list.isError ? (
        <p className="text-sm text-danger">{getErrorMessage(list.error)}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No MIS files stored yet.</p>
      ) : (
        <div className="bg-surface border border-line rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted bg-canvas border-b border-line">
                <th className="px-4 py-3 font-semibold">File</th>
                <th className="px-4 py-3 font-semibold">Size</th>
                <th className="px-4 py-3 font-semibold">Uploaded by</th>
                <th className="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-canvas">
                  <td className="px-4 py-3 text-ink">{row.file_name}</td>
                  <td className="px-4 py-3 text-muted">{formatBytes(row.byte_size)}</td>
                  <td className="px-4 py-3 text-muted">{row.uploaded_by_name || '—'}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{formatWhen(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
