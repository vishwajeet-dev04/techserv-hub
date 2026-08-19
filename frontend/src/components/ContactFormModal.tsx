import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api/companies'
import { getErrorMessage } from '../api/errors'
import Modal, { fieldClass, labelClass } from './Modal'

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

interface ContactFormModalProps {
  open: boolean
  companyId: string
  onClose: () => void
}

export default function ContactFormModal({ open, companyId, onClose }: ContactFormModalProps) {
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [designation, setDesignation] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setFirstName('')
    setLastName('')
    setDesignation('')
    setEmail('')
    setPhone('')
    setLinkedinUrl('')
    setNotes('')
    setError('')
  }

  const mutation = useMutation({
    mutationFn: () =>
      companiesApi.createContact(companyId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        designation: designation.trim(),
        email: email.trim(),
        phone: phone.trim(),
        linkedin_url: normalizeUrl(linkedinUrl),
        notes: notes.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company', companyId] })
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      reset()
      onClose()
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not create contact.')),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.')
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
    <Modal open={open} title="Add Contact" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First name</label>
            <input className={fieldClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Last name</label>
            <input className={fieldClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className={labelClass}>Designation</label>
          <input className={fieldClass} value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="CTO, Procurement..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelClass}>LinkedIn</label>
          <input className={fieldClass} value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/..." />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={`${fieldClass} min-h-[80px] resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            {mutation.isPending ? 'Saving...' : 'Save Contact'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
