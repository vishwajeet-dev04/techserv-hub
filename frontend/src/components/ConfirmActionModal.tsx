import Modal, { btnPrimaryClass, btnSecondaryClass } from './Modal'

interface Props {
  open: boolean
  title: string
  message: string
  details?: { label: string; value: string }[]
  confirmLabel?: string
  pendingLabel?: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmActionModal({
  open,
  title,
  message,
  details,
  confirmLabel = 'Confirm',
  pendingLabel = 'Saving…',
  pending,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => !pending && onCancel()}
      topmost
      footer={
        <>
          <button type="button" className={btnSecondaryClass} disabled={pending} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" disabled={pending} onClick={onConfirm} className={btnPrimaryClass}>
            {pending ? pendingLabel : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink">{message}</p>
      {details && details.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm rounded-xl border border-line bg-canvas px-3 py-2.5">
          {details.map((item) => (
            <div key={item.label} className="contents">
              <dt className="text-xs uppercase tracking-wider text-subtle self-center">{item.label}</dt>
              <dd className="text-ink font-medium break-words">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Modal>
  )
}
