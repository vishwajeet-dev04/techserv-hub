import apiClient from './client'
import type { LoginRequest, AuthTokens, User } from '../types'

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthTokens> => {
    const response = await apiClient.post<AuthTokens>('/auth/login/', credentials)
    return response.data
  },
  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post('/auth/logout/', { refresh: refreshToken })
  },
  me: async (): Promise<User> => {
    const response = await apiClient.get<User | { user: User }>('/auth/me/')
    const payload = response.data
    if (payload && typeof payload === 'object' && 'user' in payload && payload.user) {
      return payload.user
    }
    return payload as User
  },
}