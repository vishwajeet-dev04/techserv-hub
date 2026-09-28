import type { QueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'

/** Clear local session and hard-navigate to login so auth state cannot stick. */
export async function endSession(queryClient: QueryClient): Promise<void> {
  const refresh = localStorage.getItem('refresh_token')
  const access = localStorage.getItem('access_token')

  if (refresh && access) {
    try {
      await authApi.logout(refresh)
    } catch {
      // Blacklist is best-effort; always clear local session.
    }
  }

  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  queryClient.clear()
  window.location.assign('/login')
}
