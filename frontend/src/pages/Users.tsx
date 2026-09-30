import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '../api/errors'
import { usersApi } from '../api/users'
import { useAuth } from '../hooks/useAuth'
import { notify } from '../lib/notify'
import type { User, UserRole } from '../types'
import UserFormModal from '../components/UserFormModal'

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const PeopleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const roleBadges: Record<UserRole, string> = {
  ADMIN: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  MANAGEMENT: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  SALES: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  FINANCE: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  VIEWER: 'bg-canvas text-muted border border-line',
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-canvas rounded-xl ${className ?? ''}`} />
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-14 h-14 bg-canvas rounded-2xl flex items-center justify-center mb-4 text-muted">
        <PeopleIcon />
      </div>
      <p className="text-sm font-medium text-muted">No users yet</p>
      <p className="text-xs text-muted mt-1">Add your first user to get started</p>
    </div>
  )
}

const ROLE_FILTERS: { label: string; value: UserRole | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Management', value: 'MANAGEMENT' },
  { label: 'Sales', value: 'SALES' },
  { label: 'Finance', value: 'FINANCE' },
  { label: 'Viewer', value: 'VIEWER' },
]

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
          : 'bg-surface border border-line text-muted hover:border-line hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${roleBadges[role]}`}>
      {role}
    </span>
  )
}

function UserRow({
  user,
  currentUserId,
  onDeactivate,
  deactivating,
}: {
  user: User
  currentUserId?: string
  onDeactivate: (id: string) => void
  deactivating: boolean
}) {
  const initials = getInitials(user.name) || 'U'
  const colorIndex = user.name.charCodeAt(0) % AVATAR_COLORS.length
  const avatarColor = AVATAR_COLORS[colorIndex] ?? AVATAR_COLORS[0]
  const isSelf = user.id === currentUserId

  return (
    <tr className="group border-b border-canvas last:border-0 hover:bg-canvas/60 transition-colors duration-100">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0`}>
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <p className="text-sm font-medium text-ink">{user.name}</p>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <p className="text-sm text-muted">{user.email}</p>
      </td>
      <td className="px-5 py-3.5">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-5 py-3.5">
        {user.is_active ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-canvas text-muted border border-line">
            <span className="w-1.5 h-1.5 rounded-full bg-muted" />
            Inactive
          </span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <p className="text-sm text-muted">{formatDate(user.created_at)}</p>
      </td>
      <td className="px-5 py-3.5 text-right">
        {user.is_active && !isSelf ? (
          <button
            type="button"
            onClick={() => onDeactivate(user.id)}
            disabled={deactivating}
            className="text-xs font-medium text-danger hover:text-danger/80 disabled:opacity-50"
          >
            Deactivate
          </button>
        ) : null}
      </td>
    </tr>
  )
}

export default function Users() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => usersApi.list({ page, page_size: 20 }),
  })

  const users: User[] = (data?.results ?? []).filter((user) => {
    const matchesRole = !roleFilter || user.role === roleFilter
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q ||
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q)
    return matchesRole && matchesSearch
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: async () => {
      notify.success('User deactivated.')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => notify.error(getErrorMessage(err, 'Could not deactivate user.')),
  })

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Users</h2>
          <p className="text-xs text-subtle mt-0.5">
            {data ? `${data.count} users` : 'Team members and access'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl active:scale-95 transition-transform shadow-sm"
        >
          <PlusIcon />
          Add User
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <input
            id="user-search"
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3 pr-4 py-2 bg-surface border border-line rounded-xl text-sm text-ink placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft focus-visible:ring-2 focus-visible:ring-brand transition-colors w-64"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ROLE_FILTERS.map((filter) => (
            <FilterBtn
              key={filter.label}
              label={filter.label}
              active={roleFilter === filter.value}
              onClick={() => setRoleFilter(filter.value)}
            />
          ))}
        </div>
      </div>

      <div className="bg-surface border border-line shadow-sm rounded-2xl overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : !data || users.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  {['Name', 'Email', 'Role', 'Status', 'Created', ''].map((heading) => (
                    <th
                      key={heading || 'actions'}
                      className="px-5 py-3.5 text-left text-[10px] font-semibold text-subtle uppercase tracking-widest"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    currentUserId={currentUser?.id}
                    onDeactivate={(id) => deactivateMutation.mutate(id)}
                    deactivating={deactivateMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3 border-t border-line">
              <p className="text-xs text-muted">
                Page {page} · {data.count} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!data.previous}
                  className="px-3 py-1.5 rounded-xl text-xs text-muted bg-surface border border-line disabled:opacity-30 hover:text-ink hover:border-line transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.next}
                  className="px-3 py-1.5 rounded-xl text-xs text-muted bg-surface border border-line disabled:opacity-30 hover:text-ink hover:border-line transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <UserFormModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
