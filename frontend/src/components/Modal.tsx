import { useEffect, type ReactNode } from 'react'

export const fieldClass =
  'w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-2 focus-visible:ring-2 focus-visible:ring-brand transition-colors'

export const labelClass =
  'block text-xs font-medium text-muted uppercase tracking-wider mb-1.5'

export const btnPrimaryClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white bg-brand hover:bg-brand-hover shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'

export const btnSecondaryClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-muted bg-surface border border-line hover:text-ink hover:border-subtle disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'

export const btnRowEditClass =
  'inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-lg border border-line text-brand bg-surface hover:bg-brand-soft hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'

export const btnRowDeleteClass =
  'inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-lg border border-line text-danger bg-surface hover:bg-red-50 hover:border-danger disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  stacked?: boolean
}

export default function Modal({ open, title, onClose, children, footer, wide, stacked }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={`fixed inset-0 flex items-center justify-center ${stacked ? 'z-[60]' : 'z-50'}`}>
      <button
        type="button"
        title="Close dialog"
        aria-label="Close dialog"
        className="modal-backdrop absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        className={`modal-panel relative bg-surface/90 backdrop-blur-md rounded-2xl border border-line w-full mx-4 max-h-[90vh] overflow-y-auto ${
          wide ? 'max-w-7xl' : 'max-w-md'
        }`}
      >
        <div className="px-6 py-4 border-b border-canvas flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-canvas flex items-center justify-center text-subtle hover:text-muted"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        {footer ? (
          <div className="px-6 py-4 border-t border-canvas flex items-center justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
