import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, X } from 'lucide-react'

export interface DetailDrawerAction {
  label: string
  to: string
}

/** Right-hand panel on desktop, bottom sheet on mobile. */
export default function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  action,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  action?: DetailDrawerAction | null
  children: ReactNode
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60]">
          <motion.button
            type="button"
            aria-label="Close details"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:h-full sm:max-h-none sm:w-[28rem] sm:rounded-none sm:rounded-l-2xl bg-surface border-t sm:border-t-0 sm:border-l border-line shadow-2xl flex flex-col"
            initial={{ opacity: 0, y: 24, x: 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'tween', duration: 0.2 }}
          >
            <div className="sm:hidden flex justify-center pt-2.5" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>
            <div className="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-5 pb-4 border-b border-line">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold text-ink">
                  {title}
                </h2>
                {subtitle ? <p className="text-xs text-muted mt-0.5">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-10 h-10 sm:w-8 sm:h-8 -mr-1 rounded-lg text-muted hover:text-ink hover:bg-canvas flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
            {action ? (
              <div className="px-5 py-4 border-t border-line pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Link
                  to={action.to}
                  onClick={onClose}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold px-4 py-3 sm:py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  {action.label}
                  <ArrowRight className="w-4 h-4" strokeWidth={2} aria-hidden />
                </Link>
              </div>
            ) : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function DrawerStat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' | 'warning' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink'
  return (
    <div className="rounded-xl border border-line bg-canvas/60 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

export function DrawerGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

export function DrawerNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted leading-relaxed">{children}</p>
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">{title}</h3>
      {children}
    </section>
  )
}

export function DrawerRows({
  rows,
  empty = 'Nothing to show for this range.',
}: {
  rows: { key: string; label: ReactNode; value: ReactNode; hint?: ReactNode }[]
  empty?: string
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-line rounded-xl border border-line overflow-hidden">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface">
          <div className="min-w-0">
            <p className="text-sm text-ink truncate">{row.label}</p>
            {row.hint ? <p className="text-[11px] text-subtle">{row.hint}</p> : null}
          </div>
          <p className="text-sm font-medium text-ink tabular-nums shrink-0">{row.value}</p>
        </li>
      ))}
    </ul>
  )
}
