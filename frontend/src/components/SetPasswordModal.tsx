import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { usersApi } from '../api/users'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import type { User } from '../types'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from './Modal'

interface Props {
  open: boolean
  user: User | null
  onClose: () => void
}

export default function SetPasswordModal({ open, user, onClose }: Props) {
  if (!open || !user) return null
  return <SetPasswordDialog key={user.id} user={user} onClose={onClose} />
}

function SetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => usersApi.setPassword(user.id, password),
    onSuccess: () => {
      notify.success(`Password updated. ${user.name} must sign in again.`)
      onClose()
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not set the password.')
      setError(message)
      notify.error(message)
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    mutation.mutate()
  }

  const handleClose = () => {
    if (!mutation.isPending) onClose()
  }

  return (
    <Modal
      open
      title={`Set password: ${user.name}`}
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} className={btnSecondaryClass}>Cancel</button>
          <button type="submit" form="set-password-form" disabled={mutation.isPending} className={btnPrimaryClass}>
            {mutation.isPending ? 'Saving...' : 'Set password'}
          </button>
        </>
      }
    >
      <form id="set-password-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          The new password replaces the old one and signs {user.email} out of every device.
        </p>
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
            <p className="text-sm text-danger">{error}</p>
          </div>
        ) : null}
        <div>
          <label htmlFor="new-password" className={labelClass}>New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className={labelClass}>Confirm password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className={fieldClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </div>
      </form>
    </Modal>
  )
}
