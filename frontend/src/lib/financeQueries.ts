import type { QueryClient } from '@tanstack/react-query'

/** Invalidate every finance/home cache that MIS import can change. */
export function invalidateFinanceQueries(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
    queryClient.invalidateQueries({ queryKey: ['payables'] }),
    queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
    queryClient.invalidateQueries({ queryKey: ['ledger-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['mis-uploads'] }),
    queryClient.invalidateQueries({ queryKey: ['finance-bank-position'] }),
    queryClient.invalidateQueries({ queryKey: ['finance-ops-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['finance-ops-dashboard-series'] }),
    queryClient.invalidateQueries({ queryKey: ['capital'] }),
    queryClient.invalidateQueries({ queryKey: ['finance-compliance'] }),
    queryClient.invalidateQueries({ queryKey: ['financial-metrics'] }),
    queryClient.invalidateQueries({ queryKey: ['financial-periods'] }),
    queryClient.invalidateQueries({ queryKey: ['pulse-executive'] }),
  ])
}
