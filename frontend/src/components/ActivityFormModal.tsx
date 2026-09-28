import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dealsApi } from '../api/deals'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import type { DealActivityType } from '../types'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from './Modal'

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
      notify.success('Activity added.')
      await queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      await queryClient.invalidateQueries({ queryKey: ['deal-activities', dealId] })
      reset()
      onClose()
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not add activity.')
      setError(message)
      notify.error(message)
    },
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
    <Modal
      open={open}
      title="Add Activity"
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} className={btnSecondaryClass}>Cancel</button>
          <button type="submit" form="activity-form" disabled={mutation.isPending} className={btnPrimaryClass}>
            {mutation.isPending ? 'Saving...' : 'Save Activity'}
          </button>
        </>
      }
    >
      <form id="activity-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div>
          <label htmlFor="activity-type" className={labelClass}>Type</label>
          <select
            id="activity-type"
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
          <label htmlFor="activity-subject" className={labelClass}>Subject</label>
          <input
            id="activity-subject"
            className={fieldClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="activity-description" className={labelClass}>Description</label>
          <textarea
            id="activity-description"
            className={`${fieldClass} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="activity-date" className={labelClass}>Activity date</label>
          <input
            id="activity-date"
            type="date"
            className={fieldClass}
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            required
          />
        </div>
      </form>
    </Modal>
  )
}
