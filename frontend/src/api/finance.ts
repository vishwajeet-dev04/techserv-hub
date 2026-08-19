import apiClient from './client'
import type {
  FinancialDocument,
  FinancialMetric,
  FinancialPeriod,
  PaginatedResponse,
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
}
