import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api/companies'
import { dealsApi } from '../api/deals'
import { getErrorMessage } from '../api/errors'
import type { DealStage } from '../types'
import Modal, { fieldClass, labelClass } from './Modal'

interface DealFormModalProps {
  open: boolean
  onClose: () => void
  companyId?: string
}

export default function DealFormModal({ open, onClose, companyId }: DealFormModalProps) {
  const queryClient = useQueryClient()
  const [company, setCompany] = useState(companyId ?? '')
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<DealStage>('LEAD')
  const [closeDate, setCloseDate] = useState('')
  const [source, setSource] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const { data: companiesData } = useQuery({
    queryKey: ['companies', 'deal-form'],
    queryFn: () => companiesApi.list({ page: 1, page_size: 100 }),
    enabled: open && !companyId,
  })

  const companies = companiesData?.results ?? []

  useEffect(() => {
    if (open && companyId) setCompany(companyId)
  }, [open, companyId])

  const reset = () => {
    setCompany(companyId ?? '')
    setName('')
    setValue('')
    setStage('LEAD')
    setCloseDate('')
    setSource('')
    setDescription('')
    setError('')
  }

  const mutation = useMutation({
    mutationFn: () =>
      dealsApi.create({
        company,
        name: name.trim(),
        value: Number(value),
        currency: 'INR',
        stage,
        expected_close_date: closeDate || null,
        source: source.trim(),
        description: description.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      await queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      reset()
      onClose()
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not create deal.')),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!company) {
      setError('Select a company.')
      return
    }
    if (!name.trim()) {
      setError('Deal name is required.')
      return
    }
    if (!value || Number(value) < 0) {
      setError('Enter a valid deal value.')
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
    <Modal open={open} title="Add Deal" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        {companyId ? null : (
          <div>
            <label className={labelClass}>Company</label>
            <select className={fieldClass} value={company} onChange={(e) => setCompany(e.target.value)} required>
              <option value="">Select company</option>
              {companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {companies.length === 0 ? (
              <p className="text-xs text-amber-700 mt-1.5">Add a company first on the Business page.</p>
            ) : null}
          </div>
        )}

        <div>
          <label className={labelClass}>Deal name</label>
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Value (INR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={fieldClass}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Stage</label>
            <select className={fieldClass} value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
              <option value="LEAD">Lead</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="REQUIREMENT">Requirement</option>
              <option value="PROPOSAL">Proposal</option>
              <option value="NEGOTIATION">Negotiation</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Expected close date</label>
            <input type="date" className={fieldClass} value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Source</label>
            <input className={fieldClass} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Referral, inbound..." />
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={`${fieldClass} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            {mutation.isPending ? 'Saving...' : 'Save Deal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
