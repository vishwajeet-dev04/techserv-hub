import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api/companies'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import type { CompanyStatus } from '../types'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from './Modal'

function normalizeWebsite(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

interface CompanyFormModalProps {
  open: boolean
  onClose: () => void
}

export default function CompanyFormModal({ open, onClose }: CompanyFormModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [companyType, setCompanyType] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<CompanyStatus>('PROSPECT')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setCompanyType('')
    setIndustry('')
    setWebsite('')
    setLocation('')
    setStatus('PROSPECT')
    setNotes('')
    setError('')
  }

  const mutation = useMutation({
    mutationFn: () =>
      companiesApi.create({
        name: name.trim(),
        company_type: companyType.trim(),
        industry: industry.trim(),
        website: normalizeWebsite(website),
        location: location.trim(),
        status,
        notes: notes.trim(),
      }),
    onSuccess: async () => {
      notify.success('Company created.')
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      reset()
      onClose()
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not create company.')
      setError(message)
      notify.error(message)
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Company name is required.')
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
      title="Add Company"
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} className={btnSecondaryClass}>
            Cancel
          </button>
          <button type="submit" form="company-form" disabled={mutation.isPending} className={btnPrimaryClass}>
            {mutation.isPending ? 'Saving...' : 'Save Company'}
          </button>
        </>
      }
    >
      <form id="company-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div>
          <label htmlFor="company-name" className={labelClass}>Company name</label>
          <input id="company-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="company-type" className={labelClass}>Type</label>
            <input id="company-type" className={fieldClass} value={companyType} onChange={(e) => setCompanyType(e.target.value)} placeholder="Private, LLP..." />
          </div>
          <div>
            <label htmlFor="company-industry" className={labelClass}>Industry</label>
            <input id="company-industry" className={fieldClass} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="IT, Manufacturing..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="company-website" className={labelClass}>Website</label>
            <input id="company-website" className={fieldClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="company.com" />
          </div>
          <div>
            <label htmlFor="company-location" className={labelClass}>Location</label>
            <input id="company-location" className={fieldClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chennai" />
          </div>
        </div>

        <div>
          <label htmlFor="company-status" className={labelClass}>Status</label>
          <select id="company-status" className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as CompanyStatus)}>
            <option value="PROSPECT">Prospect</option>
            <option value="CUSTOMER">Customer</option>
            <option value="PARTNER">Partner</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div>
          <label htmlFor="company-notes" className={labelClass}>Notes</label>
          <textarea
            id="company-notes"
            className={`${fieldClass} min-h-[80px] resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
