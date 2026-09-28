import type { ReactNode } from 'react'

export default function PulseToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 bg-surface/80 backdrop-blur-md border border-line rounded-2xl px-4 py-3.5 shadow-sm">
      <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:flex-wrap">{children}</div>
    </div>
  )
}
