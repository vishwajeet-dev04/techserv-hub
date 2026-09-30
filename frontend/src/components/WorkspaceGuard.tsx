import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useWorkspace } from '../lib/workspaces'

export default function WorkspaceGuard({ children }: { children?: ReactNode }) {
  const workspace = useWorkspace()
  const location = useLocation()
  if (!workspace) {
    return <Navigate to="/select-company" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children ?? <Outlet />}</>
}
