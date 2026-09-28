import toast from 'react-hot-toast'

const style = {
  background: 'var(--color-surface)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-line)',
  borderRadius: '12px',
  fontSize: '13px',
}

export const notify = {
  success(message: string) {
    toast.success(message, { style, duration: 4000 })
  },
  error(message: string) {
    toast.error(message, { style, duration: 4000 })
  },
  info(message: string) {
    toast(message, { style, duration: 4000 })
  },
}
