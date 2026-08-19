import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api/companies'
import { getErrorMessage } from '../api/errors'
import type { CompanyStatus } from '../types'
import Modal, { fieldClass, labelClass } from './Modal'

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
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      reset()
      onClose()
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not create company.')),
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
    <Modal open={open} title="Add Company" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>Company name</label>
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Type</label>
            <input className={fieldClass} value={companyType} onChange={(e) => setCompanyType(e.target.value)} placeholder="Private, LLP..." />
          </div>
          <div>
            <label className={labelClass}>Industry</label>
            <input className={fieldClass} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="IT, Manufacturing..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Website</label>
            <input className={fieldClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="company.com" />
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <input className={fieldClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chennai" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as CompanyStatus)}>
            <option value="PROSPECT">Prospect</option>
            <option value="CUSTOMER">Customer</option>
            <option value="PARTNER">Partner</option>
            <option value="INACTIVE">Inactive</option>
          </select>
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
            {mutation.isPending ? 'Saving...' : 'Save Company'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
