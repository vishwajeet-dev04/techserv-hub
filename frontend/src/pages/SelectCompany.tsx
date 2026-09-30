import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import WorkspaceCard from '../components/WorkspaceCard'
import { COMPANIES, useWorkspace } from '../lib/workspaces'

export default function SelectCompany() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const workspace = useWorkspace()

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="relative z-10 px-4 sm:px-6 md:px-10 py-10 sm:py-14 max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand/70">Step 1 of 2</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Select a company'}
          </h1>
          <p className="mt-1 text-sm text-muted">Choose the company you want to work in.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COMPANIES.map((company) => (
            <WorkspaceCard
              key={company.id}
              title={company.name}
              body={company.tagline}
              badge={company.code}
              active={company.active}
              selected={workspace?.company === company.id}
              onSelect={() => navigate(`/select-company/${company.id}`, { state: location.state })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
