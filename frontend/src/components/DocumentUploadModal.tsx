import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import type { DocumentType, FinancialPeriod } from '../types'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from './Modal'

interface DocumentUploadModalProps {
  open: boolean
  onClose: () => void
  periods: FinancialPeriod[]
  selectedPeriodId: string
}

export default function DocumentUploadModal({
  open,
  onClose,
  periods,
  selectedPeriodId,
}: DocumentUploadModalProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<DocumentType>('PROFIT_LOSS')
  const [periodId, setPeriodId] = useState(selectedPeriodId)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setPeriodId(selectedPeriodId)
  }, [open, selectedPeriodId])

  const reset = () => {
    setFile(null)
    setDocumentType('PROFIT_LOSS')
    setPeriodId(selectedPeriodId)
    setError('')
  }

  const mutation = useMutation({
    mutationFn: () => {
      const formData = new FormData()
      if (!file) throw new Error('Select a file to upload.')
      formData.append('file', file)
      formData.append('document_type', documentType)
      if (periodId) formData.append('financial_period', periodId)
      return financeApi.uploadDocument(formData)
    },
    onSuccess: async () => {
      notify.success('Document uploaded.')
      await queryClient.invalidateQueries({ queryKey: ['financial-documents'] })
      reset()
      onClose()
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not upload document.')
      setError(message)
      notify.error(message)
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!file) {
      setError('Select a file to upload.')
      return
    }
    mutation.mutate()
  }

  const handleClose = () => {
    if (!mutation.isPending) {
      reset()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      title="Upload Document"
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} className={btnSecondaryClass}>Cancel</button>
          <button type="submit" form="document-form" disabled={mutation.isPending} className={btnPrimaryClass}>
            {mutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </>
      }
    >
      <form id="document-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div>
          <label htmlFor="document-file" className={labelClass}>File</label>
          <input
            id="document-file"
            type="file"
            className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:text-white`}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? <p className="text-xs text-[#6e6e73] mt-1.5">{file.name}</p> : null}
        </div>

        <div>
          <label htmlFor="document-type" className={labelClass}>Document type</label>
          <select
            id="document-type"
            className={fieldClass}
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          >
            <option value="PROFIT_LOSS">Profit & Loss</option>
            <option value="BALANCE_SHEET">Balance Sheet</option>
            <option value="CASH_FLOW">Cash Flow Statement</option>
            <option value="BANK_STATEMENT">Bank Statement</option>
            <option value="MANAGEMENT_REPORT">Management Report</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="document-period" className={labelClass}>Financial period</label>
          <select id="document-period" className={fieldClass} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">None</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  )
}
