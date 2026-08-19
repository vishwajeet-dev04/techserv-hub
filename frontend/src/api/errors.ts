import axios from 'axios'

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { message?: string } | undefined
    if (payload?.message) return payload.message
  }
  return fallback
}
