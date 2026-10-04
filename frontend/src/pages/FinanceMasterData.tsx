import { useDeferredValue, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
import Modal, {
  btnPrimaryClass,
  btnRowDeleteClass,
  btnRowEditClass,
  fieldClass,
  labelClass,
} from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import PulseExcelBar from '../components/PulseExcelBar'
import PulsePageHeader from '../components/pulse/PulsePageHeader'
import PulseToolbar from '../components/pulse/PulseToolbar'
import PulseTableShell, {
  PulseEmptyState,
  PulseLoadingRows,
  PulsePaginationFooter,
  PulseTableHead,
} from '../components/pulse/PulseTableShell'
import { useAuth } from '../hooks/useAuth'
import { fmtInr } from '../lib/format'
import { notify } from '../lib/notify'
import type {
  FinanceClient,
  FinanceVendor,
  MasterDataListParams,
  PaginatedResponse,
  ImportModule,
  PulseImportResult,
} from '../types'

type FormValues = Record<string, string | boolean>
type FieldErrors = Record<string, string>
type ActiveFilter = 'true' | 'false' | ''

interface MasterRow {
  id: string
  name: string
  email: string
  mobile: string
  pan: string
  gstin: string
  msme_registered: boolean
  is_active: boolean
}

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'checkbox'
  placeholder?: string
  wide?: boolean
  upper?: boolean
  maxLength?: number
  /** Static suggestions, merged with values already used in the list. */
  options?: string[]
  suggest?: boolean
  showIf?: (form: FormValues) => boolean
}

interface Column<T> {
  header: string
  align?: 'right'
  render: (row: T) => ReactNode
}

interface MasterConfig<T extends MasterRow> {
  queryKey: string
  title: string
  subtitle: string
  noun: string
  searchPlaceholder: string
  templateName: string
  exportName: string
  minWidth: string
  list: (params: MasterDataListParams) => Promise<PaginatedResponse<T>>
  create: (data: Partial<T>) => Promise<T>
  update: (id: string, data: Partial<T>) => Promise<T>
  remove: (id: string) => Promise<void>
  exportFile: () => Promise<Blob>
  templateFile: () => Promise<Blob>
  importFile: (file: File) => Promise<PulseImportResult>
  importModule: ImportModule
  sections: { title: string; fields: FieldDef[] }[]
  columns: Column<T>[]
  cardSubtitle: (row: T) => string
  cardStats: (row: T) => { label: string; value: string }[]
  validate?: (form: FormValues) => FieldErrors
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const MOBILE_RE = /^(?:\+?91)?\d{10}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const NUMBER_FIELDS = new Set(['tds_rate', 'payment_terms_days'])
const TDS_SECTIONS = ['194C', '194J', '194I', '194H', '194Q', '194A', '194O', '195']

const ACTIVE_FILTERS: { value: ActiveFilter; label: string }[] = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
  { value: '', label: 'All' },
]

function allFields<T extends MasterRow>(config: MasterConfig<T>) {
  return config.sections.flatMap((section) => section.fields)
}

function emptyForm<T extends MasterRow>(config: MasterConfig<T>): FormValues {
  const form: FormValues = {}
  for (const field of allFields(config)) {
    form[field.key] = field.type === 'checkbox' ? field.key === 'is_active' : ''
  }
  return form
}

function formFromRow<T extends MasterRow>(config: MasterConfig<T>, row: T): FormValues {
  const source = row as unknown as Record<string, unknown>
  const form: FormValues = {}
  for (const field of allFields(config)) {
    const value = source[field.key]
    form[field.key] = field.type === 'checkbox' ? Boolean(value) : value == null ? '' : String(value)
  }
  return form
}

function toPayload(form: FormValues): Record<string, string | boolean | number | null> {
  const payload: Record<string, string | boolean | number | null> = {}
  for (const [key, value] of Object.entries(form)) {
    if (typeof value === 'boolean') {
      payload[key] = value
    } else if (NUMBER_FIELDS.has(key)) {
      payload[key] = value.trim() === '' ? null : Number(value)
    } else {
      payload[key] = value.trim()
    }
  }
  return payload
}

