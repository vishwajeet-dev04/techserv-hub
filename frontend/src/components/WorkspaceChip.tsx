import { Link } from 'react-router-dom'
import { Building2, ChevronDown } from 'lucide-react'
import { useWorkspace, workspaceLabel } from '../lib/workspaces'

/** `className` must include the display utility (e.g. `inline-flex` or `hidden sm:inline-flex`). */
export default function WorkspaceChip({ className = 'inline-flex' }: { className?: string }) {
  const label = workspaceLabel(useWorkspace())
  if (!label) return null
  return (
    <Link
      to="/select-company"
      title="Switch company or region"
      className={`items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-brand/40 hover:text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand min-w-0 ${className}`}
    >
      <Building2 className="w-3.5 h-3.5 text-brand shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate">{label}</span>
      <ChevronDown className="w-3 h-3 text-subtle shrink-0 ml-auto" strokeWidth={2} aria-hidden />
    </Link>
  )
}
