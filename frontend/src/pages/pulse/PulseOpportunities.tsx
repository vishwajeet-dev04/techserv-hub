import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, FileText } from 'lucide-react'
import { pulseApi } from '../../api/pulse'
import { getErrorMessage } from '../../api/errors'
import Modal, { btnPrimaryClass, btnRowDeleteClass, btnRowEditClass, fieldClass, labelClass } from '../../components/Modal'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import ConfirmActionModal from '../../components/ConfirmActionModal'
import DocumentPreviewModal, { type PreviewableFile } from '../../components/DocumentPreviewModal'
import PulseExcelBar from '../../components/PulseExcelBar'
import PulsePageHeader from '../../components/pulse/PulsePageHeader'
import PulseToolbar from '../../components/pulse/PulseToolbar'
import CorrectedDocumentsPanel from '../../components/pulse/CorrectedDocumentsPanel'
import PulseTableShell, {
  PulseEmptyState,
  PulseLoadingRows,
  PulsePaginationFooter,
  PulseTableHead,
} from '../../components/pulse/PulseTableShell'
import {
  PulseContactFields,
  emptyContactForm,
  type ContactFormValues,
} from '../../components/PulseContactFields'
import SuggestSelect from '../../components/SuggestSelect'
import {
  CITY_PRESETS,
  COUNTRY_PRESETS,
  DEPARTMENT_PRESETS,
  DESIGNATION_PRESETS,
  LEAD_SOURCE_PRESETS,
  STATE_PRESETS,
} from '../../lib/pulsePresets'
import { rememberCustomValue, mergeOptionsWithRecents } from '../../lib/pulseRecent'
import { notify } from '../../lib/notify'
import {
  normalizeContactForm,
  normalizeOpportunityTextFields,
  validateContactForm,
  validateOpportunityForm,
} from '../../lib/pulseValidation'
import type { PulseOpportunity, PulseOpportunityActivity } from '../../types'

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="sm:col-span-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand mt-1 pt-2 border-t border-canvas first:border-t-0 first:pt-0">
      {children}
    </p>
  )
}

function FieldHint({ error }: { error?: string }) {
  return error ? <p className="text-xs text-danger mt-1">{error}</p> : null
}

const STAGE_STYLE: Record<string, string> = {
  Win: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  Lost: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  Cancelled: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  Negotiation: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  Commercial: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  Demo: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  Approach: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  Qualify: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  Prospect: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const FALLBACK_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'CNY']

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

const STAGE_CELL_WIDTH = 'min-w-[11.5rem] w-[11.5rem]'

const PIPELINE_ORDER = ['Prospect', 'Qualify', 'Approach', 'Demo', 'Commercial', 'Negotiation']
const TERMINAL_STAGES = ['Win', 'Lost', 'Cancelled']

function isTerminalStage(stage: string) {
  return TERMINAL_STAGES.includes(stage)
}

function allowedNextStages(stage: string) {
  if (isTerminalStage(stage)) return []
  const index = PIPELINE_ORDER.indexOf(stage)
  const later = index >= 0 ? PIPELINE_ORDER.slice(index + 1) : PIPELINE_ORDER
  return [...later, ...TERMINAL_STAGES]
}

