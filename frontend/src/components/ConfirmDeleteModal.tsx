import Modal, { btnPrimaryClass, btnSecondaryClass } from './Modal'

interface Props {
  open: boolean
  title?: string
  message: string
  details?: { label: string; value: string }[]
  pending?: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmDeleteModal({
  open,
  title = 'Delete',
  message,
  details,
  pending,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => !pending && onCancel()}
      stacked
      footer={
        <>
          <button type="button" className={btnSecondaryClass} disabled={pending} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`${btnPrimaryClass} bg-danger hover:bg-red-700`}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </button>
        </>
      }
    >
      {details && details.length > 0 ? (
        <dl className="space-y-2 text-sm">
          {details.map((item) => (
            <div key={item.label}>
              <dt className="text-xs uppercase tracking-wider text-subtle">{item.label}</dt>
              <dd className="text-ink font-medium mt-0.5">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="text-sm text-muted">{message}</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </Modal>
  )
}
