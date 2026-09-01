import apiClient from './client'
import type {
  CapitalRow,
  CashflowRow,
  FinancialDocument,
  FinancialMetric,
  FinancialPeriod,
  OpsInvoice,
  OpsPayable,
  OpsSummary,
  PaginatedResponse,
  PurchaseOrder,
} from '../types'

export interface PeriodCreatePayload {
  period_type: string
  start_date: string
  end_date: string
  label: string
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
  opsSummary: async (): Promise<OpsSummary> => {
    const response = await apiClient.get<OpsSummary>('/finance/ops/summary/')
    return response.data
  },
  listPurchaseOrders: async (): Promise<PaginatedResponse<PurchaseOrder>> => {
    const response = await apiClient.get<PaginatedResponse<PurchaseOrder>>('/finance/purchase-orders/', {
      params: { page_size: 100 },
    })
    return response.data
  },
  listInvoices: async (): Promise<PaginatedResponse<OpsInvoice>> => {
    const response = await apiClient.get<PaginatedResponse<OpsInvoice>>('/finance/invoices/', {
      params: { page_size: 100 },
    })
    return response.data
  },
  listPayables: async (): Promise<PaginatedResponse<OpsPayable>> => {
    const response = await apiClient.get<PaginatedResponse<OpsPayable>>('/finance/payables/', {
      params: { page_size: 100 },
    })
    return response.data
  },
  listCashflow: async (): Promise<PaginatedResponse<CashflowRow>> => {
    const response = await apiClient.get<PaginatedResponse<CashflowRow>>('/finance/cashflow/', {
      params: { page_size: 100 },
    })
    return response.data
  },
  listCapital: async (capitalType?: string): Promise<PaginatedResponse<CapitalRow>> => {
    const response = await apiClient.get<PaginatedResponse<CapitalRow>>('/finance/capital/', {
      params: { page_size: 100, capital_type: capitalType },
    })
    return response.data
  },
}
