import apiClient from './client'
import type { DashboardData } from '../types'

export const dashboardApi = {
  getSummary: async (): Promise<DashboardData> => {
    const response = await apiClient.get<DashboardData>('/dashboard/')
    return response.data
  },
}