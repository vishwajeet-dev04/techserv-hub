import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pulseApi } from '../../api/pulse'
import { getErrorMessage } from '../../api/errors'
import Modal, { btnPrimaryClass, btnRowDeleteClass, btnRowEditClass, btnSecondaryClass, fieldClass, labelClass } from '../../components/Modal'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import PulsePageHeader from '../../components/pulse/PulsePageHeader'
import PulseToolbar from '../../components/pulse/PulseToolbar'
import { PulseEmptyState, PulseLoadingRows } from '../../components/pulse/PulseTableShell'
import { validateReminderForm } from '../../lib/pulseValidation'
import { notify } from '../../lib/notify'
import type { PulseReminder, PulseReminderType } from '../../types'

const TYPES: PulseReminderType[] = [
  'FOLLOW_UP',
  'TASK',
  'HIGH_VALUE_ALERT',
  'CLOSE_DATE',
  'STALE_OPPORTUNITY',
]

const typeClass: Record<string, string> = {
  TASK: 'bg-blue-50 text-blue-700',
  FOLLOW_UP: 'bg-sky-50 text-sky-700',
  HIGH_VALUE_ALERT: 'bg-pink-50 text-pink-700',
  CLOSE_DATE: 'bg-red-50 text-red-700',
  STALE_OPPORTUNITY: 'bg-amber-50 text-amber-800',
}

