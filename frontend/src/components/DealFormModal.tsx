import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api/companies'
import { dealsApi } from '../api/deals'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import type { DealStage } from '../types'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from './Modal'

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
  const [source, setSource] = useState('Services & Product')
  const [pillar, setPillar] = useState('')
  const [subCategory, setSubCategory] = useState('')
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
    setSource('Services & Product')
    setPillar('')
    setSubCategory('')
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
        service_pillar: pillar.trim(),
        sub_category: subCategory.trim(),
        description: description.trim(),
      }),
    onSuccess: async () => {
      notify.success('Deal created.')
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      await queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      reset()
      onClose()
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not create deal.')
      setError(message)
      notify.error(message)
    },
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
    <Modal
      open={open}
      title="Add Deal"
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} className={btnSecondaryClass}>
            Cancel
          </button>
          <button type="submit" form="deal-form" disabled={mutation.isPending} className={btnPrimaryClass}>
            {mutation.isPending ? 'Saving...' : 'Save Deal'}
          </button>
        </>
      }
    >
      <form id="deal-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        {companyId ? null : (
          <div>
            <label htmlFor="deal-company" className={labelClass}>Company</label>
            <select id="deal-company" className={fieldClass} value={company} onChange={(e) => setCompany(e.target.value)} required>
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
          <label htmlFor="deal-name" className={labelClass}>Deal name</label>
          <input id="deal-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="deal-value" className={labelClass}>Value (INR)</label>
            <input
              id="deal-value"
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
            <label htmlFor="deal-stage" className={labelClass}>Stage</label>
            <select id="deal-stage" className={fieldClass} value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
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
            <label htmlFor="deal-close" className={labelClass}>Expected close date</label>
            <input id="deal-close" type="date" className={fieldClass} value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="deal-source" className={labelClass}>Pipeline</label>
            <select id="deal-source" className={fieldClass} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Select pipeline</option>
              <option value="Services & Product">Services & Product</option>
              <option value="Software & AI">Software & AI</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="deal-pillar" className={labelClass}>Service pillar</label>
            <input
              id="deal-pillar"
              className={fieldClass}
              value={pillar}
              onChange={(e) => setPillar(e.target.value)}
              placeholder="Marketing, Consulting..."
            />
          </div>
          <div>
            <label htmlFor="deal-subcategory" className={labelClass}>Sub category</label>
            <input
              id="deal-subcategory"
              className={fieldClass}
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              placeholder="ICP/ABM, Development..."
            />
          </div>
        </div>

        <div>
          <label htmlFor="deal-description" className={labelClass}>Description</label>
          <textarea
            id="deal-description"
            className={`${fieldClass} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
