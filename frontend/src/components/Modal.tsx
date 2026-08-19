import { useEffect, type ReactNode } from 'react'

export const fieldClass =
  'w-full px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-xl text-sm text-[#1a1a1a] placeholder-[#aeaeb2] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors'

export const labelClass =
  'block text-[11px] font-medium text-[#3a3a3c] uppercase tracking-widest mb-1.5'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[#1a1a1a]/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-[#e5e5ea] rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[#1a1a1a]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#aeaeb2] hover:text-[#1a1a1a] hover:bg-[#f5f5f7] transition-colors"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
