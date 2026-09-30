import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import WorkspaceCard from '../components/WorkspaceCard'
import { findCompany, setWorkspace, useWorkspace } from '../lib/workspaces'

export default function SelectRegion() {
  const { company: companyId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const workspace = useWorkspace()
  const company = findCompany(companyId)

  if (!company || !company.active) return <Navigate to="/select-company" replace />

  const from = (location.state as { from?: string } | null)?.from
  const target = from && !from.startsWith('/select-company') && from !== '/login' ? from : '/'

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="relative z-10 px-4 sm:px-6 md:px-10 py-10 sm:py-14 max-w-5xl mx-auto">
        <Link
          to="/select-company"
          state={location.state}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-brand mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
          All companies
        </Link>
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand/70">Step 2 of 2</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-ink tracking-tight">{company.name}</h1>
          <p className="mt-1 text-sm text-muted">Select the region to continue.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {company.regions.map((region) => (
            <WorkspaceCard
              key={region.id}
              title={region.name}
              body={`${company.name.replace(/\.ai$/, '')} ${region.name}`}
              badge={region.code}
              active={region.active}
              selected={workspace?.company === company.id && workspace.region === region.id}
              onSelect={() => {
                setWorkspace({ company: company.id, region: region.id })
                navigate(target, { replace: true })
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
