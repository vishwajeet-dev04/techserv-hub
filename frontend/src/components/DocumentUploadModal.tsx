import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
import type { DocumentType, FinancialPeriod } from '../types'
import Modal, { fieldClass, labelClass } from './Modal'

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
      await queryClient.invalidateQueries({ queryKey: ['financial-documents'] })
      reset()
      onClose()
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not upload document.')),
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
    <Modal open={open} title="Upload Document" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>File</label>
          <input
            type="file"
            className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:text-white`}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? <p className="text-xs text-[#6e6e73] mt-1.5">{file.name}</p> : null}
        </div>

        <div>
          <label className={labelClass}>Document type</label>
          <select
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
          <label className={labelClass}>Financial period</label>
          <select className={fieldClass} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">None</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm text-[#6e6e73] bg-white border border-[#e5e5ea] hover:text-[#1a1a1a] hover:border-[#d1d1d6]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 shadow-sm disabled:opacity-50"
          >
            {mutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
