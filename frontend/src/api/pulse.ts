import apiClient from './client'
import type {
  PaginatedResponse,
  PulseContact,
  PulseImportResult,
  PulseOpportunity,
  PulseOpportunityActivity,
  PulseOpsUpdate,
  PulsePipelineDashboard,
  PulseReminder,
  PulseSettings,
  PulseSummary,
  PulseTeamDashboard,
  PulseExecutiveDashboard,
  PulseAssignee,
} from '../types'

function compact(data: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== ''))
}

export const pulseApi = {
  summary: async (): Promise<PulseSummary> => {
    const response = await apiClient.get<PulseSummary>('/pulse/summary/')
    return response.data
  },
  pipeline: async (params?: { from?: string; to?: string }): Promise<PulsePipelineDashboard> => {
    const response = await apiClient.get<PulsePipelineDashboard>('/pulse/pipeline/', {
      params: {
        from: params?.from || undefined,
        to: params?.to || undefined,
      },
    })
    return response.data
  },
  team: async (params?: { from?: string; to?: string }): Promise<PulseTeamDashboard> => {
    const response = await apiClient.get<PulseTeamDashboard>('/pulse/team/', {
      params: {
        from: params?.from || undefined,
        to: params?.to || undefined,
      },
    })
    return response.data
  },
  executive: async (params?: { from?: string; to?: string }): Promise<PulseExecutiveDashboard> => {
    const response = await apiClient.get<PulseExecutiveDashboard>('/pulse/executive/', {
      params: {
        from: params?.from || undefined,
        to: params?.to || undefined,
      },
    })
    return response.data
  },
  settings: async (): Promise<PulseSettings> => {
    const response = await apiClient.get<PulseSettings>('/pulse/settings/')
    return response.data
  },
  listAssignees: async (): Promise<PulseAssignee[]> => {
    const response = await apiClient.get<PulseAssignee[]>('/pulse/assignees/')
    return response.data
  },
  listContacts: async (search?: string): Promise<PaginatedResponse<PulseContact>> => {
    const response = await apiClient.get<PaginatedResponse<PulseContact>>('/pulse/contacts/', {
      params: { search, page_size: 200 },
    })
    return response.data
  },
  createContact: async (data: Record<string, string>): Promise<PulseContact> => {
    const response = await apiClient.post<PulseContact>('/pulse/contacts/', compact(data))
    return response.data
  },
  updateContact: async (id: string, data: Record<string, string>): Promise<PulseContact> => {
    const response = await apiClient.patch<PulseContact>(`/pulse/contacts/${id}/`, data)
    return response.data
  },
  deleteContact: async (id: string): Promise<void> => {
    await apiClient.delete(`/pulse/contacts/${id}/`)
  },
  exportContacts: async (): Promise<Blob> => {
    const response = await apiClient.get('/pulse/contacts/export/', { responseType: 'blob' })
    return response.data
  },
  contactTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get('/pulse/contacts/template/', { responseType: 'blob' })
    return response.data
  },
  importContacts: async (file: File): Promise<PulseImportResult> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<PulseImportResult>('/pulse/contacts/import/', form)
    return response.data
  },
  listOpportunities: async (params?: {
    search?: string
    stage?: string
  }): Promise<PaginatedResponse<PulseOpportunity>> => {
    const response = await apiClient.get<PaginatedResponse<PulseOpportunity>>('/pulse/opportunities/', {
      params: { ...params, page_size: 200 },
    })
    return response.data
  },
  createOpportunity: async (data: Record<string, string>): Promise<PulseOpportunity> => {
    const response = await apiClient.post<PulseOpportunity>('/pulse/opportunities/', compact(data))
    return response.data
  },
  updateOpportunity: async (
    id: string,
    data: Record<string, string> | FormData,
  ): Promise<PulseOpportunity> => {
    if (data instanceof FormData) {
      const response = await apiClient.patch<PulseOpportunity>(`/pulse/opportunities/${id}/`, data)
      return response.data
    }
    const response = await apiClient.patch<PulseOpportunity>(`/pulse/opportunities/${id}/`, compact(data))
    return response.data
  },
  addOpportunityDocuments: async (id: string, files: File[], note: string): Promise<PulseOpportunityActivity> => {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    form.append('note', note)
    const response = await apiClient.post<PulseOpportunityActivity>(`/pulse/opportunities/${id}/documents/`, form)
    return response.data
  },
  listOpportunityActivities: async (id: string): Promise<PulseOpportunityActivity[]> => {
    const response = await apiClient.get<PulseOpportunityActivity[] | PaginatedResponse<PulseOpportunityActivity>>(
      `/pulse/opportunities/${id}/activities/`,
    )
    const data = response.data
    return Array.isArray(data) ? data : data.results ?? []
  },
  listOpsUpdates: async (limit = 50): Promise<PulseOpsUpdate[]> => {
    const response = await apiClient.get<PulseOpsUpdate[] | PaginatedResponse<PulseOpsUpdate>>(
      '/pulse/ops-updates/',
      { params: { limit } },
    )
    const data = response.data
    return Array.isArray(data) ? data : data.results ?? []
  },
  deleteOpportunity: async (id: string): Promise<void> => {
    await apiClient.delete(`/pulse/opportunities/${id}/`)
  },
  exportOpportunities: async (): Promise<Blob> => {
    const response = await apiClient.get('/pulse/opportunities/export/', { responseType: 'blob' })
    return response.data
  },
  opportunityTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get('/pulse/opportunities/template/', { responseType: 'blob' })
    return response.data
  },
  importOpportunities: async (file: File): Promise<PulseImportResult> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<PulseImportResult>('/pulse/opportunities/import/', form)
    return response.data
  },
  listReminders: async (params?: {
    search?: string
    status?: string
    reminder_type?: string
  }): Promise<PaginatedResponse<PulseReminder>> => {
    const response = await apiClient.get<PaginatedResponse<PulseReminder>>('/pulse/reminders/', {
      params: { ...params, page_size: 100 },
    })
    return response.data
  },
  createReminder: async (data: Record<string, string>): Promise<PulseReminder> => {
    const response = await apiClient.post<PulseReminder>('/pulse/reminders/', compact(data))
    return response.data
  },
  updateReminder: async (id: string, data: Record<string, string>): Promise<PulseReminder> => {
    const response = await apiClient.patch<PulseReminder>(`/pulse/reminders/${id}/`, data)
    return response.data
  },
  markReminderDone: async (id: string): Promise<PulseReminder> => {
    const response = await apiClient.post<PulseReminder>(`/pulse/reminders/${id}/done/`)
    return response.data
  },
  deleteReminder: async (id: string): Promise<void> => {
    await apiClient.delete(`/pulse/reminders/${id}/`)
  },
  previewAttachment: async (
    id: string,
  ): Promise<{ kind: 'table'; rows: string[][] } | { kind: 'text'; text: string }> => {
    const response = await apiClient.get(`/pulse/attachments/${id}/preview/`)
    return response.data
  },
}
