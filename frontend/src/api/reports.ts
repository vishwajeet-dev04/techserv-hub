import apiClient from './client'
import type {
  CustomerRevenueReport,
  FinancialSummaryReport,
  MonthlySummaryReport,
  SalesPipelineReport,
} from '../types'

export const reportsApi = {
  monthlySummary: async (periodId?: string): Promise<MonthlySummaryReport> => {
    const response = await apiClient.get<MonthlySummaryReport>('/reports/monthly-summary/', {
      params: periodId ? { period_id: periodId } : {},
    })
    return response.data
  },
  salesPipeline: async (): Promise<SalesPipelineReport> => {
    const response = await apiClient.get<SalesPipelineReport>('/reports/sales-pipeline/')
    return response.data
  },
  financialSummary: async (periodId?: string): Promise<FinancialSummaryReport> => {
    const response = await apiClient.get<FinancialSummaryReport>('/reports/financial-summary/', {
      params: periodId ? { period_id: periodId } : {},
    })
    return response.data
  },
  customerRevenue: async (): Promise<CustomerRevenueReport> => {
    const response = await apiClient.get<CustomerRevenueReport>('/reports/customer-revenue/')
    return response.data
  },
}
