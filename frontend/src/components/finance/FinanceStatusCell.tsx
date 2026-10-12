import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Pencil } from 'lucide-react'
import { financeApi } from '../../api/finance'
import { getErrorMessage } from '../../api/errors'
import { useAuth } from '../../hooks/useAuth'
import { invalidateFinanceQueries } from '../../lib/financeQueries'
import { statusLabel } from '../../lib/financeStatus'
import { notify } from '../../lib/notify'
import type { FinanceStatusChange, PayableStatus, ReceivableStatus } from '../../types'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from '../Modal'
import { StatusBadge } from './FinancePageShell'

type Kind = 'invoice' | 'payable'

const OPTIONS: Record<Kind, string[]> = {
  invoice: ['DUE', 'OVERDUE', 'RECEIVED'],
  payable: ['DUE', 'OVERDUE', 'PAID'],
}

interface StatusRow {
  id: string
  status: string
  status_manual?: boolean
}

const historyKey = (kind: Kind, id: string) => ['finance-status-history', kind, id]

/** Status badge (editable for Finance/Admin) plus a History button everyone can use. */
export function FinanceStatusCell({ kind, row, title }: { kind: Kind; row: StatusRow; title: string }) {
  const { isAdmin, isFinance } = useAuth()
  const canEdit = isAdmin || isFinance
  const [dialog, setDialog] = useState<'change' | 'history' | null>(null)
  const close = () => setDialog(null)
  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap">
      {canEdit ? (
        <button
          type="button"
          onClick={() => setDialog('change')}
          className="group inline-flex items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          title="Change status"
        >
          <StatusBadge status={row.status} />
          <Pencil className="w-3 h-3 text-subtle group-hover:text-ink" aria-hidden />
        </button>
      ) : (
        <StatusBadge status={row.status} />
      )}
      <button
        type="button"
        onClick={() => setDialog('history')}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-line text-[11px] font-medium text-muted hover:text-ink hover:border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        title="View status history"
      >
        <History className="w-3 h-3" aria-hidden />
        History
      </button>
      {dialog === 'change' ? <FinanceStatusDialog kind={kind} row={row} title={title} onClose={close} /> : null}
      {dialog === 'history' ? <FinanceStatusHistoryDialog kind={kind} row={row} title={title} onClose={close} /> : null}
    </div>
  )
}

function FinanceStatusDialog({
  kind,
  row,
  title,
  onClose,
}: {
  kind: Kind
  row: StatusRow
  title: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(row.status)
  const [note, setNote] = useState('')
  const save = useMutation({
    mutationFn: (): Promise<unknown> =>
      kind === 'invoice'
        ? financeApi.changeInvoiceStatus(row.id, status as ReceivableStatus, note.trim())
        : financeApi.changePayableStatus(row.id, status as PayableStatus, note.trim()),
    onSuccess: async () => {
      notify.success(`Status set to ${statusLabel(status)}`)
      await Promise.all([
        invalidateFinanceQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: historyKey(kind, row.id) }),
      ])
      onClose()
    },
    onError: (error) => notify.error(getErrorMessage(error, 'Could not change status.')),
  })
  const unchanged = status === row.status && row.status_manual

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondaryClass} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimaryClass}
            disabled={save.isPending || unchanged}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save status'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted">
          Current: <StatusBadge status={row.status} />
          <span className="text-xs text-subtle">
            {row.status_manual ? 'Set manually' : 'Automatic from due date'}
          </span>
        </div>
        <div>
          <label className={labelClass} htmlFor="finance-status">
            New status
          </label>
          <select
            id="finance-status"
            className={fieldClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {OPTIONS[kind].map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="finance-status-note">
            Note (optional)
          </label>
          <textarea
            id="finance-status-note"
            className={fieldClass}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for the change"
          />
        </div>
      </div>
    </Modal>
  )
}

function FinanceStatusHistoryDialog({
  kind,
  row,
  title,
  onClose,
}: {
  kind: Kind
  row: StatusRow
  title: string
  onClose: () => void
}) {
  const history = useQuery({
    queryKey: historyKey(kind, row.id),
    queryFn: () =>
      kind === 'invoice' ? financeApi.invoiceStatusHistory(row.id) : financeApi.payableStatusHistory(row.id),
  })
  const entries = history.data ?? []

  return (
    <Modal
      open
      title={`Status history · ${title}`}
      onClose={onClose}
      footer={
        <button type="button" className={btnSecondaryClass} onClick={onClose}>
          Close
        </button>
      }
    >
      {history.isLoading ? (
        <p className="text-sm text-subtle">Loading…</p>
      ) : history.isError ? (
        <p className="text-sm text-danger">{getErrorMessage(history.error, 'Could not load history.')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-subtle">No manual status changes yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {entries.map((entry: FinanceStatusChange) => (
            <li key={entry.id} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={entry.from_status} />
                <span className="text-subtle">→</span>
                <StatusBadge status={entry.to_status} />
                <span className="ml-auto text-xs text-subtle tabular-nums">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">by {entry.changed_by_name || 'Unknown user'}</p>
              {entry.note ? <p className="mt-0.5 text-xs text-ink">{entry.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
