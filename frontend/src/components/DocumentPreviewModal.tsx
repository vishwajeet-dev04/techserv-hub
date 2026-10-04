import { useEffect, useState, type ReactNode } from 'react'
import { FileText } from 'lucide-react'
import Modal, { btnSecondaryClass } from './Modal'
import { pulseApi } from '../api/pulse'

export interface PreviewableFile {
  id: string
  file_name: string
  url: string | null
  content_type?: string
  byte_size?: number
}

interface DocumentPreviewModalProps {
  open: boolean
  onClose: () => void
  file: PreviewableFile | null
}

interface DocumentPreviewBodyProps {
  file: PreviewableFile | null
  /** Compact layout for side panes (shorter media height). */
  compact?: boolean
  className?: string
  emptyMessage?: string
}

type PreviewData = { kind: 'table'; rows: string[][] } | { kind: 'text'; text: string }
type FileKind = 'image' | 'pdf' | 'csv' | 'xlsx' | 'docx' | 'other'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : ''
}

function resolveKind(file: PreviewableFile): FileKind {
  const ext = extensionOf(file.file_name)
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'docx') return 'docx'
  if (ext === 'pdf' || file.content_type === 'application/pdf') return 'pdf'
  if (IMAGE_EXTENSIONS.includes(ext) || file.content_type?.startsWith('image/')) return 'image'
  return 'other'
}

function formatBytes(size?: number): string {
  if (!size || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function FallbackMessage({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-center ${compact ? 'py-10 px-3' : 'py-16'}`}>
      <FileText className={compact ? 'w-8 h-8 text-subtle' : 'w-10 h-10 text-subtle'} />
      <p className="text-sm text-muted">{text}</p>
      {!compact ? <p className="text-xs text-subtle">Use Download below to open it.</p> : null}
    </div>
  )
}

export function DocumentPreviewBody({
  file,
  compact = false,
  className = '',
  emptyMessage = 'Select a document to preview.',
}: DocumentPreviewBodyProps) {
  const [loadFailed, setLoadFailed] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  useEffect(() => {
    setLoadFailed(false)
    setPreviewData(null)
    setPreviewError(false)
    setPreviewLoading(false)
    if (!file?.url) return
    const kind = resolveKind(file)
    if (kind !== 'csv' && kind !== 'xlsx' && kind !== 'docx') return

    let cancelled = false
    setPreviewLoading(true)
    ;(async () => {
      try {
        const data = await pulseApi.previewAttachment(file.id)
        if (cancelled) return
        setPreviewData(data)
      } catch {
        if (!cancelled) setPreviewError(true)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [file?.id, file?.url])

  if (!file) {
    return (
      <div className={className}>
        <FallbackMessage text={emptyMessage} compact={compact} />
      </div>
    )
  }

  const kind = resolveKind(file)
  const showImage = Boolean(file.url) && kind === 'image' && !loadFailed
  const showPdf = Boolean(file.url) && kind === 'pdf' && !loadFailed
  const showFetchedPreview = Boolean(file.url) && (kind === 'csv' || kind === 'xlsx' || kind === 'docx')
  const mediaH = compact ? 'h-[min(68vh,620px)]' : 'h-[75vh]'
  const scrollH = compact ? 'max-h-[min(68vh,620px)]' : 'max-h-[70vh]'
  const imgH = compact ? 'max-h-[min(68vh,620px)]' : 'max-h-[70vh]'
  const pdfSrc = file.url ? `${file.url.split('#')[0]}#zoom=page-width` : undefined

  let content: ReactNode
  if (!file.url) {
    content = <FallbackMessage text="This file is no longer available." compact={compact} />
  } else if (showImage) {
    content = (
      <img
        src={file.url}
        alt={file.file_name}
        className={`${imgH} w-full object-contain rounded-xl bg-canvas`}
        onError={() => setLoadFailed(true)}
      />
    )
  } else if (showPdf) {
    content = (
      <iframe
        src={pdfSrc}
        title={file.file_name}
        className={`w-full ${mediaH} rounded-xl border border-line bg-surface`}
        onError={() => setLoadFailed(true)}
      />
    )
  } else if (showFetchedPreview) {
    if (previewLoading) {
      content = <div className="flex items-center justify-center py-16 text-sm text-muted">Loading preview…</div>
    } else if (previewError || !previewData) {
      content = <FallbackMessage text="Couldn't load a preview for this file." compact={compact} />
    } else if (previewData.kind === 'table') {
      content = (
        <div className={`${scrollH} overflow-auto rounded-xl border border-line bg-surface`}>
          <table className="w-full text-xs border-collapse">
            <tbody>
              {previewData.rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? 'bg-canvas font-medium sticky top-0' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-line px-2 py-1 whitespace-nowrap text-ink">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    } else {
      content = (
        <pre className={`${scrollH} overflow-auto rounded-xl border border-line bg-canvas p-4 text-xs text-ink whitespace-pre-wrap`}>
          {previewData.text || 'This document has no readable text.'}
        </pre>
      )
    }
  } else {
    content = <FallbackMessage text="Preview isn't available for this file type." compact={compact} />
  }

  return <div className={className}>{content}</div>
}

export default function DocumentPreviewModal({ open, onClose, file }: DocumentPreviewModalProps) {
  if (!file) return null

  const sizeLabel = formatBytes(file.byte_size)

  return (
    <Modal
      open={open}
      title={file.file_name}
      onClose={onClose}
      stacked
      wide
      footer={
        <>
          <span className="text-xs text-muted mr-auto truncate">
            {file.file_name}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </span>
          {file.url ? (
            <a
              href={file.url}
              download={file.file_name}
              target="_blank"
              rel="noreferrer"
              className={btnSecondaryClass}
            >
              Download
            </a>
          ) : null}
        </>
      }
    >
      <DocumentPreviewBody file={file} />
    </Modal>
  )
}