function validateCommon(form: FormValues): FieldErrors {
  const errors: FieldErrors = {}
  const text = (key: string) => String(form[key] ?? '').trim()
  if (!text('name')) errors.name = 'Name is required.'
  if (text('email') && !EMAIL_RE.test(text('email'))) errors.email = 'Enter a valid email address.'
  const mobile = text('mobile').replace(/[\s\-()]/g, '')
  if (mobile && !MOBILE_RE.test(mobile)) errors.mobile = '10 digits, optionally with +91.'
  if (text('pan') && !PAN_RE.test(text('pan').toUpperCase())) errors.pan = 'Format: ABCDE1234F'
  if (text('gstin') && !GSTIN_RE.test(text('gstin').toUpperCase())) errors.gstin = 'Format: 29ABCDE1234F1Z5'
  if (text('ifsc') && !IFSC_RE.test(text('ifsc').toUpperCase())) errors.ifsc = 'Format: HDFC0001234'
  for (const key of NUMBER_FIELDS) {
    if (text(key) && Number.isNaN(Number(text(key)))) errors[key] = 'Enter a number.'
  }
  return errors
}

function serverFieldErrors(err: unknown): FieldErrors {
  if (!axios.isAxiosError(err)) return {}
  const details = (err.response?.data as { details?: Record<string, unknown> } | undefined)?.details
  if (!details) return {}
  const errors: FieldErrors = {}
  for (const [key, value] of Object.entries(details)) {
    errors[key] = Array.isArray(value) ? String(value[0]) : String(value)
  }
  return errors
}

