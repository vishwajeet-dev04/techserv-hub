import apiClient from './client'
import type { DashboardAlertsResponse, DashboardData } from '../types'

export const dashboardApi = {
  getSummary: async (): Promise<DashboardData> => {
    const response = await apiClient.get<DashboardData>('/dashboard/')
    return response.data
  },
  getAlerts: async (): Promise<DashboardAlertsResponse> => {
    const response = await apiClient.get<DashboardAlertsResponse>('/dashboard/alerts/')
    return response.data
  },
}