export default function PulseReminders() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [reminderType, setReminderType] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PulseReminder | null>(null)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [title, setTitle] = useState('')
  const [type, setType] = useState<PulseReminderType>('TASK')
  const [due, setDue] = useState('')
  const [description, setDescription] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PulseReminder | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const list = useQuery({
    queryKey: ['pulse-reminders', search, status, reminderType],
    queryFn: () =>
      pulseApi.listReminders({
        search: search || undefined,
        status: status || undefined,
        reminder_type: reminderType || undefined,
      }),
  })

  const payload = () => ({
    title: title.trim(),
    reminder_type: type,
    due_date: due,
    description,
  })

  const save = useMutation({
    mutationFn: () =>
      editing
        ? pulseApi.updateReminder(editing.id, payload())
        : pulseApi.createReminder(payload()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pulse-reminders'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-summary'] })
      closeForm()
      notify.success(editing ? 'Reminder updated.' : 'Reminder created.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, editing ? 'Could not update reminder.' : 'Could not create reminder.')
      setFormError(message)
      notify.error(message)
    },
  })

  const done = useMutation({
    mutationFn: pulseApi.markReminderDone,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse-reminders'] })
      notify.success('Reminder marked done.')
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => pulseApi.deleteReminder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse-reminders'] })
      setPendingDelete(null)
      setDeleteError('')
      notify.success('Reminder deleted.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not delete reminder.')
      setDeleteError(message)
      notify.error(message)
    },
  })

  const closeForm = () => {
    setOpen(false)
    setEditing(null)
    setTitle('')
    setDue('')
    setDescription('')
    setType('TASK')
    setFormError('')
    setFieldErrors({})
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const errors = validateReminderForm(title, due, Boolean(editing))
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError('Fix the highlighted fields.')
      return
    }
    setFieldErrors({})
    if (save.isPending) return
    save.mutate()
  }

  const rows = list.data?.results ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PulsePageHeader
        title="Reminders"
        subtitle="Manage your tasks and follow-ups."
        actions={
          <button type="button" className={btnPrimaryClass} onClick={() => { closeForm(); setOpen(true) }}>
            + Add Reminder
          </button>
        }
      />

      <PulseToolbar>
        <input className={`${fieldClass} md:max-w-xs`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reminders..." />
        <select className={`${fieldClass} md:w-40`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="DONE">Done</option>
        </select>
        <select className={`${fieldClass} md:w-48`} value={reminderType} onChange={(e) => setReminderType(e.target.value)}>
          <option value="">All Types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </PulseToolbar>

      {list.isLoading ? (
        <PulseLoadingRows />
      ) : list.isError ? (
        <p className="mt-6 text-sm text-danger">{getErrorMessage(list.error)}</p>
      ) : rows.length === 0 ? (
        <PulseEmptyState
          message="No reminders yet."
          action={
            <button type="button" className={btnPrimaryClass} onClick={() => { closeForm(); setOpen(true) }}>
              + Add Reminder
            </button>
          }
        />
      ) : (
        <div className="mt-5 bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-line">
            <p className="text-sm font-semibold text-ink">
              Reminders <span className="text-muted font-medium">({rows.length})</span>
            </p>
          </div>
          <div className="p-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className={`bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 shadow-sm ${row.status === 'DONE' ? 'opacity-70' : ''}`}
            >
              <div className="flex justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded ${typeClass[row.reminder_type]}`}>
                    {row.reminder_type.replaceAll('_', ' ')}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${row.status === 'DONE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                    {row.status}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className={btnRowEditClass}
                    onClick={() => {
                      setEditing(row)
                      setTitle(row.title)
                      setType(row.reminder_type)
                      setDue(row.due_date ? row.due_date.slice(0, 10) : '')
                      setDescription(row.description ?? '')
                      setFormError('')
                      setOpen(true)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={btnRowDeleteClass}
                    disabled={remove.isPending}
                    onClick={() => {
                      setDeleteError('')
                      setPendingDelete(row)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <h2 className="font-medium text-ink mt-3">{row.title}</h2>
              <p className="text-sm text-muted mt-1">{row.description || '—'}</p>
              <p className={`text-xs mt-3 rounded-lg px-2 py-1 ${row.status === 'PENDING' && row.due_date ? 'bg-red-50 text-danger' : 'text-muted'}`}>
                {row.due_date ? `Due: ${row.due_date}` : 'No due date'}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {row.opportunity ? (
                  <Link to="/pulse/opportunities" className={`${btnSecondaryClass} text-xs`}>View Deal</Link>
                ) : (
                  <span className={`${btnSecondaryClass} text-xs opacity-50`}>View Deal</span>
                )}
                {row.contact ? (
                  <Link to="/pulse/contacts" className={`${btnSecondaryClass} text-xs`}>View Contact</Link>
                ) : (
                  <span className={`${btnSecondaryClass} text-xs opacity-50`}>View Contact</span>
                )}
                {row.status === 'PENDING' ? (
                  <button
                    type="button"
                    disabled={done.isPending}
                    onClick={() => done.mutate(row.id)}
                    className={`${btnPrimaryClass} text-xs`}
                  >
                    Done
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          </div>
        </div>
      )}

      <Modal
        open={open}
        title={editing ? 'Edit Reminder' : 'Add New Reminder'}
        onClose={() => !save.isPending && closeForm()}
        footer={
          <button type="submit" form="pulse-rem-form" disabled={save.isPending} className={btnPrimaryClass}>
            {save.isPending ? 'Saving…' : editing ? 'Update Reminder' : 'Create Reminder'}
          </button>
        }
      >
        <form id="pulse-rem-form" onSubmit={onSubmit} className="space-y-3">
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <div>
            <label className={labelClass}>Title*</label>
            <input
              className={`${fieldClass}${fieldErrors.title ? ' border-danger' : ''}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow up with client"
              required
              maxLength={255}
            />
            {fieldErrors.title ? <p className="text-xs text-danger mt-1">{fieldErrors.title}</p> : null}
          </div>
          <div>
            <label className={labelClass}>Type*</label>
            <select className={fieldClass} value={type} onChange={(e) => setType(e.target.value as PulseReminderType)} required>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Due Date{editing ? '' : '*'}</label>
            <input
              type="date"
              className={`${fieldClass}${fieldErrors.due_date ? ' border-danger' : ''}`}
              value={due}
              onChange={(e) => setDue(e.target.value)}
              required={!editing}
            />
            {fieldErrors.due_date ? <p className="text-xs text-danger mt-1">{fieldErrors.due_date}</p> : null}
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={`${fieldClass} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        title="Delete reminder"
        message={pendingDelete ? `Delete reminder ${pendingDelete.title}? This cannot be undone.` : ''}
        pending={remove.isPending}
        error={deleteError}
        onCancel={() => {
          if (remove.isPending) return
          setPendingDelete(null)
          setDeleteError('')
        }}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  )
}
