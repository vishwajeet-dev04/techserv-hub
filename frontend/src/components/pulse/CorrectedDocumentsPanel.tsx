import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { dealsApi } from '../../api/deals'
import { pulseApi } from '../../api/pulse'
import { getErrorMessage } from '../../api/errors'
import { notify } from '../../lib/notify'
import { useAuth } from '../../hooks/useAuth'
import ConfirmActionModal from '../ConfirmActionModal'
import { btnPrimaryClass, fieldClass, labelClass } from '../Modal'
import type { PulseOpportunity } from '../../types'

const MAX_FILES = 10

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Open PO document issues for a Win opportunity, plus the owner's corrected-upload form. */
export default function CorrectedDocumentsPanel({ opportunity }: { opportunity: PulseOpportunity }) {
  const queryClient = useQueryClient()
  const { user, isAdmin, isManagement } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [dismissId, setDismissId] = useState<string | null>(null)

  const issues = useQuery({
    queryKey: ['po-issues', 'OPEN', opportunity.id],
    queryFn: () => dealsApi.listPoIssues({ opportunity: opportunity.id, status: 'OPEN' }),
    enabled: opportunity.stage === 'Win',
  })

  const canUpload = isAdmin || isManagement || (Boolean(user?.id) && user?.id === opportunity.owner)

  const upload = useMutation({
    mutationFn: () => pulseApi.addOpportunityDocuments(opportunity.id, files, note.trim()),
    onSuccess: async () => {
      setFiles([])
      setNote('')
      setError('')
      notify.success('Corrected documents uploaded. The issue is resolved and Ops has been notified.')
      await queryClient.invalidateQueries({ queryKey: ['po-issues'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-opportunity-activities'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-opportunities'] })
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not upload documents.')
      setError(message)
      notify.error(message)
    },
  })

  const dismiss = useMutation({
    mutationFn: (id: string) => dealsApi.resolvePoIssue(id, 'Dismissed as a false alarm.'),
    onSuccess: async () => {
      setDismissId(null)
      notify.success('Issue dismissed.')
      await queryClient.invalidateQueries({ queryKey: ['po-issues'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-opportunities'] })
    },
    onError: (err) => notify.error(getErrorMessage(err, 'Could not dismiss the issue.')),
  })

  const open = issues.data ?? []
  if (opportunity.stage !== 'Win' || open.length === 0) return null

  const submit = () => {
    if (files.length === 0) {
      setError('Attach at least one corrected document.')
      return
    }
    if (!note.trim()) {
      setError('Explain what was corrected.')
      return
    }
    setError('')
    upload.mutate()
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-3">
      {open.map((issue) => (
        <div key={issue.id} className="text-sm text-amber-900 dark:text-amber-100">
          <p className="font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
            Ops reported a document issue
          </p>
          <p className="text-xs mt-1">
            {issue.raised_by_name || 'Ops'} · {formatWhen(issue.created_at)}
          </p>
          <p className="text-xs mt-1">{issue.reason_labels.join(', ')}</p>
          {issue.attachments.length > 0 ? (
            <p className="text-xs mt-1">Flagged: {issue.attachments.map((file) => file.file_name).join(', ')}</p>
          ) : null}
          {issue.note ? <p className="text-xs mt-1 italic">“{issue.note}”</p> : null}
          {isAdmin || isManagement ? (
            <button
              type="button"
              className="text-xs mt-1 underline hover:no-underline"
              onClick={() => setDismissId(issue.id)}
            >
              Dismiss (false alarm)
            </button>
          ) : null}
        </div>
      ))}

      {canUpload ? (
        <div className="space-y-2 border-t border-amber-200 dark:border-amber-800 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-100">
            Upload corrected documents
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
            className={`${fieldClass} py-2`}
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? [])
              event.target.value = ''
              setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES))
            }}
          />
          {files.length > 0 ? (
            <ul className="space-y-1">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-xs text-ink">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="text-danger hover:underline shrink-0"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <label className={labelClass}>What was corrected?*</label>
            <textarea
              className={`${fieldClass} min-h-16`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Uploaded the signed FY26 PO."
            />
          </div>
          <div className="flex justify-end">
            <button type="button" className={btnPrimaryClass} disabled={upload.isPending} onClick={submit}>
              {upload.isPending ? 'Uploading…' : 'Upload and resolve'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-900 dark:text-amber-100">
          Only the opportunity owner, Admin or Management can upload corrected documents.
        </p>
      )}

      <ConfirmActionModal
        open={dismissId !== null}
        title="Dismiss this issue?"
        message="The issue is marked resolved without new documents. No email is sent."
        confirmLabel="Yes, dismiss"
        pendingLabel="Dismissing…"
        pending={dismiss.isPending}
        onCancel={() => setDismissId(null)}
        onConfirm={() => dismissId && dismiss.mutate(dismissId)}
      />
    </div>
  )
}
