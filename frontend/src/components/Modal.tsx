import { useEffect, type ReactNode } from 'react'

export const fieldClass =
  'w-full bg-white border border-[#e5e5ea] rounded-xl px-3 py-2 text-sm text-[#1a1a1a] placeholder:text-[#aeaeb2] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors'

export const labelClass =
  'block text-xs font-medium text-[#3a3a3c] uppercase tracking-wider mb-1.5'

export const btnPrimaryClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white bg-violet-600 hover:bg-violet-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform'

export const btnSecondaryClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-[#6e6e73] bg-white border border-[#e5e5ea] hover:text-[#1a1a1a] hover:border-[#d1d1d6] active:scale-95 transition-transform'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ open, title, onClose, children, footer }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        title="Close dialog"
        aria-label="Close dialog"
        className="modal-backdrop absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="modal-panel relative bg-white rounded-2xl shadow-xl border border-[#e5e5ea] max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#f5f5f7] flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#1a1a1a]">{title}</h3>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#f5f5f7] flex items-center justify-center text-[#aeaeb2] hover:text-[#6e6e73] transition-colors"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        {footer ? (
          <div className="px-6 py-4 border-t border-[#f5f5f7] flex items-center justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
