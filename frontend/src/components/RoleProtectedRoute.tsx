import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

interface RoleProtectedRouteProps {
  allowedRoles: UserRole[]
  children: ReactNode
}

export default function RoleProtectedRoute({ allowedRoles, children }: RoleProtectedRouteProps) {
  const { role, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    )
  }

  if (role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
