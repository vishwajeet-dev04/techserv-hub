import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '../api/errors'
import { usersApi } from '../api/users'
import { useAuth } from '../hooks/useAuth'
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
  ADMIN: 'bg-violet-50 text-violet-700 border border-violet-200',
  MANAGEMENT: 'bg-blue-50 text-blue-700 border border-blue-200',
  SALES: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  FINANCE: 'bg-amber-50 text-amber-700 border border-amber-200',
  VIEWER: 'bg-[#f5f5f7] text-[#6e6e73] border border-[#e5e5ea]',
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-14 h-14 bg-[#f5f5f7] rounded-2xl flex items-center justify-center mb-4 text-[#aeaeb2]">
        <PeopleIcon />
      </div>
      <p className="text-sm font-medium text-[#6e6e73]">No users yet</p>
      <p className="text-xs text-[#aeaeb2] mt-1">Add your first user to get started</p>
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
          : 'bg-white border border-[#e5e5ea] text-[#6e6e73] hover:border-[#d1d1d6] hover:text-[#1a1a1a]'
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
    <tr className="group border-b border-[#f5f5f7] last:border-0 hover:bg-[#f9f9fb] transition-colors duration-100">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0`}>
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <p className="text-sm font-medium text-[#1a1a1a]">{user.name}</p>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <p className="text-sm text-[#3a3a3c]">{user.email}</p>
      </td>
      <td className="px-5 py-3.5">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-5 py-3.5">
        {user.is_active ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-[#f5f5f7] text-[#aeaeb2] border border-[#e5e5ea]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#aeaeb2]" />
            Inactive
          </span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <p className="text-sm text-[#3a3a3c]">{formatDate(user.created_at)}</p>
      </td>
      <td className="px-5 py-3.5 text-right">
        {user.is_active && !isSelf ? (
          <button
            type="button"
            onClick={() => onDeactivate(user.id)}
            disabled={deactivating}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
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
  const [error, setError] = useState('')
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
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => setError(getErrorMessage(err, 'Could not deactivate user.')),
  })

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#1a1a1a]">Users</h2>
          <p className="text-xs text-[#aeaeb2] mt-0.5">
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

      {error ? (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <input
            id="user-search"
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3 pr-4 py-2 bg-white border border-[#e5e5ea] rounded-xl text-sm text-[#1a1a1a] placeholder:text-[#aeaeb2] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors w-64"
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

      <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : !data || users.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e5ea] bg-[#f9f9fb]">
                  {['Name', 'Email', 'Role', 'Status', 'Created', ''].map((heading) => (
                    <th
                      key={heading || 'actions'}
                      className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-widest"
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
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#e5e5ea]">
              <p className="text-xs text-[#6e6e73]">
                Page {page} · {data.count} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!data.previous}
                  className="px-3 py-1.5 rounded-xl text-xs text-[#6e6e73] bg-white border border-[#e5e5ea] disabled:opacity-30 hover:text-[#1a1a1a] hover:border-[#d1d1d6] transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.next}
                  className="px-3 py-1.5 rounded-xl text-xs text-[#6e6e73] bg-white border border-[#e5e5ea] disabled:opacity-30 hover:text-[#1a1a1a] hover:border-[#d1d1d6] transition-colors"
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
