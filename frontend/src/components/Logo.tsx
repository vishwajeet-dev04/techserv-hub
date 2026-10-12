import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isTechPay, useWorkspace } from '../lib/workspaces'

const FINANCE_QUERY_ROOTS = [
  'finance-ops-summary',
  'finance-ops-dashboard-series',
  'finance-bank-position',
  'finance-compliance',
  'finance-master-clients',
  'finance-master-vendors',
  'cashflow',
  'ledger-summary',
  'payables',
  'purchase-orders',
  'invoices',
  'capital',
  'mis-uploads',
]

function subscribeDark(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function darkNow() {
  return document.documentElement.classList.contains('dark')
}

export function useDarkTheme() {
  return useSyncExternalStore(subscribeDark, darkNow, () => false)
}

/** TechPay wordmark while that company is selected. TechServ logo otherwise. */
export default function Logo({ className = '', height = 36 }: { className?: string; height?: number }) {
  const techpay = isTechPay(useWorkspace())
  const dark = useDarkTheme()
  const src = !techpay ? '/logo.svg' : dark ? '/techpay-logo-white.png' : '/techpay-logo-purple.png'
  return (
    <img
      src={src}
      alt={techpay ? 'TECHPAY.ai' : 'TECHSERV.ai'}
      height={height}
      className={`w-auto object-contain object-left ${className}`}
      style={{ height }}
    />
  )
}

export function WorkspaceBrand() {
  const workspace = useWorkspace()
  const techpay = isTechPay(workspace)
  const queryClient = useQueryClient()
  const workspaceKey = `${workspace?.company ?? 'techserv'}:${workspace?.region ?? 'india'}`
  const previous = useRef(workspaceKey)

  useEffect(() => {
    document.documentElement.dataset.brand = techpay ? 'techpay' : 'techserv'
    return () => {
      delete document.documentElement.dataset.brand
    }
  }, [techpay])

  useEffect(() => {
    if (previous.current === workspaceKey) return
    previous.current = workspaceKey
    for (const root of FINANCE_QUERY_ROOTS) {
      queryClient.removeQueries({ queryKey: [root] })
    }
  }, [queryClient, workspaceKey])

  return null
}
