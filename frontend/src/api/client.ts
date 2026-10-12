import axios from 'axios'
import { emitPermissionDenied } from './permissionNotice'
import { clearWorkspace, getWorkspace } from '../lib/workspaces'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const workspace = getWorkspace()
  config.headers['X-Workspace-Company'] = workspace?.company ?? 'techserv'
  config.headers['X-Workspace-Region'] = workspace?.region ?? 'india'
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const requestUrl = String(error.config?.url ?? '')
    const skipAuthRedirect =
      requestUrl.includes('/auth/login/') || requestUrl.includes('/auth/logout/')
    if (status === 403) {
      emitPermissionDenied()
    } else if (status === 401 && !skipAuthRedirect) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      clearWorkspace()
      window.location.assign('/login')
    }
    return Promise.reject(error)
  }
)

export default apiClient
