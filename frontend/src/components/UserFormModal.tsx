import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import type { User, UserRole } from '../types'
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
  /** When set, the modal edits this user instead of creating a new one. */
  user?: User | null
  isSelf?: boolean
}

export default function UserFormModal(props: UserFormModalProps) {
  if (!props.open) return null
  return <UserFormDialog key={props.user?.id ?? 'new'} {...props} />
}

function UserFormDialog({ open, onClose, user, isSelf = false }: UserFormModalProps) {
  const queryClient = useQueryClient()
  const editing = Boolean(user)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'VIEWER')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (user) {
        await usersApi.update(user.id, { name: name.trim(), email: email.trim(), role, is_active: isActive })
        return
      }
      await usersApi.create({ name: name.trim(), email: email.trim(), password, role })
    },
    onSuccess: async () => {
      notify.success(editing ? 'User updated.' : 'User created.')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      if (isSelf) await queryClient.invalidateQueries({ queryKey: ['me'] })
      onClose()
    },
    onError: (err) => {
      const message = getErrorMessage(err, editing ? 'Could not update user.' : 'Could not create user.')
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
    if (!editing && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    mutation.mutate()
  }

  const handleClose = () => {
    if (!mutation.isPending) onClose()
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Edit User' : 'Add User'}
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
          {editing ? (
            <p className="mt-1 text-xs text-subtle">Imported opportunities assigned to this exact name link to the user.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="user-email" className={labelClass}>Email</label>
          <input id="user-email" type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        {editing ? null : (
          <div>
            <label htmlFor="user-password" className={labelClass}>Password</label>
            <input
              id="user-password"
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-subtle">At least 8 characters; avoid common passwords or ones close to the name or email.</p>
          </div>
        )}

        <div>
          <label htmlFor="user-role" className={labelClass}>Role</label>
          <select
            id="user-role"
            className={fieldClass}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={isSelf}
          >
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isSelf ? <p className="mt-1 text-xs text-subtle">You cannot change your own role.</p> : null}
        </div>

        {editing && !isSelf ? (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active (can sign in)
          </label>
        ) : null}
      </form>
    </Modal>
  )
}
