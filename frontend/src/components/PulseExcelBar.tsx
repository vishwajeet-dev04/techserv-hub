import { useRef, useState } from 'react'
import { btnSecondaryClass } from './Modal'
import { getErrorMessage } from '../api/errors'
import { downloadBlob } from '../lib/download'
import { notify } from '../lib/notify'
import type { PulseImportResult } from '../types'

interface Props {
  onTemplate: () => Promise<Blob>
  onExport: () => Promise<Blob>
  onImport: (file: File) => Promise<PulseImportResult>
  templateName: string
  exportName: string
  onImported: () => void
  /** Hide Import and Template for roles that cannot write. */
  readOnly?: boolean
}

export default function PulseExcelBar({
  onTemplate,
  onExport,
  onImport,
  templateName,
  exportName,
  onImported,
  readOnly = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

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
          Import
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
            const extra = result.errors.length
              ? ` ${result.errors.length} row${result.errors.length === 1 ? '' : 's'} failed.`
              : ''
            const updated = result.updated ? `, updated ${result.updated}` : ''
            const message = `Imported ${result.created} row${result.created === 1 ? '' : 's'}${updated}.${extra}`
            if (result.errors[0]) {
              notify.info(`${message} First error (row ${result.errors[0].row}): ${result.errors[0].message}`)
            } else {
              notify.success(message)
            }
            onImported()
          })
        }}
      />
    </div>
  )
}
