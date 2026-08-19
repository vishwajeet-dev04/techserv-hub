import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
import type { PeriodType } from '../types'
import Modal, { fieldClass, labelClass } from './Modal'

interface PeriodFormModalProps {
  open: boolean
  onClose: () => void
}

export default function PeriodFormModal({ open, onClose }: PeriodFormModalProps) {
  const queryClient = useQueryClient()
  const [periodType, setPeriodType] = useState<PeriodType>('MONTHLY')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setPeriodType('MONTHLY')
    setStartDate('')
    setEndDate('')
    setLabel('')
    setError('')
  }

  const mutation = useMutation({
    mutationFn: () =>
      financeApi.createPeriod({
        period_type: periodType,
        start_date: startDate,
        end_date: endDate,
        label: label.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['financial-periods'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      reset()
      onClose()
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not create period.')),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!label.trim() || !startDate || !endDate) {
      setError('Label, start date, and end date are required.')
      return
    }
    if (startDate > endDate) {
      setError('Start date must be before end date.')
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
    <Modal open={open} title="Add Period" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>Period type</label>
          <select className={fieldClass} value={periodType} onChange={(e) => setPeriodType(e.target.value as PeriodType)}>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUAL">Annual</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Label</label>
          <input className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Aug 2026" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start date</label>
            <input type="date" className={fieldClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>End date</label>
            <input type="date" className={fieldClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
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
            {mutation.isPending ? 'Saving...' : 'Save Period'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
