import { useLocation } from 'react-router-dom'

export interface OpsPaths {
  inPulse: boolean
  summary: string
  pipeline: string
  deals: string
  deal: (id: string | number) => string
}

const PULSE_PATHS: OpsPaths = {
  inPulse: true,
  summary: '/pulse/summary',
  pipeline: '/pulse/pipeline',
  deals: '/pulse/po-contracts',
  deal: (id) => `/pulse/po-contracts/${id}`,
}

const OPS_PATHS: OpsPaths = {
  inPulse: false,
  summary: '/ops',
  pipeline: '/ops/pipeline',
  deals: '/deals',
  deal: (id) => `/deals/${id}`,
}

/** Deal-to-Billing Ops pages are mounted under both /ops and /pulse; keep links inside the current shell. */
export function useOpsPaths(): OpsPaths {
  const { pathname } = useLocation()
  return pathname.startsWith('/pulse') ? PULSE_PATHS : OPS_PATHS
}
