import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { companiesApi } from '../api/companies'
import { dealsApi } from '../api/deals'
import { getErrorMessage } from '../api/errors'
import { useAuth } from '../hooks/useAuth'
import type { CompanyStatus, Contact, Deal, DealStage } from '../types'
import ContactFormModal from '../components/ContactFormModal'
import DealFormModal from '../components/DealFormModal'

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const BuildingIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 21h18M3 7v14M21 7v14M6 21V7M18 21V7M3 7l9-4 9 4M9 21v-4h6v4" />
  </svg>
)

const UsersIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

const TrendingIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

const statusConfig: Record<CompanyStatus, { label: string; className: string; dot: string }> = {
  CUSTOMER: {
    label: 'Customer',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-600',
  },
  PROSPECT: {
    label: 'Prospect',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-600',
  },
  PARTNER: {
    label: 'Partner',
    className: 'bg-violet-50 text-violet-700 border border-violet-200',
    dot: 'bg-violet-600',
  },
  INACTIVE: {
    label: 'Inactive',
    className: 'bg-[#f5f5f7] text-[#aeaeb2] border border-[#e5e5ea]',
    dot: 'bg-[#aeaeb2]',
  },
}

const stageConfig: Record<DealStage, { label: string; className: string; dot: string }> = {
  LEAD: { label: 'Lead', className: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-500' },
  QUALIFIED: { label: 'Qualified', className: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
  REQUIREMENT: { label: 'Requirement', className: 'bg-cyan-50 text-cyan-700 border border-cyan-200', dot: 'bg-cyan-500' },
  PROPOSAL: { label: 'Proposal', className: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  NEGOTIATION: { label: 'Negotiation', className: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  WON: { label: 'Won', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  LOST: { label: 'Lost', className: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' },
}

const AVATAR_COLORS = [
  'from-violet-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-blue-500 to-cyan-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
] as const

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

function websiteHref(website: string): string {
  if (/^https?:\/\//i.test(website)) return website
  return `https://${website}`
}

function websiteLabel(website: string): string {
  return website.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

const fmtCurrency = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

const fmtDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#f5f5f7] rounded-xl ${className ?? ''}`} />
}

function StatusBadge({ status }: { status: CompanyStatus }) {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function StageBadge({ stage }: { stage: DealStage }) {
  const config = stageConfig[stage]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#f5f5f7] last:border-0">
      <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest pt-0.5">{label}</p>
      <div className="text-sm text-[#1a1a1a] text-right">{value || <span className="text-[#aeaeb2]">—</span>}</div>
    </div>
  )
}

function EmptyBlock({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14">
      <div className="w-14 h-14 bg-[#f5f5f7] rounded-2xl flex items-center justify-center mb-3 text-[#aeaeb2]">
        {icon}
      </div>
      <p className="text-sm font-medium text-[#6e6e73]">{title}</p>
      <p className="text-xs text-[#aeaeb2] mt-1">{description}</p>
    </div>
  )
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <EmptyBlock
        icon={<UsersIcon />}
        title="No contacts yet"
        description="Add a contact for this company"
      />
    )
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#e5e5ea] bg-[#f9f9fb]">
          {['Name', 'Designation', 'Email', 'Phone'].map((heading) => (
            <th
              key={heading}
                      className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-widest"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {contacts.map((contact) => {
          const name = contact.full_name || `${contact.first_name} ${contact.last_name}`.trim()
          const initials = getInitials(name) || 'C'
          const colorIndex = name.charCodeAt(0) % AVATAR_COLORS.length
          const avatarColor = AVATAR_COLORS[colorIndex] ?? AVATAR_COLORS[0]
          return (
            <tr key={contact.id} className="border-b border-[#f5f5f7] last:border-0 hover:bg-[#f9f9fb] transition-colors duration-100">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-xs font-semibold">{initials}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#1a1a1a]">{name}</p>
                    {contact.linkedin_url ? (
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="LinkedIn profile"
                        className="text-[#aeaeb2] hover:text-violet-600 transition-colors"
                      >
                        <LinkedInIcon />
                      </a>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5">
                <p className="text-sm text-[#3a3a3c]">{contact.designation || '—'}</p>
              </td>
              <td className="px-5 py-3.5">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-sm text-[#3a3a3c] hover:text-violet-600">
                    {contact.email}
                  </a>
                ) : (
                  <p className="text-sm text-[#aeaeb2]">—</p>
                )}
              </td>
              <td className="px-5 py-3.5">
                <p className="text-sm text-[#3a3a3c]">{contact.phone || '—'}</p>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function DealsTable({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) {
    return (
      <EmptyBlock
        icon={<TrendingIcon />}
        title="No deals yet"
        description="Deals linked to this company will appear here"
      />
    )
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#e5e5ea] bg-[#f9f9fb]">
          {['Deal', 'Stage', 'Value', 'Close date', 'Owner'].map((heading) => (
            <th
              key={heading}
                      className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-widest"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {deals.map((deal) => (
          <tr key={deal.id} className="border-b border-[#f5f5f7] last:border-0 hover:bg-[#f9f9fb] transition-colors duration-100">
            <td className="px-5 py-3.5">
              <p className="text-sm font-medium text-[#1a1a1a]">{deal.name}</p>
              {deal.service_pillar ? (
                <p className="text-xs text-[#aeaeb2] mt-0.5">{deal.service_pillar}{deal.sub_category ? ` · ${deal.sub_category}` : ''}</p>
              ) : null}
            </td>
            <td className="px-5 py-3.5">
              <StageBadge stage={deal.stage} />
            </td>
            <td className="px-5 py-3.5">
              <p className="text-sm font-semibold text-[#1a1a1a]">{fmtCurrency(Number(deal.value), deal.currency || 'INR')}</p>
              <p className="text-xs text-[#aeaeb2] mt-0.5">
                {fmtCurrency(Number(deal.weighted_value), deal.currency || 'INR')} weighted
              </p>
            </td>
            <td className="px-5 py-3.5">
              <p className="text-sm text-[#3a3a3c]">{fmtDate(deal.expected_close_date)}</p>
            </td>
            <td className="px-5 py-3.5">
              <p className="text-sm text-[#3a3a3c]">{deal.owner_name ?? '—'}</p>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function CompanyDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isManagement } = useAuth()
  const [showContact, setShowContact] = useState(false)
  const [showDeal, setShowDeal] = useState(false)

  const {
    data: company,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id),
    enabled: Boolean(id),
  })

  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ['deals', { company_id: id }],
    queryFn: () => dealsApi.list({ company_id: id, page: 1, page_size: 50 }),
    enabled: Boolean(id),
  })

  const contacts = company?.contacts ?? []
  const deals = dealsData?.results ?? []
  const totalDealValue = deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0)
  const initials = getInitials(company?.name ?? '') || 'C'
  const colorIndex = (company?.name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length
  const avatarColor = AVATAR_COLORS[colorIndex] ?? AVATAR_COLORS[0]

  if (isLoading) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (isError || !company) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl py-20 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mb-4 text-[#aeaeb2]">
            <BuildingIcon />
          </div>
          <p className="text-sm font-medium text-[#6e6e73]">Company not found</p>
          <p className="text-xs text-[#aeaeb2] mt-1">
            {getErrorMessage(error, 'This company does not exist or you cannot view it.')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/business')}
            className="mt-4 text-sm text-violet-600 hover:text-violet-700"
          >
            Back to Business
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <Link to="/business" className="text-xs text-[#aeaeb2] hover:text-violet-600">
        ← Business
      </Link>

      <div className="bg-gradient-to-r from-[#f9f9fb] to-white border border-[#e5e5ea] rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0`}>
              <span className="text-white text-sm font-semibold">{initials}</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-[#1a1a1a]">{company.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={company.status} />
                {company.industry ? <span className="text-xs text-[#6e6e73]">{company.industry}</span> : null}
                {company.company_type ? <span className="text-xs text-[#aeaeb2]">{company.company_type}</span> : null}
              </div>
            </div>
          </div>
          {!isManagement ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDeal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5ea] hover:border-[#d1d1d6] text-[#6e6e73] hover:text-[#1a1a1a] text-sm font-medium rounded-xl active:scale-95 transition-transform"
              >
                <PlusIcon />
                Add Deal
              </button>
              <button
                type="button"
                onClick={() => setShowContact(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl active:scale-95 transition-transform shadow-sm"
              >
                <PlusIcon />
                Add Contact
              </button>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-4">
            <p className="text-xs font-medium text-[#6e6e73] uppercase tracking-wider">Contacts</p>
            <p className="text-lg font-semibold text-[#1a1a1a] mt-1">{contacts.length}</p>
          </div>
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-4">
            <p className="text-xs font-medium text-[#6e6e73] uppercase tracking-wider">Deals</p>
            <p className="text-lg font-semibold text-[#1a1a1a] mt-1">{dealsData?.count ?? deals.length}</p>
          </div>
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-4">
            <p className="text-xs font-medium text-[#6e6e73] uppercase tracking-wider">Total deal value</p>
            <p className="text-lg font-semibold text-[#1a1a1a] mt-1">{fmtCurrency(totalDealValue)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-5">
        <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest mb-2">Company</p>
        <InfoRow label="Location" value={company.location} />
        <InfoRow
          label="Website"
          value={
            company.website ? (
              <a
                href={websiteHref(company.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-700"
              >
                {websiteLabel(company.website)}
              </a>
            ) : null
          }
        />
        <InfoRow label="Owner" value={company.owner?.name ?? company.owner_name} />
        <InfoRow label="Notes" value={company.notes} />
      </div>

      <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5ea] flex items-center justify-between">
          <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">
            Contacts · {contacts.length}
          </p>
        </div>
        <ContactsTable contacts={contacts} />
      </div>

      <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5ea]">
          <p className="text-[11px] font-medium text-[#6e6e73] uppercase tracking-widest">
            Linked deals · {dealsData?.count ?? deals.length}
          </p>
        </div>
        {dealsLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (
          <DealsTable deals={deals} />
        )}
      </div>

      <ContactFormModal open={showContact} companyId={company.id} onClose={() => setShowContact(false)} />
      <DealFormModal open={showDeal} companyId={company.id} onClose={() => setShowDeal(false)} />
    </div>
  )
}
