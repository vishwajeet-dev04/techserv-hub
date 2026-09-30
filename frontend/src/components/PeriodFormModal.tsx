import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import type { PeriodType } from '../types'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from './Modal'

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
      notify.success('Period created.')
      await queryClient.invalidateQueries({ queryKey: ['financial-periods'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      reset()
      onClose()
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not create period.')
      setError(message)
      notify.error(message)
    },
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
    <Modal
      open={open}
      title="Add Period"
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} className={btnSecondaryClass}>Cancel</button>
          <button type="submit" form="period-form" disabled={mutation.isPending} className={btnPrimaryClass}>
            {mutation.isPending ? 'Saving...' : 'Save Period'}
          </button>
        </>
      }
    >
      <form id="period-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
            <p className="text-sm text-danger">{error}</p>
          </div>
        ) : null}

        <div>
          <label htmlFor="period-type" className={labelClass}>Period type</label>
          <select id="period-type" className={fieldClass} value={periodType} onChange={(e) => setPeriodType(e.target.value as PeriodType)}>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUAL">Annual</option>
          </select>
        </div>

        <div>
          <label htmlFor="period-label" className={labelClass}>Label</label>
          <input id="period-label" className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Aug 2026" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="period-start" className={labelClass}>Start date</label>
            <input id="period-start" type="date" className={fieldClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="period-end" className={labelClass}>End date</label>
            <input id="period-end" type="date" className={fieldClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
        </div>
      </form>
    </Modal>
  )
}