function Pill({ tone, children }: { tone: 'success' | 'muted' | 'info'; children: ReactNode }) {
  const tones = {
    success: 'bg-success-soft text-success',
    info: 'bg-info-soft text-info',
    muted: 'bg-canvas text-muted border border-line',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

function Dash() {
  return <span className="text-subtle">—</span>
}

function money(value: number) {
  return value ? fmtInr(value) : <Dash />
}

function MasterDataPage<T extends MasterRow>({ config }: { config: MasterConfig<T> }) {
  const queryClient = useQueryClient()
  const { isAdmin, isFinance, isManagement } = useAuth()
  const canWrite = isAdmin || isFinance || isManagement
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [active, setActive] = useState<ActiveFilter>('true')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [form, setForm] = useState<FormValues>(() => emptyForm(config))
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pendingDelete, setPendingDelete] = useState<T | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const list = useQuery({
    queryKey: [config.queryKey, deferredSearch, active],
    queryFn: () => config.list({ search: deferredSearch || undefined, active }),
  })
  const rows = useMemo(() => list.data?.results ?? [], [list.data])
  const total = list.data?.count ?? rows.length
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize])

  const suggestions = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const field of allFields(config)) {
      if (!field.suggest && !field.options) continue
      const values = new Set(field.options ?? [])
      if (field.suggest) {
        for (const row of rows) {
          const value = (row as unknown as Record<string, unknown>)[field.key]
          if (typeof value === 'string' && value.trim()) values.add(value.trim())
        }
      }
      map[field.key] = [...values].sort()
    }
    return map
  }, [config, rows])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.queryKey] })

  const closeForm = () => {
    setOpen(false)
    setEditing(null)
    setForm(emptyForm(config))
    setFormError('')
    setFieldErrors({})
  }

  const save = useMutation({
    mutationFn: (payload: Partial<T>) => (editing ? config.update(editing.id, payload) : config.create(payload)),
    onSuccess: async () => {
      await invalidate()
      notify.success(editing ? `${config.noun} updated.` : `${config.noun} created.`)
      closeForm()
    },
    onError: (err) => {
      const message = getErrorMessage(err, `Could not save ${config.noun.toLowerCase()}.`)
      const errors = serverFieldErrors(err)
      setFieldErrors(errors)
      setFormError(Object.keys(errors).length ? 'Fix the highlighted fields.' : message)
      notify.error(message)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => config.remove(id),
    onSuccess: async () => {
      await invalidate()
      setPendingDelete(null)
      setDeleteError('')
      notify.success(`${config.noun} deleted.`)
    },
    onError: (err) => {
      const message = getErrorMessage(err, `Could not delete ${config.noun.toLowerCase()}.`)
      setDeleteError(message)
      notify.error(message)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(config))
    setFormError('')
    setFieldErrors({})
    setOpen(true)
  }

  const openEdit = (row: T) => {
    setEditing(row)
    setForm(formFromRow(config, row))
    setFormError('')
    setFieldErrors({})
    setOpen(true)
  }

  const setField = (key: string, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'gstin' && typeof value === 'string') {
        const gstin = value.trim().toUpperCase()
        if (GSTIN_RE.test(gstin) && !String(prev.pan ?? '').trim()) next.pan = gstin.slice(2, 12)
      }
      return next
    })
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (save.isPending) return
    const errors = { ...validateCommon(form), ...(config.validate?.(form) ?? {}) }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError('Fix the highlighted fields.')
      return
    }
    setFieldErrors({})
    setFormError('')
    save.mutate(toPayload(form) as unknown as Partial<T>)
  }

  const askDelete = (row: T) => {
    setDeleteError('')
    setPendingDelete(row)
  }

  const nameCell = (row: T) => (
    <div className="flex items-center gap-2 min-w-0">
      <span className="font-medium text-ink truncate">{row.name}</span>
      {row.is_active ? null : <Pill tone="muted">Inactive</Pill>}
    </div>
  )

  const addButton = canWrite ? (
    <button type="button" onClick={openCreate} className={btnPrimaryClass}>
      + Add {config.noun}
    </button>
  ) : null

  const renderField = (field: FieldDef) => {
    if (field.showIf && !field.showIf(form)) return null
    const error = fieldErrors[field.key]
    const id = `md-${field.key}`
    const value = form[field.key]
    if (field.type === 'checkbox') {
      return (
        <label key={field.key} htmlFor={id} className="flex items-center gap-2.5 text-sm text-ink sm:pt-6 cursor-pointer">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setField(field.key, e.target.checked)}
            className="h-4 w-4 rounded accent-brand"
          />
          {field.label}
        </label>
      )
    }
    const listId = suggestions[field.key]?.length ? `${id}-options` : undefined
    const common = {
      id,
      value: String(value ?? ''),
      placeholder: field.placeholder,
      maxLength: field.maxLength,
      'aria-invalid': Boolean(error),
      className: `${fieldClass} ${field.upper ? 'uppercase placeholder:normal-case' : ''} ${error ? '!border-danger' : ''}`,
    }
    return (
      <div key={field.key} className={field.wide || field.type === 'textarea' ? 'sm:col-span-2' : ''}>
        <label htmlFor={id} className={labelClass}>
          {field.label}
        </label>
        {field.type === 'textarea' ? (
          <textarea {...common} rows={2} onChange={(e) => setField(field.key, e.target.value)} />
        ) : (
          <input
            {...common}
            type={field.type === 'number' ? 'text' : (field.type ?? 'text')}
            inputMode={field.type === 'number' ? 'decimal' : field.type === 'tel' ? 'tel' : undefined}
            list={listId}
            onChange={(e) => setField(field.key, e.target.value)}
          />
        )}
        {listId ? (
          <datalist id={listId}>
            {suggestions[field.key].map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        ) : null}
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    )
  }

  const headers = [...config.columns.map((column) => column), ...(canWrite ? [{ header: '', align: 'right' as const }] : [])]

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <PulsePageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <>
            <PulseExcelBar
              templateName={config.templateName}
              exportName={config.exportName}
              onTemplate={config.templateFile}
              onExport={config.exportFile}
              onImport={config.importFile}
              onImported={() => void invalidate()}
              readOnly={!canWrite}
              module={config.importModule}
              label={config.title}
            />
            {addButton}
          </>
        }
      />

      <PulseToolbar>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder={config.searchPlaceholder}
          aria-label={`Search ${config.title.toLowerCase()}`}
          className={`${fieldClass} md:max-w-md`}
        />
        <div role="group" aria-label="Status filter" className="inline-flex rounded-xl border border-line bg-canvas p-0.5 self-start">
          {ACTIVE_FILTERS.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={active === option.value}
              onClick={() => {
                setActive(option.value)
                setPage(1)
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                active === option.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PulseToolbar>

      {list.isLoading ? (
        <PulseLoadingRows />
      ) : list.isError ? (
        <p className="mt-6 text-sm text-danger">{getErrorMessage(list.error)}</p>
      ) : rows.length === 0 ? (
        <PulseEmptyState
          message={
            deferredSearch || active
              ? `No ${config.title.toLowerCase()} match these filters.`
              : `No ${config.title.toLowerCase()} yet. Add one or import from Excel.`
          }
          action={addButton}
        />
      ) : (
        <PulseTableShell
          minWidth={config.minWidth}
          title={config.title}
          count={total}
          mobileCards={pageRows.map((row) => (
            <div key={row.id} className="px-4 py-3.5 space-y-2">
              <div className="min-w-0">
                {nameCell(row)}
                <p className="text-xs text-muted truncate">{config.cardSubtitle(row) || '—'}</p>
              </div>
              <div className="text-xs space-y-1">
                {row.email ? (
                  <a href={`mailto:${row.email}`} className="block text-brand truncate">
                    {row.email}
                  </a>
                ) : null}
                {row.mobile ? (
                  <a href={`tel:${row.mobile}`} className="block text-muted">
                    {row.mobile}
                  </a>
                ) : null}
                <p className="text-subtle font-mono text-[11px] truncate">
                  {[row.pan && `PAN ${row.pan}`, row.gstin && `GST ${row.gstin}`].filter(Boolean).join(' · ') || 'No PAN / GSTIN'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {config.cardStats(row).map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-canvas px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-subtle">{stat.label}</p>
                    <p className="font-medium text-ink tabular-nums truncate">{stat.value}</p>
                  </div>
                ))}
              </div>
              {canWrite ? (
                <div className="flex gap-2 pt-0.5">
                  <button type="button" className={`${btnRowEditClass} !py-2`} onClick={() => openEdit(row)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${btnRowDeleteClass} !py-2`}
                    disabled={remove.isPending}
                    onClick={() => askDelete(row)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          footer={
            <PulsePaginationFooter
              page={page}
              pageSize={pageSize}
              total={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          }
        >
          <PulseTableHead>
            {headers.map((column, index) => (
              <th
                key={column.header || `col-${index}`}
                className={`px-3 py-3 font-medium whitespace-nowrap ${column.align === 'right' ? 'text-right' : ''} ${
                  index === 0 ? 'w-[260px]' : ''
                }`}
              >
                {column.header}
              </th>
            ))}
          </PulseTableHead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-b border-canvas hover:bg-canvas/60">
                <td className="px-3 py-3 w-[260px] max-w-[260px]" title={row.name}>
                  {nameCell(row)}
                </td>
                {config.columns.slice(1).map((column) => (
                  <td
                    key={column.header}
                    className={`px-3 py-3 text-muted whitespace-nowrap ${
                      column.align === 'right' ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {canWrite ? (
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button type="button" className={btnRowEditClass} onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={btnRowDeleteClass}
                        disabled={remove.isPending}
                        onClick={() => askDelete(row)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </PulseTableShell>
      )}

      <Modal
        open={open}
        title={editing ? `Edit ${config.noun}` : `Add ${config.noun}`}
        onClose={() => !save.isPending && closeForm()}
        wide
        footer={
          <button type="submit" form="master-data-form" disabled={save.isPending} className={btnPrimaryClass}>
            {save.isPending ? 'Saving…' : editing ? `Update ${config.noun}` : `Create ${config.noun}`}
          </button>
        }
      >
        <form id="master-data-form" onSubmit={onSubmit} noValidate className="space-y-5">
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          {config.sections.map((section) => (
            <fieldset key={section.title} className="space-y-3">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-subtle mb-2">
                {section.title}
              </legend>
              <div className="grid sm:grid-cols-2 gap-3">{section.fields.map(renderField)}</div>
            </fieldset>
          ))}
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        title={`Delete ${config.noun.toLowerCase()}`}
        message={
          pendingDelete
            ? `Delete ${pendingDelete.name} from master data? Ledger entries that mention this name are not affected.`
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

const msmeCell = (row: MasterRow) => (row.msme_registered ? <Pill tone="success">MSME</Pill> : <Dash />)
const monoCell = (value: string) => (value ? <span className="font-mono text-xs text-ink">{value}</span> : <Dash />)

const TAX_FIELDS: FieldDef[] = [
  { key: 'pan', label: 'PAN', placeholder: 'ABCDE1234F', upper: true, maxLength: 10 },
  { key: 'gstin', label: 'GSTN', placeholder: '29ABCDE1234F1Z5', upper: true, maxLength: 15 },
  { key: 'msme_registered', label: 'MSME registered', type: 'checkbox' },
  {
    key: 'msme_number',
    label: 'MSME / Udyam number',
    placeholder: 'UDYAM-KR-03-0012345',
    upper: true,
    showIf: (form) => Boolean(form.msme_registered),
  },
]

const clientConfig: MasterConfig<FinanceClient> = {
  queryKey: 'finance-master-clients',
  title: 'Clients',
  subtitle: 'Client master with tax details and billing totals from invoices and POs.',
  noun: 'Client',
  searchPlaceholder: 'Search name, service line, email, PAN or GSTN…',
  templateName: 'finance-clients-template.xlsx',
  exportName: 'finance-clients.xlsx',
  minWidth: 'min-w-[1180px]',
  list: financeApi.listClients,
  create: financeApi.createClient,
  update: financeApi.updateClient,
  remove: financeApi.deleteClient,
  exportFile: financeApi.exportClients,
  templateFile: financeApi.clientTemplate,
  importFile: financeApi.importClients,
  importModule: 'MASTER_CLIENTS',
  sections: [
    {
      title: 'Basic',
      fields: [
        { key: 'name', label: 'Client name', placeholder: 'Registered business name', wide: true },
        { key: 'service_line', label: 'Service line', placeholder: 'e.g. Managed Services', suggest: true },
        { key: 'contact_person', label: 'Contact person' },
        { key: 'email', label: 'Mail ID', type: 'email', placeholder: 'accounts@client.com' },
        { key: 'mobile', label: 'Mobile number', type: 'tel', placeholder: '9876543210' },
        { key: 'is_active', label: 'Active client', type: 'checkbox' },
      ],
    },
    { title: 'Tax & Compliance', fields: TAX_FIELDS },
    {
      title: 'Address & Terms',
      fields: [
        { key: 'billing_address', label: 'Billing address', type: 'textarea' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State', suggest: true },
        { key: 'payment_terms_days', label: 'Payment terms (days)', type: 'number', placeholder: '30' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
  ],
  columns: [
    { header: 'Name', render: (row) => row.name },
    { header: 'Service Line', render: (row) => row.service_line || <Dash /> },
    { header: 'Email', render: (row) => row.email || <Dash /> },
    { header: 'Mobile', render: (row) => row.mobile || <Dash /> },
    { header: 'PAN', render: (row) => monoCell(row.pan) },
    { header: 'GSTN', render: (row) => monoCell(row.gstin) },
    { header: 'MSME', render: msmeCell },
    { header: 'Active POs', align: 'right', render: (row) => row.active_pos || <Dash /> },
    { header: 'Invoiced', align: 'right', render: (row) => money(row.total_invoiced) },
    { header: 'Paid', align: 'right', render: (row) => money(row.total_paid) },
  ],
  cardSubtitle: (row) => [row.service_line, row.msme_registered ? 'MSME' : ''].filter(Boolean).join(' · '),
  cardStats: (row) => [
    { label: 'Active POs', value: String(row.active_pos) },
    { label: 'Invoiced', value: fmtInr(row.total_invoiced) },
    { label: 'Paid', value: fmtInr(row.total_paid) },
  ],
}

const vendorConfig: MasterConfig<FinanceVendor> = {
  queryKey: 'finance-master-vendors',
  title: 'Vendors',
  subtitle: 'Vendor master with MSME, TDS and bank details, with totals from payables.',
  noun: 'Vendor',
  searchPlaceholder: 'Search name, category, email, PAN or GSTN…',
  templateName: 'finance-vendors-template.xlsx',
  exportName: 'finance-vendors.xlsx',
  minWidth: 'min-w-[1120px]',
  list: financeApi.listVendors,
  create: financeApi.createVendor,
  update: financeApi.updateVendor,
  remove: financeApi.deleteVendor,
  exportFile: financeApi.exportVendors,
  templateFile: financeApi.vendorTemplate,
  importFile: financeApi.importVendors,
  importModule: 'MASTER_VENDORS',
  sections: [
    {
      title: 'Basic',
      fields: [
        { key: 'name', label: 'Vendor name', placeholder: 'Registered business name', wide: true },
        { key: 'category', label: 'Category', placeholder: 'e.g. Rent, Software', suggest: true },
        { key: 'contact_person', label: 'Contact person' },
        { key: 'email', label: 'Mail ID', type: 'email', placeholder: 'billing@vendor.com' },
        { key: 'mobile', label: 'Mobile number', type: 'tel', placeholder: '9876543210' },
        { key: 'is_active', label: 'Active vendor', type: 'checkbox' },
      ],
    },
    {
      title: 'Tax & Compliance',
      fields: [
        ...TAX_FIELDS,
        { key: 'tds_applicable', label: 'TDS applicable', type: 'checkbox' },
        {
          key: 'tds_section',
          label: 'TDS section',
          placeholder: '194C',
          upper: true,
          options: TDS_SECTIONS,
          showIf: (form) => Boolean(form.tds_applicable),
        },
        {
          key: 'tds_rate',
          label: 'TDS rate (%)',
          type: 'number',
          placeholder: '10',
          showIf: (form) => Boolean(form.tds_applicable),
        },
      ],
    },
    {
      title: 'Address',
      fields: [
        { key: 'address', label: 'Address', type: 'textarea' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State', suggest: true },
      ],
    },
    {
      title: 'Bank',
      fields: [
        { key: 'bank_account_name', label: 'Account name' },
        { key: 'bank_account_number', label: 'Account number', maxLength: 40 },
        { key: 'ifsc', label: 'IFSC', placeholder: 'HDFC0001234', upper: true, maxLength: 11 },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
  ],
  columns: [
    { header: 'Name', render: (row) => row.name },
    { header: 'Mobile', render: (row) => row.mobile || <Dash /> },
    { header: 'Email', render: (row) => row.email || <Dash /> },
    { header: 'PAN', render: (row) => monoCell(row.pan) },
    { header: 'GSTN', render: (row) => monoCell(row.gstin) },
    { header: 'MSME', render: msmeCell },
    {
      header: 'TDS',
      render: (row) =>
        row.tds_applicable ? (
          <Pill tone="info">
            {[row.tds_section, row.tds_rate != null ? `${Number(row.tds_rate)}%` : ''].filter(Boolean).join(' · ') ||
              'Applicable'}
          </Pill>
        ) : (
          <Dash />
        ),
    },
    { header: 'Payable', align: 'right', render: (row) => money(row.total_payable) },
    { header: 'Outstanding', align: 'right', render: (row) => money(row.outstanding) },
  ],
  cardSubtitle: (row) =>
    [
      row.category,
      row.msme_registered ? 'MSME' : '',
      row.tds_applicable ? `TDS ${row.tds_section}${row.tds_rate != null ? ` @ ${Number(row.tds_rate)}%` : ''}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  cardStats: (row) => [
    { label: 'Payable', value: fmtInr(row.total_payable) },
    { label: 'Outstanding', value: fmtInr(row.outstanding) },
    { label: 'TDS', value: row.tds_applicable ? row.tds_section || 'Yes' : 'No' },
  ],
  validate: (form): FieldErrors =>
    form.tds_applicable && !String(form.tds_section ?? '').trim()
      ? { tds_section: 'Required when TDS is applicable.' }
      : {},
}

export function ClientsMasterPage() {
  return <MasterDataPage config={clientConfig} />
}

export function VendorsMasterPage() {
  return <MasterDataPage config={vendorConfig} />
}
