import apiClient from './client'
import type {
  Deal,
  DealActivity,
  PaginatedResponse,
  PipelineSummary,
  PoDocumentIssue,
  PoIssueReason,
  PoWorkflow,
  PoWorkflowDashboard,
  PulseImportResult,
} from '../types'

interface DealFilters {
  search?: string
  stage?: string
  company_id?: string
  service_pillar?: string
  source?: string
  page?: number
  page_size?: number
}

function compact(data: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== ''))
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
  listPoWorkflow: async (search?: string): Promise<PaginatedResponse<PoWorkflow>> => {
    const response = await apiClient.get<PaginatedResponse<PoWorkflow>>('/deals/po-workflow/', {
      params: { search, page_size: 200 },
    })
    return response.data
  },
  poDashboard: async (params?: {
    from?: string
    to?: string
    customer?: string
    billing_entity?: string
    search?: string
  }): Promise<PoWorkflowDashboard> => {
    const response = await apiClient.get<PoWorkflowDashboard>('/deals/po-workflow/dashboard/', {
      params: {
        from: params?.from || undefined,
        to: params?.to || undefined,
        customer: params?.customer || undefined,
        billing_entity: params?.billing_entity || undefined,
        search: params?.search || undefined,
      },
    })
    return response.data
  },
  createPoWorkflow: async (data: Record<string, string>): Promise<PoWorkflow> => {
    const response = await apiClient.post<PoWorkflow>('/deals/po-workflow/', compact(data))
    return response.data
  },
  updatePoWorkflow: async (id: string, data: Record<string, string>): Promise<PoWorkflow> => {
    const response = await apiClient.patch<PoWorkflow>(`/deals/po-workflow/${id}/`, compact(data))
    return response.data
  },
  deletePoWorkflow: async (id: string): Promise<void> => {
    await apiClient.delete(`/deals/po-workflow/${id}/`)
  },
  approvePoWorkflow: async (id: string): Promise<PoWorkflow> => {
    const response = await apiClient.post<PoWorkflow>(`/deals/po-workflow/${id}/approve/`)
    return response.data
  },
  listPoIssues: async (params?: { opportunity?: string; status?: 'OPEN' | 'RESOLVED' }): Promise<PoDocumentIssue[]> => {
    const response = await apiClient.get<PoDocumentIssue[]>('/deals/po-issues/', {
      params: { opportunity: params?.opportunity || undefined, status: params?.status || undefined },
    })
    return response.data
  },
  poIssueReasons: async (): Promise<PoIssueReason[]> => {
    const response = await apiClient.get<PoIssueReason[]>('/deals/po-issues/reasons/')
    return response.data
  },
  createPoIssue: async (data: {
    opportunity: string
    reasons: string[]
    attachment_ids: string[]
    note: string
  }): Promise<PoDocumentIssue> => {
    const response = await apiClient.post<PoDocumentIssue>('/deals/po-issues/', data)
    return response.data
  },
  resolvePoIssue: async (id: string, resolutionNote: string): Promise<PoDocumentIssue> => {
    const response = await apiClient.post<PoDocumentIssue>(`/deals/po-issues/${id}/resolve/`, {
      resolution_note: resolutionNote,
    })
    return response.data
  },
  exportPoWorkflow: async (): Promise<Blob> => {
    const response = await apiClient.get('/deals/po-workflow/export/', { responseType: 'blob' })
    return response.data
  },
  poWorkflowTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get('/deals/po-workflow/template/', { responseType: 'blob' })
    return response.data
  },
  importPoWorkflow: async (file: File): Promise<PulseImportResult> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<PulseImportResult>('/deals/po-workflow/import/', form)
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