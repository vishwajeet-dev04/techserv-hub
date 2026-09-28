import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import type { User, UserRole } from '../types'

const VALID_ROLES: UserRole[] = ['ADMIN', 'MANAGEMENT', 'SALES', 'FINANCE', 'VIEWER']

const MODULE_ROLES: Record<string, UserRole[]> = {
  dashboard: ['ADMIN', 'MANAGEMENT', 'SALES', 'FINANCE', 'VIEWER'],
  business: ['ADMIN', 'MANAGEMENT', 'SALES'],
  deals: ['ADMIN', 'MANAGEMENT', 'SALES'],
  pulse: ['ADMIN', 'MANAGEMENT', 'SALES'],
  finance: ['ADMIN', 'MANAGEMENT', 'SALES', 'FINANCE', 'VIEWER'],
  reports: ['ADMIN', 'MANAGEMENT', 'SALES', 'FINANCE', 'VIEWER'],
  users: ['ADMIN'],
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

export function readUserRole(source: unknown): UserRole | undefined {
  const root = asRecord(source)
  if (!root) return undefined

  const nested = asRecord(root.user)
  const raw = root.role ?? nested?.role
  if (typeof raw !== 'string') return undefined

  const normalized = raw.trim().toUpperCase() as UserRole
  return VALID_ROLES.includes(normalized) ? normalized : undefined
}

interface AuthContextValue {
  user: User | undefined
  role: UserRole | undefined
  isLoading: boolean
  isAdmin: boolean
  isManagement: boolean
  isSales: boolean
  isFinance: boolean
  isViewer: boolean
  hasAccess: (module: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('access_token'))

  const { data: user, isFetched } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: hasToken,
    retry: 1,
  })

  const role = readUserRole(user)
  const isAdmin = role === 'ADMIN'
  const isManagement = role === 'MANAGEMENT'
  const isSales = role === 'SALES'
  const isFinance = role === 'FINANCE'
  const isViewer = role === 'VIEWER'

  const isLoading = hasToken && !isFetched

  const hasAccess = useCallback(
    (module: string) => {
      if (isAdmin) return true
      // While /me is loading or failed, do not invent partial access (avoids Hub showing only Executive Summary).
      if (!role) return false
      return MODULE_ROLES[module]?.includes(role) ?? false
    },
    [role, isAdmin],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      isLoading,
      isAdmin,
      isManagement,
      isSales,
      isFinance,
      isViewer,
      hasAccess,
    }),
    [user, role, isLoading, isAdmin, isManagement, isSales, isFinance, isViewer, hasAccess],
  )

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
