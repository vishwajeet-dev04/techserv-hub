import apiClient from './client'
import type { Deal, DealActivity, PaginatedResponse, PipelineSummary } from '../types'

interface DealFilters {
  search?: string
  stage?: string
  company_id?: string
  service_pillar?: string
  source?: string
  page?: number
  page_size?: number
}

export const dealsApi = {
  list: async (filters: DealFilters = {}): Promise<PaginatedResponse<Deal>> => {
    const response = await apiClient.get<PaginatedResponse<Deal>>('/deals/', { params: filters })
    return response.data
  },
  get: async (id: string): Promise<Deal> => {
    const response = await apiClient.get<Deal>(`/deals/${id}/`)
    return response.data
  },
  create: async (data: Partial<Deal>): Promise<Deal> => {
    const response = await apiClient.post<Deal>('/deals/', data)
    return response.data
  },
  update: async (id: string, data: Partial<Deal>): Promise<Deal> => {
    const response = await apiClient.patch<Deal>(`/deals/${id}/`, data)
    return response.data
  },
  pipelineSummary: async (): Promise<PipelineSummary> => {
    const response = await apiClient.get<PipelineSummary>('/deals/pipeline/summary/')
    return response.data
  },
  getActivities: async (dealId: string): Promise<DealActivity[]> => {
    const response = await apiClient.get<PaginatedResponse<DealActivity> | DealActivity[]>(
      `/deals/${dealId}/activities/`,
      { params: { page_size: 100 } },
    )
    const payload = response.data
    return Array.isArray(payload) ? payload : payload.results
  },
  createActivity: async (
    dealId: string,
    data: {
      type: DealActivity['type']
      subject: string
      description?: string
      activity_date: string
    },
  ): Promise<DealActivity> => {
    const response = await apiClient.post<DealActivity>(`/deals/${dealId}/activities/`, data)
    return response.data
  },
}