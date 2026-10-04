import { Link } from 'react-router-dom'
import Modal, { btnPrimaryClass, btnSecondaryClass } from './Modal'
import { downloadIssuesCsv } from '../lib/importIssues'
import { useAuth } from '../hooks/useAuth'
import type { ImportIssue } from '../types'

export interface ImportSummary {
  title: string
  fileName?: string
  created: number
  updated?: number
  contactsCreated?: number
  errors: ImportIssue[]
  warnings?: ImportIssue[]
  unmatchedAssignees?: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  summary: ImportSummary | null
  stacked?: boolean
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warn' }) {
  const color = tone === 'danger' && value ? 'text-danger' : tone === 'warn' && value ? 'text-amber-600 dark:text-amber-400' : 'text-ink'
  return (
    <div className="rounded-xl border border-line bg-canvas/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  )
}

export function IssueTable({ title, issues, tone }: { title: string; issues: ImportIssue[]; tone: 'danger' | 'warn' }) {
  if (!issues.length) return null
  const showSheet = issues.some((issue) => issue.sheet)
  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold uppercase tracking-wider ${tone === 'danger' ? 'text-danger' : 'text-amber-600 dark:text-amber-400'}`}>
        {title} ({issues.length})
      </p>
      <div className="max-h-64 overflow-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-canvas">
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-widest text-subtle">
              {showSheet ? <th className="px-3 py-2 font-semibold">Sheet</th> : null}
              <th className="px-3 py-2 font-semibold">Row</th>
              <th className="px-3 py-2 font-semibold">Message</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr key={`${issue.sheet ?? ''}-${issue.row}-${index}`} className="border-b border-canvas last:border-0 align-top">
                {showSheet ? <td className="px-3 py-1.5 text-muted whitespace-nowrap">{issue.sheet}</td> : null}
                <td className="px-3 py-1.5 text-muted tabular-nums">{issue.row}</td>
                <td className="px-3 py-1.5 text-ink">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ImportResultModal({ open, onClose, summary, stacked }: Props) {
  const { isAdmin } = useAuth()
  if (!summary) return null
  const warnings = summary.warnings ?? []
  const unmatched = summary.unmatchedAssignees ?? []
  const hasIssues = summary.errors.length > 0 || warnings.length > 0

  const downloadCsv = () => downloadIssuesCsv(summary.fileName ?? 'import', summary.errors, warnings)

  return (
    <Modal
      open={open}
      title={summary.title}
      onClose={onClose}
      wide={hasIssues}
      stacked={stacked}
      footer={
        <>
          {hasIssues ? (
            <button type="button" onClick={downloadCsv} className={btnSecondaryClass}>
              Download errors (CSV)
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={btnPrimaryClass}>Done</button>
        </>
      }
    >
      {summary.fileName ? <p className="text-xs text-muted">File: {summary.fileName}</p> : null}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Created" value={summary.created} />
        <Stat label="Updated" value={summary.updated ?? 0} />
        {summary.contactsCreated !== undefined ? <Stat label="New contacts" value={summary.contactsCreated} /> : null}
        <Stat label="Failed rows" value={summary.errors.length} tone="danger" />
        <Stat label="Warnings" value={warnings.length} tone="warn" />
      </div>

      {unmatched.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            {unmatched.length} "Assigned To" name{unmatched.length === 1 ? '' : 's'} did not match a user
          </p>
          <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300/90">
            Those rows were imported as unassigned. Create a user with the same name and the rows link to them automatically.
          </p>
          <p className="mt-2 text-xs text-ink">{unmatched.join(', ')}</p>
          {isAdmin ? (
            <Link to="/settings/users" onClick={onClose} className="mt-2 inline-block text-xs font-medium text-brand hover:underline">
              Open Settings → Users
            </Link>
          ) : null}
        </div>
      ) : null}

      {!hasIssues ? <p className="text-sm text-muted">Every row imported cleanly.</p> : null}
      <IssueTable title="Errors (rows not imported)" issues={summary.errors} tone="danger" />
      <IssueTable title="Warnings" issues={warnings} tone="warn" />
    </Modal>
  )
}
