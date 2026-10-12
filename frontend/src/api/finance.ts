import apiClient from './client'
import type {
  CapitalRow,
  CashflowRow,
  ComplianceItem,
  FinancialDocument,
  FinancialMetric,
  FinancialPeriod,
  LedgerCashflowSummary,
  LedgerClientsSummary,
  LedgerInvoicesSummary,
  LedgerListParams,
  LedgerPayablesSummary,
  LedgerPoSummary,
  OpsInvoice,
  OpsPayable,
  OpsDashboardSeries,
  OpsSummary,
  BankPosition,
  FinanceClient,
  FinanceStatusChange,
  FinanceVendor,
  MasterDataListParams,
  PayableStatus,
  ReceivableStatus,
  PaginatedResponse,
  PulseImportResult,
  PurchaseOrder,
  MisUpload,
} from '../types'

export interface PeriodCreatePayload {
  period_type: string
  start_date: string
  end_date: string
  label: string
}

function cleanParams(params?: LedgerListParams | MasterDataListParams) {
  if (!params) return { page_size: 200 }
  const next: Record<string, string | number> = { page_size: params.page_size ?? 200 }
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page_size') continue
    if (value !== undefined && value !== null && value !== '') next[key] = value
  }
  return next
}

export const financeApi = {
  listPeriods: async (): Promise<PaginatedResponse<FinancialPeriod>> => {
    const response = await apiClient.get<PaginatedResponse<FinancialPeriod>>('/finance/periods/')
    return response.data
  },
  createPeriod: async (data: PeriodCreatePayload): Promise<FinancialPeriod> => {
    const response = await apiClient.post<FinancialPeriod>('/finance/periods/', data)
    return response.data
  },
  listMetrics: async (periodId: string): Promise<PaginatedResponse<FinancialMetric>> => {
    const response = await apiClient.get<PaginatedResponse<FinancialMetric>>('/finance/metrics/', {
      params: { period_id: periodId, page_size: 100 },
    })
    return response.data
  },
  createMetric: async (data: {
    financial_period: string
    metric_code: string
    value: number
    currency: string
  }): Promise<FinancialMetric> => {
    const response = await apiClient.post<FinancialMetric>('/finance/metrics/', data)
    return response.data
  },
  updateMetric: async (
    id: string,
    data: { value: number; currency?: string },
  ): Promise<FinancialMetric> => {
    const response = await apiClient.patch<FinancialMetric>(`/finance/metrics/${id}/`, data)
    return response.data
  },
  uploadDocument: async (formData: FormData): Promise<FinancialDocument> => {
    const response = await apiClient.post<FinancialDocument>('/finance/documents/', formData)
    return response.data
  },
  listMisUploads: async (): Promise<PaginatedResponse<MisUpload>> => {
    const response = await apiClient.get<PaginatedResponse<MisUpload>>('/finance/mis/', {
      params: { page_size: 100 },
    })
    return response.data
  },
  uploadMis: async (file: File): Promise<MisUpload> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<MisUpload>('/finance/mis/', form)
    return response.data
  },
  opsSummary: async (params?: { from?: string; to?: string }): Promise<OpsSummary> => {
    const response = await apiClient.get<OpsSummary>('/finance/ops/summary/', {
      params: {
        ...(params?.from ? { from: params.from } : {}),
        ...(params?.to ? { to: params.to } : {}),
      },
    })
    return response.data
  },
  dashboardSeries: async (params?: { from?: string; to?: string }): Promise<OpsDashboardSeries> => {
    const response = await apiClient.get<OpsDashboardSeries>('/finance/ops/dashboard-series/', {
      params: {
        ...(params?.from ? { from: params.from } : {}),
        ...(params?.to ? { to: params.to } : {}),
      },
    })
    return response.data
  },
  bankPosition: async (params?: { from?: string; to?: string }): Promise<BankPosition> => {
    const response = await apiClient.get<BankPosition>('/finance/bank-position/', {
      params: {
        ...(params?.from ? { from: params.from } : {}),
        ...(params?.to ? { to: params.to } : {}),
      },
    })
    return response.data
  },
  ledgerSummary: async (
    page: 'cashflow' | 'payables' | 'invoices' | 'clients' | 'purchase-orders',
    params?: Pick<LedgerListParams, 'from' | 'to' | 'account'>,
  ): Promise<
    | LedgerCashflowSummary
    | LedgerPayablesSummary
    | LedgerInvoicesSummary
    | LedgerClientsSummary
    | LedgerPoSummary
  > => {
    const response = await apiClient.get('/finance/ledger/summary/', {
      params: {
        page,
        ...(params?.from ? { from: params.from } : {}),
        ...(params?.to ? { to: params.to } : {}),
        ...(params?.account ? { account: params.account } : {}),
      },
    })
    return response.data
  },
  listPurchaseOrders: async (params?: LedgerListParams): Promise<PaginatedResponse<PurchaseOrder>> => {
    const response = await apiClient.get<PaginatedResponse<PurchaseOrder>>('/finance/purchase-orders/', {
      params: cleanParams(params),
    })
    return response.data
  },
  listInvoices: async (params?: LedgerListParams): Promise<PaginatedResponse<OpsInvoice>> => {
    const response = await apiClient.get<PaginatedResponse<OpsInvoice>>('/finance/invoices/', {
      params: cleanParams(params),
    })
    return response.data
  },
  listPayables: async (params?: LedgerListParams): Promise<PaginatedResponse<OpsPayable>> => {
    const response = await apiClient.get<PaginatedResponse<OpsPayable>>('/finance/payables/', {
      params: cleanParams(params),
    })
    return response.data
  },
  changeInvoiceStatus: async (id: string, status: ReceivableStatus, note: string): Promise<OpsInvoice> => {
    const response = await apiClient.post<OpsInvoice>(`/finance/invoices/${id}/status/`, { status, note })
    return response.data
  },
  changePayableStatus: async (id: string, status: PayableStatus, note: string): Promise<OpsPayable> => {
    const response = await apiClient.post<OpsPayable>(`/finance/payables/${id}/status/`, { status, note })
    return response.data
  },
  invoiceStatusHistory: async (id: string): Promise<FinanceStatusChange[]> => {
    const response = await apiClient.get<FinanceStatusChange[]>(`/finance/invoices/${id}/status-history/`)
    return response.data
  },
  payableStatusHistory: async (id: string): Promise<FinanceStatusChange[]> => {
    const response = await apiClient.get<FinanceStatusChange[]>(`/finance/payables/${id}/status-history/`)
    return response.data
  },
  listCashflow: async (params?: LedgerListParams): Promise<PaginatedResponse<CashflowRow>> => {
    const response = await apiClient.get<PaginatedResponse<CashflowRow>>('/finance/cashflow/', {
      params: cleanParams(params),
    })
    return response.data
  },
  listCapital: async (capitalType?: string): Promise<PaginatedResponse<CapitalRow>> => {
    const response = await apiClient.get<PaginatedResponse<CapitalRow>>('/finance/capital/', {
      params: { page_size: 100, capital_type: capitalType },
    })
    return response.data
  },
  listCompliance: async (params?: {
    month?: string
    from?: string
    to?: string
    act?: string
    status?: string
    search?: string
    page_size?: number
  }): Promise<PaginatedResponse<ComplianceItem>> => {
    const response = await apiClient.get<PaginatedResponse<ComplianceItem>>('/finance/compliance/', {
      params: cleanParams(params),
    })
    return response.data
  },
  createCompliance: async (data: Partial<ComplianceItem>): Promise<ComplianceItem> => {
    const response = await apiClient.post<ComplianceItem>('/finance/compliance/', data)
    return response.data
  },
  updateCompliance: async (
    id: string,
    data: Partial<ComplianceItem> & { due_date_scope?: 'this_month' | 'recurring' },
  ): Promise<ComplianceItem> => {
    const response = await apiClient.patch<ComplianceItem>(`/finance/compliance/${id}/`, data)
    return response.data
  },
  deleteCompliance: async (id: string): Promise<void> => {
    await apiClient.delete(`/finance/compliance/${id}/`)
  },
  listClients: async (params?: MasterDataListParams): Promise<PaginatedResponse<FinanceClient>> => {
    const response = await apiClient.get<PaginatedResponse<FinanceClient>>('/finance/clients/', {
      params: cleanParams(params),
    })
    return response.data
  },
  createClient: async (data: Partial<FinanceClient>): Promise<FinanceClient> => {
    const response = await apiClient.post<FinanceClient>('/finance/clients/', data)
    return response.data
  },
  updateClient: async (id: string, data: Partial<FinanceClient>): Promise<FinanceClient> => {
    const response = await apiClient.patch<FinanceClient>(`/finance/clients/${id}/`, data)
    return response.data
  },
  deleteClient: async (id: string): Promise<void> => {
    await apiClient.delete(`/finance/clients/${id}/`)
  },
  exportClients: async (): Promise<Blob> => {
    const response = await apiClient.get('/finance/clients/export/', { responseType: 'blob' })
    return response.data
  },
  clientTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get('/finance/clients/template/', { responseType: 'blob' })
    return response.data
  },
  importClients: async (file: File): Promise<PulseImportResult> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<PulseImportResult>('/finance/clients/import/', form)
    return response.data
  },
  listVendors: async (params?: MasterDataListParams): Promise<PaginatedResponse<FinanceVendor>> => {
    const response = await apiClient.get<PaginatedResponse<FinanceVendor>>('/finance/vendors/', {
      params: cleanParams(params),
    })
    return response.data
  },
  createVendor: async (data: Partial<FinanceVendor>): Promise<FinanceVendor> => {
    const response = await apiClient.post<FinanceVendor>('/finance/vendors/', data)
    return response.data
  },
  updateVendor: async (id: string, data: Partial<FinanceVendor>): Promise<FinanceVendor> => {
    const response = await apiClient.patch<FinanceVendor>(`/finance/vendors/${id}/`, data)
    return response.data
  },
  deleteVendor: async (id: string): Promise<void> => {
    await apiClient.delete(`/finance/vendors/${id}/`)
  },
  exportVendors: async (): Promise<Blob> => {
    const response = await apiClient.get('/finance/vendors/export/', { responseType: 'blob' })
    return response.data
  },
  vendorTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get('/finance/vendors/template/', { responseType: 'blob' })
    return response.data
  },
  importVendors: async (file: File): Promise<PulseImportResult> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<PulseImportResult>('/finance/vendors/import/', form)
    return response.data
  },
}
