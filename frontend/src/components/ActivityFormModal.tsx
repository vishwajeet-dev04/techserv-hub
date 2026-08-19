import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dealsApi } from '../api/deals'
import { getErrorMessage } from '../api/errors'
import type { DealActivityType } from '../types'
import Modal, { fieldClass, labelClass } from './Modal'

const ACTIVITY_TYPES: { value: DealActivityType; label: string }[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'CALL', label: 'Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'FOLLOW_UP', label: 'Follow up' },
]

function todayISODate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

interface ActivityFormModalProps {
  open: boolean
  dealId: string
  onClose: () => void
}

export default function ActivityFormModal({ open, dealId, onClose }: ActivityFormModalProps) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<DealActivityType>('NOTE')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [activityDate, setActivityDate] = useState(todayISODate)
  const [error, setError] = useState('')

  const reset = () => {
    setType('NOTE')
    setSubject('')
    setDescription('')
    setActivityDate(todayISODate())
    setError('')
  }

  const mutation = useMutation({
    mutationFn: () =>
      dealsApi.createActivity(dealId, {
        type,
        subject: subject.trim(),
        description: description.trim(),
        activity_date: activityDate,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      await queryClient.invalidateQueries({ queryKey: ['deal-activities', dealId] })
      reset()
      onClose()
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not add activity.')),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!subject.trim()) {
      setError('Subject is required.')
      return
    }
    if (!activityDate) {
      setError('Activity date is required.')
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
    <Modal open={open} title="Add Activity" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>Type</label>
          <select
            className={fieldClass}
            value={type}
            onChange={(e) => setType(e.target.value as DealActivityType)}
          >
            {ACTIVITY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Subject</label>
          <input
            className={fieldClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={`${fieldClass} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Activity date</label>
          <input
            type="date"
            className={fieldClass}
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            required
          />
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
            {mutation.isPending ? 'Saving...' : 'Save Activity'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
