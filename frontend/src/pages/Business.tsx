import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { companiesApi } from '../api/companies'
import { useAuth } from '../hooks/useAuth'
import type { Company, CompanyStatus } from '../types'
import CompanyFormModal from '../components/CompanyFormModal'

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

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

const GlobeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

const LocationIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const UsersIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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

const AVATAR_COLORS = [
  'from-violet-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-blue-500 to-cyan-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
] as const

const STATUS_FILTERS: { label: string; value: CompanyStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Customer', value: 'CUSTOMER' },
  { label: 'Prospect', value: 'PROSPECT' },
  { label: 'Partner', value: 'PARTNER' },
  { label: 'Inactive', value: 'INACTIVE' },
]

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

function StatusBadge({ status }: { status: CompanyStatus }) {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#f5f5f7] rounded-xl ${className ?? ''}`} />
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-14 h-14 bg-[#f5f5f7] rounded-2xl flex items-center justify-center mb-4 text-[#aeaeb2]">
        <BuildingIcon />
      </div>
      <p className="text-sm font-medium text-[#6e6e73]">
        {filtered ? 'No companies match your search' : 'No companies yet'}
      </p>
      <p className="text-xs text-[#aeaeb2] mt-1">
        {filtered ? 'Try adjusting your filters' : 'Add your first company to get started'}
      </p>
    </div>
  )
}

function CompanyRow({ company }: { company: Company }) {
  const navigate = useNavigate()
  const initials = getInitials(company.name) || 'C'
  const colorIndex = company.name.charCodeAt(0) % AVATAR_COLORS.length
  const avatarColor = AVATAR_COLORS[colorIndex] ?? AVATAR_COLORS[0]

  return (
    <tr
      className="group border-b border-[#f5f5f7] last:border-0 hover:bg-[#f9f9fb] transition-colors duration-100 cursor-pointer"
      onClick={() => navigate(`/business/${company.id}`)}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0`}>
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-[#1a1a1a]">{company.name}</p>
            {company.industry ? (
              <p className="text-xs text-[#aeaeb2] mt-0.5">{company.industry}</p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge status={company.status} />
      </td>
      <td className="px-5 py-3.5">
        {company.location ? (
          <div className="flex items-center gap-1.5 text-[#6e6e73]">
            <LocationIcon />
            <span className="text-xs">{company.location}</span>
          </div>
        ) : (
          <span className="text-xs text-[#aeaeb2]">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        {company.website ? (
          <a
            href={websiteHref(company.website)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="flex items-center gap-1.5 text-[#6e6e73] hover:text-violet-600 transition-colors"
          >
            <GlobeIcon />
            <span className="text-xs truncate max-w-[140px]">{websiteLabel(company.website)}</span>
          </a>
        ) : (
          <span className="text-xs text-[#aeaeb2]">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <span className="text-xs font-medium text-[#1a1a1a]">{company.deal_count ?? 0}</span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5 text-[#6e6e73]">
          <UsersIcon />
          <span className="text-xs">{company.contact_count ?? 0}</span>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#6e6e73]">{company.owner_name ?? '—'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#d1d1d6] opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </td>
    </tr>
  )
}

function FilterBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95 ${
        active
          ? 'bg-violet-600 text-white border border-violet-600'
          : 'bg-white border border-[#e5e5ea] text-[#6e6e73] hover:border-[#d1d1d6] hover:text-[#1a1a1a]'
      }`}
    >
      {label}
    </button>
  )
}

export default function Business() {
  const { isManagement } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | ''>('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, statusFilter, page],
    queryFn: () =>
      companiesApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
      }),
    placeholderData: (prev) => prev,
  })

  const isFiltered = Boolean(search) || Boolean(statusFilter)
  const companies = data?.results ?? []

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C3AED]">Accounts</p>
          <h2 className="text-2xl font-semibold text-[#1a1a1a] mt-1">Business</h2>
          <p className="text-xs text-[#aeaeb2] mt-0.5">
            {data ? `${data.count} companies in the TechServ funnel` : 'Companies and contacts'}
          </p>
        </div>
        {!isManagement ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl active:scale-95 transition-transform shadow-sm"
          >
            <PlusIcon />
            Add Company
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aeaeb2]">
            <SearchIcon />
          </span>
          <input
            id="company-search"
            ref={searchRef}
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9 pr-14 py-2 bg-white border border-[#e5e5ea] rounded-xl text-sm text-[#1a1a1a] placeholder:text-[#aeaeb2] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors w-72"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#aeaeb2] bg-[#f5f5f7] border border-[#e5e5ea] rounded-md px-1.5 py-0.5">
            ⌘K
          </span>
        </div>
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((filter) => (
            <FilterBtn
              key={filter.label}
              label={filter.label}
              active={statusFilter === filter.value}
              onClick={() => {
                setStatusFilter(filter.value)
                setPage(1)
              }}
            />
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : !data || companies.length === 0 ? (
          <EmptyState filtered={isFiltered} />
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e5ea] bg-[#f9f9fb]">
                  {['Company', 'Status', 'Location', 'Website', 'Deals', 'Contacts', 'Owner'].map((heading) => (
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
                {data.results.map((company) => (
                  <CompanyRow key={company.id} company={company} />
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#e5e5ea]">
              <p className="text-xs text-[#6e6e73]">
                Page {page} · {data.count} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!data.previous}
                  className="px-3 py-1.5 rounded-xl text-xs text-[#6e6e73] bg-white border border-[#e5e5ea] disabled:opacity-30 hover:text-[#1a1a1a] hover:border-[#d1d1d6] active:scale-95 transition-transform"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.next}
                  className="px-3 py-1.5 rounded-xl text-xs text-[#6e6e73] bg-white border border-[#e5e5ea] disabled:opacity-30 hover:text-[#1a1a1a] hover:border-[#d1d1d6] active:scale-95 transition-transform"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <CompanyFormModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
