import { downloadBlob } from './download'
import type { ImportIssue } from '../types'

function csvCell(value: string | number | undefined): string {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function issuesToCsv(errors: ImportIssue[], warnings: ImportIssue[] = []): string {
  const rows = [
    ['Type', 'Sheet', 'Row', 'Message'],
    ...errors.map((issue) => ['Error', issue.sheet ?? '', issue.row, issue.message]),
    ...warnings.map((issue) => ['Warning', issue.sheet ?? '', issue.row, issue.message]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadIssuesCsv(fileName: string, errors: ImportIssue[], warnings: ImportIssue[] = []) {
  const csv = issuesToCsv(errors, warnings)
  const base = fileName.replace(/\.xlsx$/i, '') || 'import'
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `${base}-issues.csv`)
}
