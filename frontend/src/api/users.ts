import apiClient from './client'
import type { PaginatedResponse, User, UserRole } from '../types'

export type UserStatusFilter = 'active' | 'inactive' | 'all'

interface UserListFilters {
  page?: number
  page_size?: number
  status?: UserStatusFilter
}

export interface UserCreatePayload {
  name: string
  email: string
  password: string
  role: UserRole
}

export const usersApi = {
  list: async (filters: UserListFilters = {}): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>('/users/', { params: filters })
    return response.data
  },
  create: async (data: UserCreatePayload): Promise<User> => {
    const response = await apiClient.post<User>('/users/', data)
    return response.data
  },
  update: async (id: string, data: Partial<Pick<User, 'name' | 'email' | 'role' | 'is_active'>>): Promise<User> => {
    const response = await apiClient.patch<User>(`/users/${id}/`, data)
    return response.data
  },
  deactivate: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}/`)
  },
  setPassword: async (id: string, newPassword: string): Promise<void> => {
    await apiClient.post(`/users/${id}/set-password/`, { new_password: newPassword })
  },
}
