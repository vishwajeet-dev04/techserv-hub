import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import type { UserRole } from '../types'
import Modal, { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from './Modal'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'SALES', label: 'Sales' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'VIEWER', label: 'Viewer' },
]

interface UserFormModalProps {
  open: boolean
  onClose: () => void
}

export default function UserFormModal({ open, onClose }: UserFormModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('VIEWER')
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setEmail('')
    setPassword('')
    setRole('VIEWER')
    setError('')
  }

  const mutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      }),
    onSuccess: async () => {
      notify.success('User created.')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      reset()
      onClose()
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not create user.')
      setError(message)
      notify.error(message)
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    mutation.mutate()
  }

  const handleClose = () => {
    if (!mutation.isPending) {
      reset()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      title="Add User"
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} className={btnSecondaryClass}>Cancel</button>
          <button type="submit" form="user-form" disabled={mutation.isPending} className={btnPrimaryClass}>
            {mutation.isPending ? 'Saving...' : 'Save User'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
            <p className="text-sm text-danger">{error}</p>
          </div>
        ) : null}

        <div>
          <label htmlFor="user-name" className={labelClass}>Name</label>
          <input id="user-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="user-email" className={labelClass}>Email</label>
          <input id="user-email" type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="user-password" className={labelClass}>Password</label>
          <input id="user-password" type="password" className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </div>

        <div>
          <label htmlFor="user-role" className={labelClass}>Role</label>
          <select id="user-role" className={fieldClass} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  )
}
