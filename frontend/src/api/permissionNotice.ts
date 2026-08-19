const PERMISSION_EVENT = 'techserv:permission-denied'
export const PERMISSION_DENIED_MESSAGE = "You don't have permission to access this"

export function emitPermissionDenied(): void {
  window.dispatchEvent(new CustomEvent(PERMISSION_EVENT, { detail: PERMISSION_DENIED_MESSAGE }))
}

export function onPermissionDenied(handler: (message: string) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail
    handler(detail || PERMISSION_DENIED_MESSAGE)
  }
  window.addEventListener(PERMISSION_EVENT, listener)
  return () => window.removeEventListener(PERMISSION_EVENT, listener)
}
