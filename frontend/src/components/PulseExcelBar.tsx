import { useRef, useState } from 'react'
import { btnSecondaryClass } from './Modal'
import ImportHistoryModal from './ImportHistoryModal'
import ImportResultModal, { type ImportSummary } from './ImportResultModal'
import { getErrorMessage } from '../api/errors'
import { useAuth } from '../hooks/useAuth'
import { downloadBlob } from '../lib/download'
import { notify } from '../lib/notify'
import type { ImportModule, PulseImportResult } from '../types'

interface Props {
  onTemplate: () => Promise<Blob>
  onExport: () => Promise<Blob>
  onImport: (file: File) => Promise<PulseImportResult>
  templateName: string
  exportName: string
  onImported: () => void
  /** Hide Import and Template for roles that cannot write. */
  readOnly?: boolean
  /** Enables the History button (Admin and Management) for this import type. */
  module?: ImportModule
  /** Heading for the import result and history dialogs, e.g. "Opportunities". */
  label?: string
}

export default function PulseExcelBar({
  onTemplate,
  onExport,
  onImport,
  templateName,
  exportName,
  onImported,
  readOnly = false,
  module,
  label = 'Import',
}: Props) {
  const { isAdmin, isManagement } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const canSeeHistory = Boolean(module) && (isAdmin || isManagement)

  const run = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await work()
    } catch (err) {
      notify.error(getErrorMessage(err, 'Could not complete the file action.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {readOnly ? null : (
        <button
          type="button"
          disabled={busy}
          className={`${btnSecondaryClass} text-xs`}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Working…' : 'Import'}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        className={`${btnSecondaryClass} text-xs`}
        onClick={() => run(async () => {
          downloadBlob(await onExport(), exportName)
          notify.success('Export downloaded.')
        })}
      >
        Export
      </button>
      {readOnly ? null : (
        <button
          type="button"
          disabled={busy}
          className={`${btnSecondaryClass} text-xs`}
          onClick={() => run(async () => {
            downloadBlob(await onTemplate(), templateName)
            notify.success('Template downloaded.')
          })}
        >
          Template
        </button>
      )}
      {canSeeHistory ? (
        <button type="button" className={`${btnSecondaryClass} text-xs`} onClick={() => setHistoryOpen(true)}>
          History
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void run(async () => {
            const result = await onImport(file)
            const warnings = result.warnings ?? []
            const unmatched = result.unmatched_assignees ?? []
            if (!result.errors.length && !warnings.length && !unmatched.length) {
              const updated = result.updated ? `, updated ${result.updated}` : ''
              notify.success(`Imported ${result.created} row${result.created === 1 ? '' : 's'}${updated}.`)
            } else {
              setSummary({
                title: `${label} results`,
                fileName: file.name,
                created: result.created,
                updated: result.updated,
                contactsCreated: result.contacts_created,
                errors: result.errors,
                warnings,
                unmatchedAssignees: unmatched,
              })
            }
            onImported()
          })
        }}
      />
      <ImportResultModal open={summary !== null} summary={summary} onClose={() => setSummary(null)} />
      {module && canSeeHistory ? (
        <ImportHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          module={module}
          title={`${label} import history`}
        />
      ) : null}
    </div>
  )
}