function StageBadge({
  stage,
  pending,
  onOpen,
}: {
  stage: string
  pending?: boolean
  onOpen: () => void
}) {
  if (isTerminalStage(stage)) {
    return (
      <span
        title="Final stage — cannot be changed"
        className={`inline-flex items-center justify-between gap-1 ${STAGE_CELL_WIDTH} border border-transparent rounded-lg px-2 py-1 text-xs ${STAGE_STYLE[stage] ?? 'bg-canvas text-muted'}`}
      >
        <span className="truncate">{stage}</span>
        <span className="text-[10px] uppercase tracking-wider opacity-70">Final</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      title="Update sales stage or follow-up"
      aria-label="Update sales stage or follow-up"
      disabled={pending}
      onClick={onOpen}
      className={`inline-flex items-center justify-between gap-1 ${STAGE_CELL_WIDTH} border border-line rounded-lg px-2 py-1 text-xs text-left hover:border-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 ${STAGE_STYLE[stage] ?? 'bg-canvas text-muted'}`}
    >
      <span className="truncate">{stage}</span>
      <ChevronIcon />
    </button>
  )
}

function ActivityAttachments({
  items,
  onPreview,
}: {
  items?: Array<{ id: string; file_name: string; url: string | null; content_type?: string; byte_size?: number }>
  onPreview: (file: PreviewableFile) => void
}) {
  if (!items?.length) return null
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((file) => (
        <li key={file.id} className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-ink min-w-0">
            <FileText className="w-3 h-3 shrink-0 text-subtle" />
            <span className="truncate">{file.file_name}</span>
          </span>
          {file.url ? (
            <button
              type="button"
              onClick={() => onPreview(file)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-brand/30 text-brand hover:bg-brand-soft shrink-0"
            >
              <Eye className="w-3 h-3" />
              Preview
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function DocsIssueBadge({ row, onOpen }: { row: PulseOpportunity; onOpen: () => void }) {
  if (row.stage !== 'Win' || !row.open_po_issue_count) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Ops reported a problem with the Win documents. Open to upload corrected files."
      className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-sans font-medium bg-danger-soft text-danger border border-danger/30 hover:border-danger"
    >
      Docs issue
    </button>
  )
}

function ActivityEntry({
  item,
  onPreview,
}: {
  item: PulseOpportunityActivity
  onPreview: (file: PreviewableFile) => void
}) {
  const followUpOnly = item.action === 'FOLLOW_UP_CHANGE'
  const documentsOnly = item.action === 'DOCUMENT_UPDATE'
  return (
    <div className="rounded-xl border border-line bg-canvas px-3 py-2">
      <p className="text-xs font-medium text-ink">
        {documentsOnly
          ? 'Documents updated'
          : followUpOnly
            ? `Follow-up extended to ${formatDate(item.follow_up_date)} · stays in ${item.to_stage || '—'}`
            : `${item.from_stage || '—'} → ${item.to_stage || '—'}`}
      </p>
      <p className="text-[11px] text-muted mt-0.5">
        {item.actor_name || 'System'} · {formatWhen(item.created_at)}
        {!followUpOnly && !documentsOnly && item.follow_up_date ? ` · Follow-up ${formatDate(item.follow_up_date)}` : ''}
      </p>
      {item.note ? <p className="text-xs text-ink mt-1">{item.note}</p> : null}
      <ActivityAttachments items={item.attachments} onPreview={onPreview} />
    </div>
  )
}

function formatAmount(value: number, currency: string) {
  const code = currency || 'INR'
  if (code === 'INR' && value >= 10_000_000) {
    return `₹${(value / 10_000_000).toFixed(2)} Cr`
  }
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${code} ${value.toLocaleString()}`
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dateInput(value: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

const emptyForm = {
  name: '',
  company_name: '',
  contact: '',
  contact_name: '',
  owner: '',
  lead_source: '',
  service_pillar: '',
  sub_category: '',
  delivery_partner: '',
  stage: '',
  expected_amount: '',
  negotiated_amount: '',
  currency: '',
  follow_up_date: '',
  expected_close_date: '',
  comments: '',
}

function formFromRow(row: PulseOpportunity) {
  return {
    name: row.name,
    company_name: row.company_name,
    contact: row.contact,
    contact_name: row.contact_name,
    owner: row.owner ?? '',
    lead_source: row.lead_source ?? '',
    service_pillar: row.service_pillar,
    sub_category: row.sub_category,
    delivery_partner: row.delivery_partner ?? '',
    stage: row.stage,
    expected_amount: String(row.expected_amount ?? ''),
    negotiated_amount: row.negotiated_amount ? String(row.negotiated_amount) : '',
    currency: row.currency || 'INR',
    follow_up_date: dateInput(row.follow_up_date),
    expected_close_date: dateInput(row.expected_close_date),
    comments: row.comments ?? '',
  }
}

export default function PulseOpportunities() {
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [stageParam, setStage] = useState(params.get('stage') ?? '')
  const [pillarFilter, setPillarFilter] = useState(params.get('pillar') ?? '')
  const [ownerFilter, setOwnerFilter] = useState(params.get('owner') ?? '')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PulseOpportunity | null>(null)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState(emptyForm)
  const [pendingDelete, setPendingDelete] = useState<PulseOpportunity | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState<ContactFormValues>(emptyContactForm)
  const [contactError, setContactError] = useState('')
  const [contactFieldErrors, setContactFieldErrors] = useState<Partial<Record<keyof ContactFormValues, string>>>({})
  const [stageModal, setStageModal] = useState<{
    id: string
    from: string
    to: string
    currency: string
    followUp: string
  } | null>(null)
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false)
  const [stageFollowUp, setStageFollowUp] = useState('')
  const [stageNote, setStageNote] = useState('')
  const [stageFiles, setStageFiles] = useState<File[]>([])
  const [stageModalError, setStageModalError] = useState('')
  const [historyRow, setHistoryRow] = useState<PulseOpportunity | null>(null)
  const [docsRow, setDocsRow] = useState<PulseOpportunity | null>(null)
  const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null)
  const [stageNegotiated, setStageNegotiated] = useState('')

  const settings = useQuery({ queryKey: ['pulse-settings'], queryFn: pulseApi.settings })
  const assignees = useQuery({ queryKey: ['pulse-assignees'], queryFn: pulseApi.listAssignees })
  const contacts = useQuery({ queryKey: ['pulse-contacts', ''], queryFn: () => pulseApi.listContacts() })
  const list = useQuery({
    queryKey: ['pulse-opportunities', search],
    queryFn: () => pulseApi.listOpportunities({ search: search || undefined }),
  })
  const activities = useQuery({
    queryKey: ['pulse-opportunity-activities', editing?.id],
    queryFn: () => pulseApi.listOpportunityActivities(editing!.id),
    enabled: Boolean(editing?.id && open),
  })
  const rowHistory = useQuery({
    queryKey: ['pulse-opportunity-activities', historyRow?.id],
    queryFn: () => pulseApi.listOpportunityActivities(historyRow!.id),
    enabled: Boolean(historyRow?.id),
  })
  const rowDocs = useQuery({
    queryKey: ['pulse-opportunity-activities', docsRow?.id],
    queryFn: () => pulseApi.listOpportunityActivities(docsRow!.id),
    enabled: Boolean(docsRow?.id),
  })

  const save = useMutation({
    mutationFn: (payload: typeof emptyForm) => {
      if (!editing) return pulseApi.createOpportunity(payload)
      // Stage and follow-up only change through the confirmed stage modal, which logs history.
      const rest = Object.fromEntries(
        Object.entries(payload).filter(([key]) => key !== 'stage' && key !== 'follow_up_date'),
      )
      return pulseApi.updateOpportunity(editing.id, rest)
    },
    onSuccess: async (_data, payload) => {
      rememberCustomValue('lead_source', payload.lead_source, LEAD_SOURCE_PRESETS)
      await queryClient.invalidateQueries({ queryKey: ['pulse-opportunities'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-pipeline'] })
      closeForm()
      notify.success(editing ? 'Opportunity updated.' : 'Opportunity created.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, editing ? 'Could not update opportunity.' : 'Could not create opportunity.')
      setFormError(message)
      notify.error(message)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => pulseApi.deleteOpportunity(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pulse-opportunities'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-summary'] })
      setPendingDelete(null)
      setDeleteError('')
      notify.success('Opportunity deleted.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not delete opportunity.')
      setDeleteError(message)
      notify.error(message)
    },
  })

  const createContact = useMutation({
    mutationFn: (payload: ContactFormValues) => pulseApi.createContact(payload),
    onSuccess: async (created, payload) => {
      rememberCustomValue('designation', payload.designation, DESIGNATION_PRESETS)
      rememberCustomValue('department', payload.department, DEPARTMENT_PRESETS)
      rememberCustomValue('country', payload.country, COUNTRY_PRESETS)
      rememberCustomValue('state', payload.state, STATE_PRESETS)
      rememberCustomValue('city', payload.city, CITY_PRESETS)
      await queryClient.invalidateQueries({ queryKey: ['pulse-contacts'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-settings'] })
      setForm((prev) => ({
        ...prev,
        company_name: created.company_name,
        contact: created.id,
        contact_name: created.name,
      }))
      setContactOpen(false)
      setContactForm(emptyContactForm)
      setContactError('')
      setContactFieldErrors({})
      notify.success('Contact created.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not create contact.')
      setContactError(message)
      notify.error(message)
    },
  })

  const updateStage = useMutation({
    mutationFn: ({
      id,
      stage: next,
      follow_up_date,
      stage_note,
      files,
      negotiated_amount,
    }: {
      id: string
      stage?: string
      follow_up_date: string
      stage_note: string
      files: File[]
      negotiated_amount?: string
    }) => {
      if (files.length > 0) {
        const formData = new FormData()
        if (next) formData.append('stage', next)
        formData.append('follow_up_date', follow_up_date)
        formData.append('stage_note', stage_note)
        if (negotiated_amount) formData.append('negotiated_amount', negotiated_amount)
        for (const file of files) formData.append('files', file)
        return pulseApi.updateOpportunity(id, formData)
      }
      return pulseApi.updateOpportunity(id, {
        ...(next ? { stage: next } : {}),
        follow_up_date,
        stage_note,
        ...(negotiated_amount ? { negotiated_amount } : {}),
      })
    },
    onSuccess: async (data, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['pulse-opportunities'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-pipeline'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-executive'] })
      await queryClient.invalidateQueries({ queryKey: ['pulse-opportunity-activities', vars.id] })
      if (editing?.id === vars.id) {
        setEditing(data)
        setForm((prev) => ({
          ...prev,
          stage: data.stage,
          follow_up_date: dateInput(data.follow_up_date),
          negotiated_amount: data.negotiated_amount ? String(data.negotiated_amount) : prev.negotiated_amount,
          comments: data.comments ?? prev.comments,
        }))
      }
      setStageConfirmOpen(false)
      setStageModal(null)
      setStageFollowUp('')
      setStageNote('')
      setStageFiles([])
      setStageNegotiated('')
      setStageModalError('')
      notify.success(vars.stage ? 'Sales stage updated.' : 'Follow-up date updated.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not save the change.')
      setStageConfirmOpen(false)
      setStageModalError(message)
      notify.error(message)
    },
  })

  const contactRows = contacts.data?.results ?? []
  const companies = settings.data?.companies ?? [...new Set(contactRows.map((row) => row.company_name))]
  const contactOptions = contactRows.filter((row) => !form.company_name || row.company_name === form.company_name)
  const pillars = settings.data?.service_pillars ?? []
  const subs = settings.data?.sub_categories ?? []
  const stages = settings.data?.sales_stages ?? []
  const currencies = settings.data?.currencies?.length ? settings.data.currencies : FALLBACK_CURRENCIES
  const defaultCurrency = settings.data?.default_currency || 'INR'
  const stage = stages.find((item) => item.toLowerCase() === stageParam.toLowerCase()) ?? stageParam

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, currency: defaultCurrency })
    setFormError('')
    setFieldErrors({})
    setOpen(true)
  }

  const openEditRow = (row: PulseOpportunity) => {
    setEditing(row)
    setForm(formFromRow(row))
    setFormError('')
    setOpen(true)
  }

  const openStageModal = (row: PulseOpportunity) => {
    if (isTerminalStage(row.stage)) return
    setStageConfirmOpen(false)
    setStageModal({
      id: row.id,
      from: row.stage,
      to: row.stage,
      currency: row.currency,
      followUp: dateInput(row.follow_up_date),
    })
    setStageFollowUp(dateInput(row.follow_up_date))
    setStageNote('')
    setStageFiles([])
    setStageNegotiated(Number(row.negotiated_amount) ? String(row.negotiated_amount) : '')
    setStageModalError('')
  }

  const closeForm = () => {
    setOpen(false)
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setFieldErrors({})
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeOpportunityTextFields(form)
    const errors = validateOpportunityForm({
      name: normalized.name,
      company_name: normalized.company_name,
      contact: normalized.contact,
      owner: normalized.owner,
      service_pillar: normalized.service_pillar,
      sub_category: normalized.sub_category,
      stage: normalized.stage,
      expected_amount: normalized.expected_amount,
      negotiated_amount: normalized.negotiated_amount,
      currency: normalized.currency,
      expected_close_date: normalized.expected_close_date,
    })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError('Fix the highlighted fields.')
      return
    }
    setForm(normalized)
    setFieldErrors({})
    if (save.isPending) return
    save.mutate(normalized)
  }

  const onContactSubmit = (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeContactForm(contactForm)
    const errors = validateContactForm(normalized)
    if (Object.keys(errors).length > 0) {
      setContactFieldErrors(errors)
      setContactError('Fix the highlighted fields.')
      return
    }
    setContactForm(normalized)
    setContactFieldErrors({})
    if (createContact.isPending) return
    setContactError('')
    createContact.mutate(normalized)
  }

  const set = (key: keyof typeof emptyForm) => (event: { target: { value: string } }) => {
    const value = event.target.value
    setForm((prev) => {
      if (key === 'company_name') {
        return { ...prev, company_name: value, contact: '', contact_name: '' }
      }
      if (key === 'contact') {
        const picked = contactRows.find((row) => row.id === value)
        return {
          ...prev,
          contact: value,
          contact_name: picked?.name ?? '',
          company_name: picked?.company_name || prev.company_name,
        }
      }
      return { ...prev, [key]: value }
    })
  }

  const rows = list.data?.results ?? []
  const scoped = useMemo(() => {
    return rows.filter((row) => {
      if (pillarFilter && row.service_pillar !== pillarFilter) return false
      if (ownerFilter && row.owner !== ownerFilter && row.owner_display !== ownerFilter) return false
      return true
    })
  }, [rows, pillarFilter, ownerFilter])

  const filtered = useMemo(() => {
    if (!stage) return scoped
    return scoped.filter((row) => row.stage === stage)
  }, [scoped, stage])

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of scoped) {
      counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1)
    }
    return counts
  }, [scoped])

  useEffect(() => {
    setPage(1)
  }, [search, stage, pillarFilter, ownerFilter, pageSize])

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const owners = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of rows) {
      if (row.owner) map.set(row.owner, row.owner_display || row.owner_name || row.owner)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const headers = [
    'Prospect Number', 'Prospect Name', 'Company name', 'Contact Names', 'Lead Source',
    'Service Pillar', 'Sub-Categories', 'Delivery Partner', 'Expected Amount', 'Final Negotiated',
    'Sales Stage', 'Assigned To', 'Created Date', 'Updated At', 'Followup Date',
    'Expected Close Date', 'Notes', '',
  ]
  const saving = save.isPending
  const assigneeRows = assignees.data ?? []

  const keepingStage = Boolean(stageModal && stageModal.to === stageModal.from)

  const reviewStageChange = () => {
    if (!stageModal) return
    if (!stageFollowUp.trim()) {
      setStageModalError('Follow-up date is required.')
      return
    }
    if (keepingStage && stageFollowUp === stageModal.followUp) {
      setStageModalError('Pick a new stage or change the follow-up date.')
      return
    }
    if (!keepingStage && !allowedNextStages(stageModal.from).includes(stageModal.to)) {
      setStageModalError(`Sales stage can only move forward from ${stageModal.from}.`)
      return
    }
    if (!stageNote.trim()) {
      setStageModalError('Notes are required.')
      return
    }
    if (!keepingStage) {
      if (stageFiles.length > 10) {
        setStageModalError('At most 10 files can be attached.')
        return
      }
      if (stageModal.to === 'Win' && stageFiles.length < 1) {
        setStageModalError('At least one document is required when moving to Win.')
        return
      }
      if (stageModal.to === 'Negotiation' && !(Number(stageNegotiated) > 0)) {
        setStageModalError('Final negotiation value is required when moving to Negotiation.')
        return
      }
    }
    setStageModalError('')
    setStageConfirmOpen(true)
  }

  const submitStageChange = () => {
    if (!stageModal || updateStage.isPending) return
    updateStage.mutate({
      id: stageModal.id,
      stage: keepingStage ? undefined : stageModal.to,
      follow_up_date: stageFollowUp,
      stage_note: stageNote.trim(),
      files: keepingStage ? [] : stageFiles,
      negotiated_amount: !keepingStage && stageModal.to === 'Negotiation' ? stageNegotiated.trim() : undefined,
    })
  }

  const stageConfirmMessage = !stageModal
    ? ''
    : keepingStage
      ? `Keep ${stageModal.from} and move the follow-up from ${formatDate(stageModal.followUp || null)} to ${formatDate(stageFollowUp || null)}?`
      : isTerminalStage(stageModal.to)
        ? `Move ${stageModal.from} to ${stageModal.to}? ${stageModal.to} is a final stage — it cannot be changed afterwards.`
        : `Move ${stageModal.from} to ${stageModal.to}? Stages only move forward, so this cannot be undone.`

  const stageConfirmDetails = stageModal
    ? [
        { label: 'Stage', value: keepingStage ? `${stageModal.from} (unchanged)` : `${stageModal.from} → ${stageModal.to}` },
        { label: 'Follow-up', value: formatDate(stageFollowUp || null) },
        ...(!keepingStage && stageModal.to === 'Negotiation' && stageNegotiated
          ? [{ label: 'Negotiated', value: formatAmount(Number(stageNegotiated), stageModal.currency) }]
          : []),
        ...(!keepingStage && stageFiles.length ? [{ label: 'Attachments', value: `${stageFiles.length} file(s)` }] : []),
        { label: 'Note', value: stageNote.trim() },
      ]
    : undefined

  return (
    <div className="p-4 sm:p-6 max-w-[1800px] mx-auto">
      <PulsePageHeader
        title="Opportunities"
        subtitle="Track and manage your sales pipeline."
        actions={
          <>
            <PulseExcelBar
              templateName="pulse-opportunities-template.xlsx"
              exportName="pulse-opportunities.xlsx"
              onTemplate={pulseApi.opportunityTemplate}
              onExport={pulseApi.exportOpportunities}
              onImport={pulseApi.importOpportunities}
              module="PULSE_OPPORTUNITIES"
              label="Opportunities"
              onImported={() => {
                void queryClient.invalidateQueries({ queryKey: ['pulse-opportunities'] })
                void queryClient.invalidateQueries({ queryKey: ['pulse-summary'] })
              }}
            />
            <button type="button" className={btnPrimaryClass} onClick={openCreate}>
              + Add Opportunity
            </button>
          </>
        }
      />

      <PulseToolbar>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search opportunities, company or contact..."
          className={`${fieldClass} md:max-w-xs xl:max-w-sm`}
        />
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={`${fieldClass} md:w-44`}>
          <option value="">All Stages</option>
          {stages.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={pillarFilter} onChange={(e) => setPillarFilter(e.target.value)} className={`${fieldClass} md:w-48`}>
          <option value="">All Service Pillars</option>
          {pillars.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={`${fieldClass} md:w-48`}>
          <option value="">All Owners</option>
          {owners.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </PulseToolbar>

      {list.isLoading ? (
        <PulseLoadingRows />
      ) : list.isError ? (
        <p className="mt-6 text-sm text-danger">{getErrorMessage(list.error)}</p>
      ) : filtered.length === 0 ? (
        <PulseEmptyState
          message="No opportunities yet. Add one or import from Excel."
          action={
            <button type="button" className={btnPrimaryClass} onClick={openCreate}>
              + Add Opportunity
            </button>
          }
        />
      ) : (
        <PulseTableShell
          minWidth="min-w-[1700px]"
          title="Opportunities"
          count={filtered.length}
          mobileCards={pageRows.map((row) => (
            <div key={row.id} className="px-4 py-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-muted">
                    {row.prospect_number}
                    <DocsIssueBadge row={row} onOpen={() => setDocsRow(row)} />
                  </p>
                  <p className="text-sm font-semibold text-ink truncate">{row.name}</p>
                  <p className="text-xs text-muted truncate">
                    {row.company_name}
                    {row.contact_name ? ` · ${row.contact_name}` : ''}
                  </p>
                </div>
                <StageBadge
                  stage={row.stage}
                  pending={updateStage.isPending && stageModal?.id === row.id}
                  onOpen={() => openStageModal(row)}
                />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <dt className="text-subtle">Expected</dt>
                  <dd className="text-ink font-medium tabular-nums">{formatAmount(Number(row.expected_amount), row.currency)}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Negotiated</dt>
                  <dd className="text-ink font-medium tabular-nums">
                    {Number(row.negotiated_amount) ? formatAmount(Number(row.negotiated_amount), row.currency) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Pillar</dt>
                  <dd className="text-muted truncate">{row.service_pillar || '—'}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Owner</dt>
                  <dd className="text-muted truncate">{row.owner_display || '—'}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Follow-up</dt>
                  <dd className="text-muted">{formatDate(row.follow_up_date)}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Expected close</dt>
                  <dd className="text-muted">{formatDate(row.expected_close_date)}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <button type="button" className={`${btnRowEditClass} !py-2`} onClick={() => setDocsRow(row)}>
                  Documents
                </button>
                <button type="button" className={`${btnRowEditClass} !py-2`} onClick={() => setHistoryRow(row)}>
                  History
                </button>
                <button type="button" className={`${btnRowEditClass} !py-2`} onClick={() => openEditRow(row)}>
                  Edit
                </button>
                <button
                  type="button"
                  className={`${btnRowDeleteClass} !py-2`}
                  disabled={remove.isPending}
                  onClick={() => {
                    setDeleteError('')
                    setPendingDelete(row)
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          headerRight={
            <div className="flex flex-wrap items-center gap-1.5 justify-end max-w-full">
              <button
                type="button"
                onClick={() => setStage('')}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  !stage
                    ? 'border-brand bg-brand-soft text-brand font-semibold'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                All ({scoped.length})
              </button>
              {stages.map((item) => {
                const count = stageCounts.get(item) ?? 0
                const active = stage === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStage(active ? '' : item)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      active
                        ? `border-brand ring-1 ring-brand ${STAGE_STYLE[item] ?? 'bg-brand-soft text-brand'} font-semibold`
                        : `${STAGE_STYLE[item] ?? 'bg-canvas text-muted'} border-transparent hover:border-line`
                    }`}
                  >
                    {item} ({count})
                  </button>
                )
              })}
            </div>
          }
          footer={
            <PulsePaginationFooter
              page={page}
              pageSize={pageSize}
              total={filtered.length}
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
                  <td className="px-3 py-3 font-medium whitespace-nowrap">
                    {row.prospect_number}
                    <DocsIssueBadge row={row} onOpen={() => setDocsRow(row)} />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{row.name}</p>
                    {row.is_high_value ? (
                      <span className="text-[10px] text-brand bg-brand-soft px-1.5 py-0.5 rounded">High Value</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-muted">{row.company_name}</td>
                  <td className="px-3 py-3 text-muted">{row.contact_name}</td>
                  <td className="px-3 py-3 text-muted">{row.lead_source || '—'}</td>
                  <td className="px-3 py-3 text-muted">{row.service_pillar}</td>
                  <td className="px-3 py-3 text-muted">{row.sub_category}</td>
                  <td className="px-3 py-3 text-muted">{row.delivery_partner || '—'}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatAmount(Number(row.expected_amount), row.currency)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{Number(row.negotiated_amount) ? formatAmount(Number(row.negotiated_amount), row.currency) : '—'}</td>
                  <td className="px-3 py-3">
                    <StageBadge
                      stage={row.stage}
                      pending={updateStage.isPending && stageModal?.id === row.id}
                      onOpen={() => openStageModal(row)}
                    />
                  </td>
                  <td className="px-3 py-3 text-muted">{row.owner_display || '—'}</td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{formatWhen(row.created_at)}</td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{formatWhen(row.updated_at)}</td>
                  <td className="px-3 py-3 text-muted">{formatDate(row.follow_up_date)}</td>
                  <td className="px-3 py-3 text-muted">{formatDate(row.expected_close_date)}</td>
                  <td className="px-3 py-3 text-muted max-w-[240px] truncate">{row.comments || '—'}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className={btnRowEditClass}
                        onClick={() => setDocsRow(row)}
                      >
                        Documents
                      </button>
                      <button
                        type="button"
                        className={btnRowEditClass}
                        onClick={() => setHistoryRow(row)}
                      >
                        History
                      </button>
                      <button type="button" className={btnRowEditClass} onClick={() => openEditRow(row)}>
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
        title={editing ? `Edit ${editing.prospect_number}` : 'Add New Opportunity'}
        onClose={() => !saving && !createContact.isPending && closeForm()}
        wide
        footer={
          <button type="submit" form="pulse-opp-form" disabled={saving} className={btnPrimaryClass}>
            {saving ? 'Saving…' : editing ? 'Update Opportunity' : 'Create Opportunity'}
          </button>
        }
      >
        <form id="pulse-opp-form" onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-3">
            {formError ? <p className="sm:col-span-2 text-sm text-danger">{formError}</p> : null}
            {editing ? (
              <p className="sm:col-span-2 text-xs text-muted">Prospect Number {editing.prospect_number} cannot be changed.</p>
            ) : null}
            <SectionTitle>Identity</SectionTitle>
            <div>
              <label className={labelClass}>Prospect Name*</label>
              <input className={`${fieldClass}${fieldErrors.name ? ' border-danger' : ''}`} value={form.name} onChange={set('name')} required />
              <FieldHint error={fieldErrors.name} />
            </div>
            <div>
              <label className={labelClass}>Company Name*</label>
              <select className={`${fieldClass}${fieldErrors.company_name ? ' border-danger' : ''}`} value={form.company_name} onChange={set('company_name')} required>
                <option value="">Select company</option>
                {companies.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <FieldHint error={fieldErrors.company_name} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className={`${labelClass} mb-0`}>Contact Name*</label>
                <button
                  type="button"
                  className="text-xs text-brand hover:underline"
                  onClick={() => {
                    setContactForm({ ...emptyContactForm, company_name: form.company_name })
                    setContactError('')
                    setContactFieldErrors({})
                    setContactOpen(true)
                  }}
                >
                  + New contact
                </button>
              </div>
              <select className={`${fieldClass}${fieldErrors.contact ? ' border-danger' : ''}`} value={form.contact} onChange={set('contact')} required>
                <option value="">Select contact{form.company_name ? '' : ' (or create one)'}</option>
                {contactOptions.map((row) => (
                  <option key={row.id} value={row.id}>{row.name} — {row.company_name}</option>
                ))}
              </select>
              <FieldHint error={fieldErrors.contact} />
            </div>
            <SectionTitle>Assignment and pipeline</SectionTitle>
            <div>
              <label className={labelClass}>Assigned To*</label>
              <select className={`${fieldClass}${fieldErrors.owner ? ' border-danger' : ''}`} value={form.owner} onChange={set('owner')} required>
                <option value="">Select team member</option>
                {assigneeRows.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                ))}
              </select>
              <FieldHint error={fieldErrors.owner} />
              {assigneeRows.length === 0 && !assignees.isLoading ? (
                <p className="text-xs text-muted mt-1">
                  No users yet. Ask an Admin to add team members in{' '}
                  <Link to="/settings/users" className="text-brand hover:underline">Settings → Users</Link>.
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>Service Pillar*</label>
              <select className={`${fieldClass}${fieldErrors.service_pillar ? ' border-danger' : ''}`} value={form.service_pillar} onChange={set('service_pillar')} required>
                <option value="">Select pillar</option>
                {pillars.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <FieldHint error={fieldErrors.service_pillar} />
            </div>
            <div>
              <label className={labelClass}>Sub-Categories*</label>
              <select className={`${fieldClass}${fieldErrors.sub_category ? ' border-danger' : ''}`} value={form.sub_category} onChange={set('sub_category')} required>
                <option value="">Select sub-category</option>
                {subs.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <FieldHint error={fieldErrors.sub_category} />
            </div>
            <div>
              <label className={labelClass}>Sales Stage*</label>
              {editing ? (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-2 rounded-xl text-sm flex-1 ${STAGE_STYLE[form.stage] ?? 'bg-canvas text-muted'}`}>
                    {form.stage}
                    {isTerminalStage(form.stage) ? <span className="ml-2 text-[10px] uppercase tracking-wider opacity-70">Final</span> : null}
                  </span>
                </div>
              ) : (
                <select className={`${fieldClass}${fieldErrors.stage ? ' border-danger' : ''}`} value={form.stage} onChange={set('stage')} required>
                  <option value="">Select stage</option>
                  {stages.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              )}
              <FieldHint error={fieldErrors.stage} />
            </div>
            <SectionTitle>Amounts and dates</SectionTitle>
            <div>
              <label className={labelClass}>Currency*</label>
              <select
                className={`${fieldClass}${fieldErrors.currency ? ' border-danger' : ''}`}
                value={form.currency}
                onChange={set('currency')}
                required
              >
                <option value="">Select currency</option>
                {currencies.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <FieldHint error={fieldErrors.currency} />
            </div>
            <div>
              <label className={labelClass}>Expected Amount*</label>
              <input type="number" min="0" step="any" className={`${fieldClass}${fieldErrors.expected_amount ? ' border-danger' : ''}`} value={form.expected_amount} onChange={set('expected_amount')} required />
              <FieldHint error={fieldErrors.expected_amount} />
            </div>
            <div>
              <label className={labelClass}>Final Negotiated Amount</label>
              <input type="number" min="0" step="any" className={`${fieldClass}${fieldErrors.negotiated_amount ? ' border-danger' : ''}`} value={form.negotiated_amount} onChange={set('negotiated_amount')} />
              <FieldHint error={fieldErrors.negotiated_amount} />
            </div>
            <SuggestSelect
              label="Lead Source"
              value={form.lead_source}
              options={mergeOptionsWithRecents('lead_source', LEAD_SOURCE_PRESETS)}
              onChange={(value) => setForm((prev) => ({ ...prev, lead_source: value }))}
            />
            <div>
              <label className={labelClass}>Delivery Partner</label>
              <input className={fieldClass} value={form.delivery_partner} onChange={set('delivery_partner')} />
            </div>
            <div>
              <label className={labelClass}>Expected Close Date*</label>
              <input
                type="date"
                className={`${fieldClass}${fieldErrors.expected_close_date ? ' border-danger' : ''}`}
                value={form.expected_close_date}
                onChange={set('expected_close_date')}
                required
              />
              <FieldHint error={fieldErrors.expected_close_date} />
            </div>
            <div className="sm:col-span-2 rounded-2xl border border-brand/40 bg-brand-soft/30 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Follow-up</p>
              <p className="text-xs text-muted">Set the next action date — this drives reminders and pipeline follow-through.</p>
              {editing ? (
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className={labelClass}>Follow-up Date</p>
                    <p className="text-sm font-medium text-ink">{formatDate(form.follow_up_date || null)}</p>
                  </div>
                  {isTerminalStage(form.stage) ? (
                    <p className="text-xs text-muted">Final stage — stage and follow-up are locked.</p>
                  ) : (
                    <button type="button" className={btnRowEditClass} onClick={() => openStageModal(editing)}>
                      Update stage / follow-up
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Follow-up Date</label>
                  <input type="date" className={fieldClass} value={form.follow_up_date} onChange={set('follow_up_date')} />
                </div>
              )}
            </div>
            <SectionTitle>Notes</SectionTitle>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea className={`${fieldClass} min-h-20`} value={form.comments} onChange={set('comments')} />
            </div>
            {editing ? (
              <>
                <SectionTitle>History</SectionTitle>
                <div className="sm:col-span-2 space-y-2 max-h-48 overflow-y-auto">
                  {activities.isLoading ? (
                    <p className="text-xs text-muted">Loading history…</p>
                  ) : (activities.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted">No stage or follow-up changes recorded yet.</p>
                  ) : (
                    (activities.data ?? []).map((item) => (
                      <ActivityEntry key={item.id} item={item} onPreview={setPreviewFile} />
                    ))
                  )}
                </div>
              </>
            ) : null}
          </form>
      </Modal>

      <Modal
        open={Boolean(stageModal)}
        title="Update stage / follow-up"
        stacked
        onClose={() => {
          if (updateStage.isPending || stageConfirmOpen) return
          setStageModal(null)
          setStageModalError('')
          setStageFiles([])
        }}
        footer={
          <button
            type="button"
            className={btnPrimaryClass}
            disabled={updateStage.isPending}
            onClick={reviewStageChange}
          >
            {stageModal && stageModal.to === stageModal.from ? 'Review follow-up change' : 'Review stage change'}
          </button>
        }
      >
        {stageModal ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Current stage: <span className="font-medium text-ink">{stageModal.from}</span>
              {' · '}Follow-up: <span className="font-medium text-ink">{formatDate(stageModal.followUp || null)}</span>
            </p>
            <p className="text-xs text-muted">
              Stages only move forward. Keep the current stage to extend the follow-up date; Win, Lost and Cancelled are final.
            </p>
            {stageModalError ? <p className="text-sm text-danger">{stageModalError}</p> : null}
            <div>
              <label className={labelClass}>Stage*</label>
              <select
                className={fieldClass}
                value={stageModal.to}
                onChange={(e) => {
                  const to = e.target.value
                  setStageModal((prev) => (prev ? { ...prev, to } : prev))
                  if (to === stageModal.from) setStageFiles([])
                }}
              >
                <option value={stageModal.from}>{stageModal.from} (keep — extend follow-up)</option>
                {allowedNextStages(stageModal.from).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            {stageModal.to === 'Negotiation' ? (
              <div>
                <label className={labelClass}>Final Negotiation Value* ({stageModal.currency || 'INR'})</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={fieldClass}
                  value={stageNegotiated}
                  onChange={(e) => setStageNegotiated(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div>
              <label className={labelClass}>Follow-up Date*</label>
              <input
                type="date"
                className={fieldClass}
                value={stageFollowUp}
                onChange={(e) => setStageFollowUp(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted mt-1">
                {stageModal.to === stageModal.from ? 'New follow-up date — must differ from the current one' : 'Next follow-up'}
              </p>
            </div>
            <div>
              <label className={labelClass}>Notes*</label>
              <textarea
                className={`${fieldClass} min-h-24`}
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder={stageModal.to === stageModal.from ? 'Why is the follow-up moving? e.g. client asked to reconnect next week' : ''}
                required
              />
            </div>
            {stageModal.to !== stageModal.from ? (
              <div>
                <label className={labelClass}>
                  Attachments{stageModal.to === 'Win' ? '*' : ''}
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                  className={`${fieldClass} py-2`}
                  onChange={(event) => {
                    const picked = Array.from(event.target.files ?? [])
                    event.target.value = ''
                    setStageFiles((prev) => [...prev, ...picked].slice(0, 10))
                  }}
                />
                <p className="text-[11px] text-muted mt-1">
                  {stageModal.to === 'Win'
                    ? 'Required for Win · up to 10 files · 10 MB each · pdf, doc, images, xlsx, csv'
                    : 'Optional · up to 10 files · 10 MB each · pdf, doc, images, xlsx, csv'}
                </p>
                {stageFiles.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {stageFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-xs text-ink">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          className="text-danger hover:underline shrink-0"
                          onClick={() => setStageFiles((prev) => prev.filter((_, i) => i !== index))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmActionModal
        open={Boolean(stageModal) && stageConfirmOpen}
        title={stageModal && stageModal.to === stageModal.from ? 'Confirm follow-up change' : 'Confirm stage change'}
        message={stageConfirmMessage}
        details={stageConfirmDetails}
        confirmLabel={stageModal && stageModal.to === stageModal.from ? 'Yes, update follow-up' : 'Yes, change stage'}
        pending={updateStage.isPending}
        onCancel={() => setStageConfirmOpen(false)}
        onConfirm={submitStageChange}
      />

      <Modal
        open={Boolean(historyRow)}
        title={historyRow ? `History · ${historyRow.prospect_number}` : 'History'}
        onClose={() => setHistoryRow(null)}
      >
        {historyRow ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">{historyRow.name}</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {rowHistory.isLoading ? (
                <p className="text-xs text-muted">Loading history…</p>
              ) : rowHistory.isError ? (
                <p className="text-sm text-danger">{getErrorMessage(rowHistory.error, 'Could not load history.')}</p>
              ) : (rowHistory.data ?? []).length === 0 ? (
                <p className="text-sm text-muted">No stage or follow-up changes recorded yet.</p>
              ) : (
                (rowHistory.data ?? []).map((item) => (
                  <ActivityEntry key={item.id} item={item} onPreview={setPreviewFile} />
                ))
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(docsRow)}
        title={docsRow ? `Documents · ${docsRow.prospect_number}` : 'Documents'}
        onClose={() => setDocsRow(null)}
      >
        {docsRow ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">{docsRow.name}</p>
            <CorrectedDocumentsPanel opportunity={docsRow} />
            {rowDocs.isLoading ? (
              <p className="text-xs text-muted">Loading documents…</p>
            ) : rowDocs.isError ? (
              <p className="text-sm text-danger">{getErrorMessage(rowDocs.error, 'Could not load documents.')}</p>
            ) : (
              (() => {
                const files = (rowDocs.data ?? []).flatMap((item) =>
                  (item.attachments ?? []).map((file) => ({
                    ...file,
                    who: file.uploaded_by_name || item.actor_name || 'System',
                    when: file.created_at || item.created_at,
                  })),
                )
                if (files.length === 0) {
                  return <p className="text-sm text-muted">No documents yet.</p>
                }
                return (
                  <ul className="space-y-2 max-h-80 overflow-y-auto">
                    {files.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{file.file_name}</p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {file.who} · {formatWhen(file.when)}
                          </p>
                        </div>
                        {file.url ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-brand/30 text-brand text-xs hover:bg-brand-soft shrink-0"
                            onClick={() => setPreviewFile(file)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )
              })()
            )}
          </div>
        ) : null}
      </Modal>

      <DocumentPreviewModal
        open={Boolean(previewFile)}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      <Modal
        open={contactOpen}
        title="Add New Contact"
        stacked
        wide
        onClose={() => !createContact.isPending && setContactOpen(false)}
        footer={
          <button type="submit" form="pulse-nested-contact-form" disabled={createContact.isPending} className={btnPrimaryClass}>
            {createContact.isPending ? 'Saving…' : 'Create Contact'}
          </button>
        }
      >
        <form id="pulse-nested-contact-form" onSubmit={onContactSubmit} className="grid sm:grid-cols-2 gap-3">
          {contactError ? <p className="sm:col-span-2 text-sm text-danger">{contactError}</p> : null}
          <PulseContactFields
            form={contactForm}
            errors={contactFieldErrors}
            onChange={(key, value) => setContactForm((prev) => ({ ...prev, [key]: value }))}
          />
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        title="Delete opportunity"
        message="This cannot be undone."
        details={
          pendingDelete
            ? [
                { label: 'Prospect Number', value: pendingDelete.prospect_number },
                { label: 'Prospect Name', value: pendingDelete.name },
              ]
            : undefined
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
