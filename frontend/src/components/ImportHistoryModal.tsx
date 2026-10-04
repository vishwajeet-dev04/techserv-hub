import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal, { btnRowEditClass, btnSecondaryClass } from './Modal'
import { IssueTable } from './ImportResultModal'
import { auditApi } from '../api/audit'
import { getErrorMessage } from '../api/errors'
import { downloadBlob } from '../lib/download'
import { downloadIssuesCsv } from '../lib/importIssues'
import { notify } from '../lib/notify'
import type { ImportLogEntry, ImportModule } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  module: ImportModule
  title?: string
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ImportDetail({ entry, onBack }: { entry: ImportLogEntry; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['import-log', entry.id],
    queryFn: () => auditApi.getImport(entry.id),
  })

  const downloadOriginal = async () => {
    try {
      downloadBlob(await auditApi.downloadImportFile(entry.id), entry.file_name)
    } catch (err) {
      notify.error(getErrorMessage(err, 'Could not download the original file.'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-xs font-medium text-brand hover:underline">
          ← All imports
        </button>
        <div className="flex flex-wrap gap-2">
          {entry.has_file ? (
            <button type="button" onClick={() => void downloadOriginal()} className={`${btnSecondaryClass} text-xs`}>
              Download original file
            </button>
          ) : null}
          {data && (data.errors.length || data.warnings.length) ? (
            <button
              type="button"
              onClick={() => downloadIssuesCsv(entry.file_name, data.errors, data.warnings)}
              className={`${btnSecondaryClass} text-xs`}
            >
              Download errors (CSV)
            </button>
          ) : null}
        </div>
      </div>
      <div className="text-sm">
        <p className="font-medium text-ink break-all">{entry.file_name}</p>
        <p className="text-xs text-muted">
          {entry.uploaded_by_name || 'Deleted user'} · {formatWhen(entry.created_at)} · {formatSize(entry.byte_size)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Created {entry.created_count} · Updated {entry.updated_count} · Failed {entry.error_count} · Warnings {entry.warning_count}
        </p>
      </div>
      {isLoading ? <p className="text-sm text-muted">Loading…</p> : null}
      {data && !data.errors.length && !data.warnings.length ? (
        <p className="text-sm text-muted">No errors or warnings for this import.</p>
      ) : null}
      {data ? (
        <>
          <IssueTable title="Errors (rows not imported)" issues={data.errors} tone="danger" />
          <IssueTable title="Warnings" issues={data.warnings} tone="warn" />
          {data.error_count > data.errors.length || data.warning_count > data.warnings.length ? (
            <p className="text-xs text-subtle">Only the first 500 errors and warnings are stored.</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default function ImportHistoryModal({ open, onClose, module, title = 'Import history' }: Props) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ImportLogEntry | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['import-logs', module, page],
    queryFn: () => auditApi.listImports(module, page),
    enabled: open,
  })

  const handleClose = () => {
    setSelected(null)
    setPage(1)
    onClose()
  }

  return (
    <Modal open={open} title={title} onClose={handleClose} wide>
      {selected ? (
        <ImportDetail entry={selected} onBack={() => setSelected(null)} />
      ) : isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-danger">{getErrorMessage(error, 'Could not load import history.')}</p>
      ) : !data?.results.length ? (
        <p className="text-sm text-muted">No imports yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-[10px] uppercase tracking-widest text-subtle">
                  <th className="px-3 py-2.5 font-semibold">When</th>
                  <th className="px-3 py-2.5 font-semibold">Who</th>
                  <th className="px-3 py-2.5 font-semibold">File</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Created</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Updated</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Failed</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Warnings</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.results.map((entry) => (
                  <tr key={entry.id} className="border-b border-canvas last:border-0 hover:bg-canvas/60">
                    <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{formatWhen(entry.created_at)}</td>
                    <td className="px-3 py-2">
                      <p className="text-ink">{entry.uploaded_by_name || 'Deleted user'}</p>
                      {entry.uploaded_by_email ? <p className="text-xs text-subtle">{entry.uploaded_by_email}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-ink break-all">{entry.file_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.created_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.updated_count}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${entry.error_count ? 'text-danger font-medium' : ''}`}>
                      {entry.error_count}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.warning_count}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => setSelected(entry)} className={btnRowEditClass}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.next || data.previous ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">Page {page} · {data.count} imports</p>
              <div className="flex gap-2">
                <button type="button" disabled={!data.previous} onClick={() => setPage((p) => p - 1)} className={`${btnSecondaryClass} text-xs`}>
                  Previous
                </button>
                <button type="button" disabled={!data.next} onClick={() => setPage((p) => p + 1)} className={`${btnSecondaryClass} text-xs`}>
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  )
}
