import type { ReactNode } from 'react'

export default function PulsePageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[1.65rem] font-semibold text-ink tracking-tight">{title}</h1>
        <p className="text-sm text-muted mt-1.5">{subtitle}</p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">{actions}</div>
      ) : null}
    </div>
  )
}
