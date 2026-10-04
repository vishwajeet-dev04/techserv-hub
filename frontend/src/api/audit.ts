import apiClient from './client'
import type { ImportLogDetail, ImportLogEntry, ImportModule, PaginatedResponse } from '../types'

export const auditApi = {
  listImports: async (module: ImportModule, page = 1): Promise<PaginatedResponse<ImportLogEntry>> => {
    const response = await apiClient.get<PaginatedResponse<ImportLogEntry>>('/audit/imports/', {
      params: { module, page },
    })
    return response.data
  },
  getImport: async (id: string): Promise<ImportLogDetail> => {
    const response = await apiClient.get<ImportLogDetail>(`/audit/imports/${id}/`)
    return response.data
  },
  downloadImportFile: async (id: string): Promise<Blob> => {
    const response = await apiClient.get<Blob>(`/audit/imports/${id}/file/`, { responseType: 'blob' })
    return response.data
  },
}
