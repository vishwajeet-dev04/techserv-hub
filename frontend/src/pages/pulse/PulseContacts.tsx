import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pulseApi } from '../../api/pulse'
import { getErrorMessage } from '../../api/errors'
import Modal, { btnPrimaryClass, btnRowDeleteClass, btnRowEditClass, fieldClass } from '../../components/Modal'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import PulseExcelBar from '../../components/PulseExcelBar'
import PulsePageHeader from '../../components/pulse/PulsePageHeader'
import PulseToolbar from '../../components/pulse/PulseToolbar'
import PulseTableShell, {
  PulseEmptyState,
  PulseLoadingRows,
  PulsePaginationFooter,
  PulseTableHead,
} from '../../components/pulse/PulseTableShell'
import {
  PulseContactFields,
  contactFromRow,
  emptyContactForm,
  type ContactFormValues,
} from '../../components/PulseContactFields'
import { rememberCustomValue } from '../../lib/pulseRecent'
import { notify } from '../../lib/notify'
import {
  CITY_PRESETS,
  COUNTRY_PRESETS,
  DEPARTMENT_PRESETS,
  DESIGNATION_PRESETS,
  STATE_PRESETS,
} from '../../lib/pulsePresets'
import { normalizeContactForm, validateContactForm } from '../../lib/pulseValidation'
import type { PulseContact } from '../../types'

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PulseContacts() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PulseContact | null>(null)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ContactFormValues, string>>>({})
  const [form, setForm] = useState<ContactFormValues>(emptyContactForm)
  const [pendingDelete, setPendingDelete] = useState<PulseContact | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const list = useQuery({
    queryKey: ['pulse-contacts', search],
    queryFn: () => pulseApi.listContacts(search || undefined),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['pulse-contacts'] })
    await queryClient.invalidateQueries({ queryKey: ['pulse-summary'] })
    await queryClient.invalidateQueries({ queryKey: ['pulse-settings'] })
  }

  const save = useMutation({
    mutationFn: (payload: ContactFormValues) =>
      editing
        ? pulseApi.updateContact(editing.id, payload)
        : pulseApi.createContact(payload),
    onSuccess: async (_data, payload) => {
      rememberCustomValue('designation', payload.designation, DESIGNATION_PRESETS)
      rememberCustomValue('department', payload.department, DEPARTMENT_PRESETS)
      rememberCustomValue('country', payload.country, COUNTRY_PRESETS)
      rememberCustomValue('state', payload.state, STATE_PRESETS)
      rememberCustomValue('city', payload.city, CITY_PRESETS)
      await invalidate()
      closeForm()
      notify.success(editing ? 'Contact updated.' : 'Contact created.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, editing ? 'Could not update contact.' : 'Could not create contact.')
      setFormError(message)
      notify.error(message)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => pulseApi.deleteContact(id),
    onSuccess: async () => {
      await invalidate()
      setPendingDelete(null)
      setDeleteError('')
      notify.success('Contact deleted.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not delete contact.')
      setDeleteError(message)
      notify.error(message)
    },
  })

  const closeForm = () => {
    setOpen(false)
    setEditing(null)
    setForm(emptyContactForm)
    setFormError('')
    setFieldErrors({})
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyContactForm)
    setFormError('')
    setFieldErrors({})
    setOpen(true)
  }

  const openEdit = (row: PulseContact) => {
    setEditing(row)
    setForm(contactFromRow(row))
    setFormError('')
    setFieldErrors({})
    setOpen(true)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const errors = validateContactForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError('Fix the highlighted fields.')
      return
    }
    setFieldErrors({})
    if (save.isPending) return
    setFormError('')
    save.mutate()
  }

  const rows = list.data?.results ?? []
  useEffect(() => {
    setPage(1)
  }, [search, pageSize])
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page, pageSize])
  const headers = [
    'ID', 'Company Name', 'Contact Name', 'Designation', 'Department', 'Contact Email',
    'Company Email', 'Phone', 'Address_1', 'City', 'State', 'Country', 'GST Number', 'Created At', '',
  ]

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PulsePageHeader
        title="Contacts"
        subtitle="Manage your customer relationships."
        actions={
          <>
            <PulseExcelBar
              templateName="pulse-contacts-template.xlsx"
              exportName="pulse-contacts.xlsx"
              onTemplate={pulseApi.contactTemplate}
              onExport={pulseApi.exportContacts}
              onImport={pulseApi.importContacts}
              onImported={() => void invalidate()}
            />
            <button type="button" onClick={openCreate} className={btnPrimaryClass}>
              + Add Contact
            </button>
          </>
        }
      />

      <PulseToolbar>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts, company or email..."
          className={`${fieldClass} md:max-w-md`}
        />
      </PulseToolbar>

      {list.isLoading ? (
        <PulseLoadingRows />
      ) : list.isError ? (
        <p className="mt-6 text-sm text-danger">{getErrorMessage(list.error)}</p>
      ) : rows.length === 0 ? (
        <PulseEmptyState
          message="No contacts yet. Add one or import from Excel."
          action={
            <button type="button" onClick={openCreate} className={btnPrimaryClass}>
              + Add Contact
            </button>
          }
        />
      ) : (
        <PulseTableShell
          minWidth="min-w-[1400px]"
          title="Contacts"
          count={rows.length}
          footer={
            <PulsePaginationFooter
              page={page}
              pageSize={pageSize}
              total={rows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
            <PulseTableHead>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">{h}</th>
                ))}
            </PulseTableHead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b border-canvas hover:bg-canvas/60">
                  <td className="px-3 py-3 font-mono text-[11px] text-muted">{row.id.slice(0, 8)}</td>
                  <td className="px-3 py-3 text-muted">{row.company_name}</td>
                  <td className="px-3 py-3 font-medium">{row.name}</td>
                  <td className="px-3 py-3 text-muted">{row.designation || '—'}</td>
                  <td className="px-3 py-3 text-muted">{row.department}</td>
                  <td className="px-3 py-3 text-muted">{row.email}</td>
                  <td className="px-3 py-3 text-muted">{row.company_email || '—'}</td>
                  <td className="px-3 py-3 text-muted">{row.phone}</td>
                  <td className="px-3 py-3 text-muted">{row.address_1 || '—'}</td>
                  <td className="px-3 py-3 text-muted">{row.city}</td>
                  <td className="px-3 py-3 text-muted">{row.state}</td>
                  <td className="px-3 py-3 text-muted">{row.country}</td>
                  <td className="px-3 py-3 text-muted">{row.gst_number || '—'}</td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{formatWhen(row.created_at)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button type="button" className={btnRowEditClass} onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={btnRowDeleteClass}
                        disabled={remove.isPending}
                        onClick={() => {
                          setDeleteError('')
                          setPendingDelete(row)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
        </PulseTableShell>
      )}

      <Modal
        open={open}
        title={editing ? 'Edit Contact' : 'Add New Contact'}
        onClose={() => !save.isPending && closeForm()}
        wide
        footer={
          <button type="submit" form="pulse-contact-form" disabled={save.isPending} className={btnPrimaryClass}>
            {save.isPending ? 'Saving…' : editing ? 'Update Contact' : 'Create Contact'}
          </button>
        }
      >
        <form id="pulse-contact-form" onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-3">
          {formError ? <p className="sm:col-span-2 text-sm text-danger">{formError}</p> : null}
          <PulseContactFields
            form={form}
            errors={fieldErrors}
            onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
          />
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        title="Delete contact"
        message={
          pendingDelete
            ? `Delete contact ${pendingDelete.name} at ${pendingDelete.company_name}? This cannot be undone.`
            : ''
        }
        pending={remove.isPending}
        error={deleteError}
        onCancel={() => {
          if (remove.isPending) return
          setPendingDelete(null)
          setDeleteError('')
        }}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  )
}
