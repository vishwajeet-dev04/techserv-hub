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
  'inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-lg border border-line text-danger bg-surface hover:bg-danger-soft hover:border-danger disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  stacked?: boolean
  topmost?: boolean
}

export default function Modal({ open, title, onClose, children, footer, wide, stacked, topmost }: ModalProps) {
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
    <div
      className={`fixed inset-0 flex items-end sm:items-center justify-center ${topmost ? 'z-[70]' : stacked ? 'z-[60]' : 'z-50'}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        title="Close dialog"
        aria-label="Close dialog"
        className="modal-backdrop absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Bottom sheet on phones, centred dialog from sm up. Footer stays pinned while the body scrolls. */}
      <div
        className={`modal-panel relative flex flex-col bg-surface/95 backdrop-blur-md border border-line w-full rounded-t-2xl sm:rounded-2xl sm:mx-4 max-h-[94dvh] sm:max-h-[90vh] shadow-xl ${
          wide ? 'sm:max-w-7xl' : 'sm:max-w-md'
        }`}
      >
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-line flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-base font-semibold text-ink truncate">{title}</h3>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
            className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg hover:bg-canvas flex items-center justify-center text-subtle hover:text-muted text-lg shrink-0"
          >
            ×
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto min-h-0 flex-1">{children}</div>
        {footer ? (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-line flex flex-wrap items-center justify-end gap-2 sm:gap-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
