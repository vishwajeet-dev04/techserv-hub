import apiClient from './client'
import type { Company, Contact, PaginatedResponse } from '../types'

interface CompanyFilters {
  search?: string
  status?: string
  page?: number
  page_size?: number
}

export interface ContactCreatePayload {
  first_name: string
  last_name: string
  designation?: string
  email?: string
  phone?: string
  linkedin_url?: string
  notes?: string
}

export const companiesApi = {
  list: async (filters: CompanyFilters = {}): Promise<PaginatedResponse<Company>> => {
    const response = await apiClient.get<PaginatedResponse<Company>>('/companies/', { params: filters })
    return response.data
  },
  get: async (id: string): Promise<Company> => {
    const response = await apiClient.get<Company>(`/companies/${id}/`)
    return response.data
  },
  create: async (data: Partial<Company>): Promise<Company> => {
    const response = await apiClient.post<Company>('/companies/', data)
    return response.data
  },
  update: async (id: string, data: Partial<Company>): Promise<Company> => {
    const response = await apiClient.patch<Company>(`/companies/${id}/`, data)
    return response.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/companies/${id}/`)
  },
  createContact: async (companyId: string, data: ContactCreatePayload): Promise<Contact> => {
    const response = await apiClient.post<Contact>(`/companies/${companyId}/contacts/`, data)
    return response.data
  },
}
