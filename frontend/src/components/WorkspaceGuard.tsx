import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isTechPay, useWorkspace } from '../lib/workspaces'

export default function WorkspaceGuard({ children }: { children?: ReactNode }) {
  const workspace = useWorkspace()
  const location = useLocation()
  if (!workspace) {
    return <Navigate to="/select-company" replace state={{ from: location.pathname + location.search }} />
  }
  if (isTechPay(workspace) && location.pathname.startsWith('/pulse')) {
    return <Navigate to="/" replace />
  }
  return <>{children ?? <Outlet />}</>
}
