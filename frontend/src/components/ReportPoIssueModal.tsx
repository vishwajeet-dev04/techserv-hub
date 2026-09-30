import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { dealsApi } from '../api/deals'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import ConfirmActionModal from './ConfirmActionModal'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from './Modal'
import type { PoDocumentIssue } from '../types'

interface Props {
  opportunityId: string
  prospectNumber: string
  ownerName: string
  documents: { id: string; file_name: string }[]
  defaultDocumentId?: string | null
  onClose: () => void
  onReported: (issue: PoDocumentIssue) => void
}

export default function ReportPoIssueModal({
  opportunityId,
  prospectNumber,
  ownerName,
  documents,
  defaultDocumentId,
  onClose,
  onReported,
}: Props) {
  const [reasons, setReasons] = useState<string[]>([])
  const [docIds, setDocIds] = useState<string[]>(defaultDocumentId ? [defaultDocumentId] : [])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const reasonList = useQuery({
    queryKey: ['po-issue-reasons'],
    queryFn: () => dealsApi.poIssueReasons(),
    staleTime: Infinity,
  })

  const report = useMutation({
    mutationFn: () =>
      dealsApi.createPoIssue({ opportunity: opportunityId, reasons, attachment_ids: docIds, note: note.trim() }),
    onSuccess: (issue) => {
      const who = ownerName ? `Admin, Management and ${ownerName}` : 'Admin and Management'
      notify.success(`Issue reported. ${who} will be emailed.`)
      onReported(issue)
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not report the issue.')
      setConfirmOpen(false)
      setError(message)
      notify.error(message)
    },
  })

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const labels = (reasonList.data ?? []).filter((item) => reasons.includes(item.code)).map((item) => item.label)
  const docNames = documents.filter((doc) => docIds.includes(doc.id)).map((doc) => doc.file_name)

  const review = () => {
    if (reasons.length === 0) {
      setError('Pick at least one reason.')
      return
    }
    if (reasons.includes('OTHER') && !note.trim()) {
      setError('Add a note explaining the issue.')
      return
    }
    setError('')
    setConfirmOpen(true)
  }

  return (
    <>
      <Modal
        open
        stacked
        title={`Report document issue · ${prospectNumber}`}
        onClose={() => !report.isPending && onClose()}
        footer={
          <>
            <button type="button" className={btnSecondaryClass} disabled={report.isPending} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={btnPrimaryClass} disabled={report.isPending} onClick={review}>
              Review issue
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Tell the team what is wrong with the Win documents. Admin, Management and the opportunity owner are
            emailed right away, and the owner can upload corrected files from Pulse.
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div>
            <p className={labelClass}>What is wrong?*</p>
            {reasonList.isLoading ? (
              <p className="text-xs text-muted">Loading reasons…</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-1.5">
                {(reasonList.data ?? []).map((item) => (
                  <label
                    key={item.code}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink cursor-pointer hover:border-brand"
                  >
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={reasons.includes(item.code)}
                      onChange={() => setReasons((prev) => toggle(prev, item.code))}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {documents.length > 0 ? (
            <div>
              <p className={labelClass}>Which documents?</p>
              <ul className="space-y-1.5">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink cursor-pointer hover:border-brand">
                      <input
                        type="checkbox"
                        className="accent-brand"
                        checked={docIds.includes(doc.id)}
                        onChange={() => setDocIds((prev) => toggle(prev, doc.id))}
                      />
                      <span className="truncate">{doc.file_name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <label className={labelClass}>Note{reasons.includes('OTHER') ? '*' : ''}</label>
            <textarea
              className={`${fieldClass} min-h-20`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. The attached file is last year's PO; please upload the signed FY26 PO."
            />
          </div>
        </div>
      </Modal>

      <ConfirmActionModal
        open={confirmOpen}
        title="Send issue report?"
        message={`This emails Admin, Management${ownerName ? ` and ${ownerName}` : ''} about ${prospectNumber}.`}
        details={[
          { label: 'Reasons', value: labels.join(', ') || '—' },
          { label: 'Documents', value: docNames.join(', ') || 'Not specified' },
          ...(note.trim() ? [{ label: 'Note', value: note.trim() }] : []),
        ]}
        confirmLabel="Yes, report issue"
        pendingLabel="Reporting…"
        pending={report.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => report.mutate()}
      />
    </>
  )
}
