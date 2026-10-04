import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartTick, tooltipProps } from '../lib/chartTheme'
import { AlertTriangle, ChevronDown, Eye, FileText } from 'lucide-react'
import { dealsApi } from '../api/deals'
import { pulseApi } from '../api/pulse'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import { useAuth } from '../hooks/useAuth'
import Modal, {
  btnPrimaryClass,
  btnRowDeleteClass,
  btnRowEditClass,
  btnSecondaryClass,
  fieldClass,
  labelClass,
} from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import DocumentPreviewModal, {
  DocumentPreviewBody,
  type PreviewableFile,
} from '../components/DocumentPreviewModal'
import PulseExcelBar from '../components/PulseExcelBar'
import { useDateRange } from '../hooks/useDateRange'
import ReportPoIssueModal from '../components/ReportPoIssueModal'
import type {
  PoDocumentIssue,
  PoWorkflow,
  PoWorkflowDashboard,
  PulseOpportunity,
  PulseOpportunityActivity,
  PulseOpportunityActivityAttachment,
} from '../types'

const filterField = `${fieldClass} !w-[11rem]`
const BILLING_ENTITIES = ['India', 'SG']
const SERVICE_PILLARS = ['AIDA', 'FinOps', 'Loan', 'PRAS', 'BizOps', 'Sprouts', 'Consultancy']
const AGREEMENTS = ['Yes', 'NA']
const MILESTONE_CYCLE = 'Milestone'
const BILLING_CYCLES = ['Monthly', 'Quarterly', 'One-time', MILESTONE_CYCLE]
const BILLING_DUES = [
  'Event Specific',
  '31st of Month',
  '5th of Next month',
  '1st of Month',
  '15th of Month',
  '15th of November',
]

const emptyForm = {
  customer_name: '',
  billing_entity: '',
  service_pillar: '',
  po_number: '',
  po_date: '',
  agreement: '',
  start_date: '',
  end_date: '',
  expiry: '',
  total_value: '',
  value_per_invoice: '',
  billing_cycle: '',
  milestone_details: '',
  billing_due: '',
  opportunity: '',
  prospect_number: '',
}

type FormValues = typeof emptyForm

const REQUIRED: Array<[keyof FormValues, string]> = [
  ['customer_name', 'Customer'],
  ['billing_entity', 'Billing Entity'],
  ['service_pillar', 'Service Pillar'],
  ['po_number', 'PO Number'],
  ['agreement', 'Agreement'],
  ['billing_cycle', 'Billing Cycle'],
  ['billing_due', 'Billing Due'],
]

function fromRow(row: PoWorkflow): FormValues {
  return {
    customer_name: row.customer_name,
    billing_entity: row.billing_entity,
    service_pillar: row.service_pillar,
    po_number: row.po_number,
    po_date: row.po_date ?? '',
    agreement: row.agreement,
    start_date: row.start_date ?? '',
    end_date: row.end_date ?? '',
    expiry: row.expiry ?? '',
    total_value: row.total_value == null ? '' : String(row.total_value),
    value_per_invoice: row.value_per_invoice == null ? '' : String(row.value_per_invoice),
    billing_cycle: row.billing_cycle === 'Event' ? MILESTONE_CYCLE : row.billing_cycle,
    milestone_details: row.milestone_details ?? '',
    billing_due: row.billing_due,
    opportunity: row.opportunity ?? '',
    prospect_number: row.opportunity_prospect_number ?? '',
  }
}

function fmtCompact(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

function fmtMoney(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

/** Display dates as dd/mm/yyyy */
function day(value: string | null | undefined) {
  if (!value) return '—'
  const iso = value.slice(0, 10)
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function monthLabel(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function collectWinAttachments(activities: PulseOpportunityActivity[]): PulseOpportunityActivityAttachment[] {
  const files: PulseOpportunityActivityAttachment[] = []
  for (const item of activities) {
    if (item.to_stage === 'Win' || item.from_stage === 'Win' || item.attachments?.length) {
      for (const file of item.attachments ?? []) {
        if (file.url) files.push(file)
      }
    }
  }
  // Prefer Win-stage files (the Win transition plus corrected uploads, newest first); fall back to all activity files
  const winOnly = activities
    .filter((a) => a.to_stage === 'Win' && (a.action === 'STAGE_CHANGE' || a.action === 'DOCUMENT_UPDATE'))
    .flatMap((a) => a.attachments ?? [])
    .filter((f) => f.url)
  return winOnly.length ? winOnly : files
}

export default function Deals() {
  const { hasAccess } = useAuth()
  const queryClient = useQueryClient()
  const { from: dateFrom, to: dateTo } = useDateRange()
  const [customer, setCustomer] = useState('')
  const [vendor, setVendor] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PoWorkflow | null>(null)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [pendingDelete, setPendingDelete] = useState<PoWorkflow | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [sourceOpp, setSourceOpp] = useState<PulseOpportunity | null>(null)
  const [logOppId, setLogOppId] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null)
  const [selectedWinDoc, setSelectedWinDoc] = useState<PreviewableFile | null>(null)
  const [wonOpen, setWonOpen] = useState(false)
  const [opsOpen, setOpsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const allowed = hasAccess('deals')
  const periodHint = 'In selected range'

  const dash = useQuery({
    queryKey: ['po-workflow', dateFrom, dateTo, customer, vendor],
    queryFn: () =>
      dealsApi.poDashboard({
        from: dateFrom,
        to: dateTo,
        customer,
        billing_entity: vendor,
      }),
    enabled: allowed,
  })

  const opsUpdates = useQuery({
    queryKey: ['pulse-ops-updates'],
    queryFn: () => pulseApi.listOpsUpdates(50),
    enabled: allowed,
  })

  const wins = useQuery({
    queryKey: ['pulse-opportunities', 'Win'],
    queryFn: () => pulseApi.listOpportunities({ stage: 'Win' }),
    enabled: allowed,
  })

  const openIssues = useQuery({
    queryKey: ['po-issues', 'OPEN'],
    queryFn: () => dealsApi.listPoIssues({ status: 'OPEN' }),
    enabled: allowed,
  })

  const openIssueByOpp = useMemo(() => {
    const map = new Map<string, PoDocumentIssue>()
    for (const issue of openIssues.data ?? []) {
      if (!map.has(issue.opportunity)) map.set(issue.opportunity, issue)
    }
    return map
  }, [openIssues.data])

  const sourceIssue = sourceOpp ? openIssueByOpp.get(sourceOpp.id) ?? null : null

  const winLogs = useQuery({
    queryKey: ['pulse-opportunity-activities', logOppId],
    queryFn: () => pulseApi.listOpportunityActivities(logOppId!),
    enabled: Boolean(logOppId),
  })

  const sourceAttachments = useQuery({
    queryKey: ['pulse-opportunity-activities', sourceOpp?.id, 'po-form'],
    queryFn: () => pulseApi.listOpportunityActivities(sourceOpp!.id),
    enabled: Boolean(sourceOpp?.id) && open && !editing,
  })

  const winDocs = useMemo(
    () => collectWinAttachments(sourceAttachments.data ?? []),
    [sourceAttachments.data],
  )

  useEffect(() => {
    if (!open || editing || !sourceOpp) {
      setSelectedWinDoc(null)
      return
    }
    if (winDocs.length === 0) {
      setSelectedWinDoc(null)
      return
    }
    setSelectedWinDoc((prev) => {
      if (prev && winDocs.some((f) => f.id === prev.id)) return prev
      return winDocs[0]
    })
  }, [open, editing, sourceOpp, winDocs])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['po-workflow'] })
    await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    await queryClient.invalidateQueries({ queryKey: ['ledger-summary'] })
    await queryClient.invalidateQueries({ queryKey: ['finance-ops-summary'] })
    await queryClient.invalidateQueries({ queryKey: ['pulse-opportunities'] })
    await queryClient.invalidateQueries({ queryKey: ['pulse-ops-updates'] })
    await queryClient.invalidateQueries({ queryKey: ['po-issues'] })
  }

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = { ...form }
      if (!payload.opportunity) delete payload.opportunity
      delete payload.prospect_number
      return editing
        ? dealsApi.updatePoWorkflow(editing.id, payload)
        : dealsApi.createPoWorkflow(payload)
    },
    onSuccess: async () => {
      await invalidate()
      closeForm()
      notify.success(editing ? 'PO updated.' : 'PO validated.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, editing ? 'Could not update PO.' : 'Could not validate PO.')
      setFormError(message)
      notify.error(message)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => dealsApi.deletePoWorkflow(id),
    onSuccess: async () => {
      await invalidate()
      setPendingDelete(null)
      setDeleteError('')
      notify.success('PO deleted.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not delete PO.')
      setDeleteError(message)
      notify.error(message)
    },
  })

  const approve = useMutation({
    mutationFn: (id: string) => dealsApi.approvePoWorkflow(id),
    onSuccess: async () => {
      await invalidate()
      notify.success('PO approved.')
    },
    onError: (err) => notify.error(getErrorMessage(err, 'Could not approve PO.')),
  })

  const closeForm = () => {
    setOpen(false)
    setReportOpen(false)
    setEditing(null)
    setSourceOpp(null)
    setSelectedWinDoc(null)
    setForm(emptyForm)
    setFormError('')
  }

  const openFromWin = (opp: PulseOpportunity) => {
    const close = opp.expected_close_date?.slice(0, 10) ?? ''
    setWonOpen(false)
    setEditing(null)
    setSourceOpp(opp)
    setForm({
      ...emptyForm,
      customer_name: opp.company_name || '',
      opportunity: opp.id,
      prospect_number: opp.prospect_number || '',
      end_date: close,
      expiry: close,
      service_pillar: SERVICE_PILLARS.includes(opp.service_pillar) ? opp.service_pillar : '',
    })
    setFormError('')
    setOpen(true)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing && !sourceOpp) {
      setFormError('Create a PO from a Win opportunity in Won hand-off.')
      return
    }
    const missing = REQUIRED.find(([key]) => !form[key].trim())
    if (missing) {
      setFormError(`${missing[1]} is required.`)
      return
    }
    if (form.billing_cycle === MILESTONE_CYCLE && !form.milestone_details.trim()) {
      setFormError('Milestone Details is required for Milestone billing.')
      return
    }
    if (save.isPending) return
    setFormError('')
    save.mutate()
  }

  if (!allowed) {
    return <p className="p-4 sm:p-6 text-sm text-muted">PO & Contracts is not available for this role.</p>
  }

  if (dash.isLoading) {
    return <p className="p-4 sm:p-6 text-sm text-muted">Loading PO & Contracts…</p>
  }

  if (dash.isError || !dash.data) {
    return (
      <p className="p-4 sm:p-6 text-sm text-danger">
        {getErrorMessage(dash.error, 'Could not load PO & Contracts.')}
      </p>
    )
  }

  const data = dash.data
  const rows = data.rows
  const chartHeight = Math.max(240, data.by_category.length * 36)
  const winRows = wins.data?.results ?? []
  const splitMode = Boolean(sourceOpp) && !editing

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6 min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Deal-to-Billing Ops</p>
          <h2 className="text-2xl font-semibold text-ink mt-1">PO & Contracts</h2>
          <p className="text-sm text-muted mt-1">Live purchase orders from the PO Workflow sheet.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 xl:justify-end">
          <button
            type="button"
            className={btnSecondaryClass}
            onClick={() => setOpsOpen(true)}
          >
            Ops Update
            <span className="inline-flex min-w-[1.25rem] justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-canvas text-muted border border-line">
              {opsUpdates.isLoading ? '…' : (opsUpdates.data ?? []).length}
            </span>
          </button>
          <button
            type="button"
            className={btnPrimaryClass}
            onClick={() => setWonOpen(true)}
          >
            Won hand-off
            <span className="inline-flex min-w-[1.25rem] justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface/20 text-white">
              {wins.isLoading ? '…' : winRows.length}
            </span>
          </button>
          <PulseExcelBar
            templateName="po-workflow-template.xlsx"
            exportName="po-workflow.xlsx"
            onTemplate={dealsApi.poWorkflowTemplate}
            onExport={dealsApi.exportPoWorkflow}
            onImport={dealsApi.importPoWorkflow}
            onImported={() => void invalidate()}
            module="PO_WORKFLOW"
            label="PO workflow"
          />
          <button
            type="button"
            className={btnSecondaryClass}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['po-workflow'] })
              void queryClient.invalidateQueries({ queryKey: ['pulse-opportunities', 'Win'] })
              void queryClient.invalidateQueries({ queryKey: ['pulse-ops-updates'] })
            }}
          >
            Refresh
          </button>
          <label className="text-[11px] font-medium text-muted shrink-0">
            Client
            <select value={customer} onChange={(e) => setCustomer(e.target.value)} className={`${filterField} mt-1`}>
              <option value="">All Clients</option>
              {data.clients.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-muted shrink-0">
            Vendor
            <select value={vendor} onChange={(e) => setVendor(e.target.value)} className={`${filterField} mt-1`}>
              <option value="">All Vendors</option>
              {data.vendors.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          {customer || vendor ? (
            <button
              type="button"
              className={`${btnSecondaryClass} !px-3 !py-2 shrink-0`}
              onClick={() => {
                setCustomer('')
                setVendor('')
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Active POs" value={String(data.kpis.active_pos)} sub={periodHint} edge="brand" />
        <Kpi label="Total contract value" value={fmtCompact(data.kpis.total_contract_value)} sub={periodHint} accent />
        <Kpi label="Avg monthly billing" value={fmtCompact(data.kpis.avg_monthly_billing)} sub={periodHint} edge="brand" />
        <Kpi label="Avg duration" value={`${data.kpis.avg_duration_months.toFixed(1)} months`} sub={periodHint} edge="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink mb-3">Contract value by category</p>
          {data.by_category.length === 0 ? (
            <p className="text-sm text-muted py-16 text-center">No contracts in this filter.</p>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={data.by_category} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis type="number" tick={chartTick} tickFormatter={(v) => fmtCompact(Number(v))} />
                <YAxis type="category" dataKey="name" width={100} tick={chartTick} />
                <Tooltip {...tooltipProps} formatter={(value) => fmtMoney(Number(value))} />
                <Bar dataKey="value" name="Value" fill="var(--color-brand)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink mb-3">PO timeline</p>
          <Timeline rows={data.timeline} />
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-md border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-4 border-b border-line flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Contracts</h3>
          <p className="text-xs text-muted">{rows.length} rows</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No PO workflow rows in this filter. Import the sheet or add a row.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pin-first w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted bg-canvas border-b border-line">
                  {['PO #', 'Customer', 'Prospect', 'Category', 'Total value', 'Monthly', 'Terms', 'Start', 'End', 'Hand Over', 'Status', ''].map((h) => (
                    <th key={h || 'actions'} className="px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="group border-b border-canvas hover:bg-brand-soft/50">
                    <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{row.po_display}</td>
                    <td className="px-4 py-3 text-ink">{row.customer_name}</td>
                    <td className="px-4 py-3 text-muted font-mono text-xs whitespace-nowrap">
                      {row.opportunity_prospect_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.service_pillar}</td>
                    <td className="px-4 py-3 text-ink whitespace-nowrap">{fmtMoney(row.total_value)}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtMoney(row.value_per_invoice)}</td>
                    <td className="px-4 py-3 text-muted" title={row.milestone_details || undefined}>
                      {row.billing_cycle === 'Event' ? MILESTONE_CYCLE : row.billing_cycle}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{day(row.start_date)}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{day(row.end_date)}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{day(row.expiry)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {row.finance_approved ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Approved
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={btnPrimaryClass.replace('px-4 py-2', 'px-2.5 py-1').replace('text-sm', 'text-xs')}
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(row.id)}
                          >
                            {approve.isPending && approve.variables === row.id ? 'Approving…' : 'Approve'}
                          </button>
                        )}
                        <button
                          type="button"
                          className={btnRowEditClass}
                          onClick={() => {
                            setEditing(row)
                            setSourceOpp(null)
                            setForm(fromRow(row))
                            setFormError('')
                            setOpen(true)
                          }}
                        >
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
            </table>
          </div>
        )}
      </div>

      <Modal
        open={opsOpen}
        title="Ops Update"
        onClose={() => setOpsOpen(false)}
        wide
      >
        <p className="text-xs text-muted -mt-2 mb-3">Stage changes from Pulse CRM.</p>
        {opsUpdates.isLoading ? (
          <p className="text-sm text-muted py-6">Loading updates…</p>
        ) : (opsUpdates.data ?? []).length === 0 ? (
          <p className="text-sm text-muted py-6">No CRM stage changes yet.</p>
        ) : (
          <ul className="divide-y divide-canvas max-h-[60vh] overflow-y-auto -mx-1">
            {(opsUpdates.data ?? []).map((item) => (
              <li key={item.id} className="px-1 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">
                    <span className="font-mono text-xs text-brand mr-2">{item.prospect_number}</span>
                    <span className="font-medium">{item.company_name || item.opportunity_name}</span>
                    <span className="text-muted"> — {item.from_stage || '—'} → {item.to_stage || '—'}</span>
                  </p>
                  {item.note ? (
                    <p className="text-xs text-muted mt-0.5 truncate">{item.note}</p>
                  ) : null}
                </div>
                <p className="text-[11px] text-subtle shrink-0 whitespace-nowrap">
                  {item.actor_name || 'System'} · {formatWhen(item.created_at)}
                  {item.attachment_count > 0 ? ` · ${item.attachment_count} file${item.attachment_count === 1 ? '' : 's'}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={wonOpen}
        title="Won hand-off"
        onClose={() => {
          setWonOpen(false)
          setLogOppId(null)
        }}
        wide
      >
        <p className="text-xs text-muted -mt-2 mb-3">
          Win opportunities from Pulse — review change logs and create POs.
          {' '}
          <span className="text-ink font-medium">{winRows.length} win{winRows.length === 1 ? '' : 's'}</span>
        </p>
        {wins.isLoading ? (
          <p className="text-sm text-muted py-6">Loading wins…</p>
        ) : winRows.length === 0 ? (
          <p className="text-sm text-muted py-6">No Win opportunities yet.</p>
        ) : (
          <ul className="divide-y divide-canvas max-h-[60vh] overflow-y-auto -mx-1">
            {winRows.map((opp) => {
              const hasPo = (opp.linked_po_count ?? 0) > 0
              const logOpen = logOppId === opp.id
              return (
                <li key={opp.id} className="px-1 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        <span className="font-mono text-xs text-brand mr-2">{opp.prospect_number}</span>
                        {opp.name}
                      </p>
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {opp.company_name}
                        {opp.owner_display ? ` · ${opp.owner_display}` : ''}
                        {' · '}
                        {day(opp.expected_close_date)}
                        {hasPo ? (
                          <span className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                            PO linked ({opp.linked_po_count})
                          </span>
                        ) : null}
                        {openIssueByOpp.has(opp.id) ? (
                          <span className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Issue open
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        className={btnSecondaryClass.replace('px-4 py-2', 'px-2.5 py-1.5').replace('text-sm', 'text-xs')}
                        onClick={() => setLogOppId(logOpen ? null : opp.id)}
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 inline mr-1 transition-transform ${logOpen ? 'rotate-180' : ''}`}
                          strokeWidth={2}
                          aria-hidden
                        />
                        Change log
                      </button>
                      <button
                        type="button"
                        className={btnPrimaryClass.replace('px-4 py-2', 'px-2.5 py-1.5').replace('text-sm', 'text-xs')}
                        disabled={hasPo}
                        title={hasPo ? 'A PO is already linked to this opportunity' : 'Create PO from this Win'}
                        onClick={() => openFromWin(opp)}
                      >
                        Add PO
                      </button>
                    </div>
                  </div>
                  {logOpen ? (
                    <div className="mt-3 rounded-xl border border-line bg-canvas/60 p-3 space-y-2 max-h-56 overflow-y-auto">
                      {winLogs.isLoading ? (
                        <p className="text-xs text-muted">Loading history…</p>
                      ) : (winLogs.data ?? []).length === 0 ? (
                        <p className="text-xs text-muted">No stage changes recorded.</p>
                      ) : (
                        (winLogs.data ?? []).map((item) => (
                          <div key={item.id} className="rounded-lg border border-line bg-surface/80 backdrop-blur-md px-3 py-2">
                            <p className="text-xs font-medium text-ink">
                              {item.action === 'DOCUMENT_UPDATE'
                                ? 'Documents updated'
                                : item.action === 'FOLLOW_UP_CHANGE'
                                  ? `Follow-up extended to ${day(item.follow_up_date)}`
                                  : `${item.from_stage || '—'} → ${item.to_stage || '—'}`}
                            </p>
                            <p className="text-[11px] text-muted mt-0.5">
                              {item.actor_name || 'System'} · {formatWhen(item.created_at)}
                            </p>
                            {item.note ? <p className="text-xs text-ink mt-1">{item.note}</p> : null}
                            {(item.attachments ?? []).length > 0 ? (
                              <ul className="mt-1.5 space-y-1">
                                {item.attachments.map((file) => (
                                  <li key={file.id} className="flex items-center gap-2 text-[11px]">
                                    <FileText className="w-3 h-3 text-subtle shrink-0" />
                                    <span className="truncate text-ink">{file.file_name}</span>
                                    {file.url ? (
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-brand/30 text-brand hover:bg-brand-soft shrink-0"
                                        onClick={() => setPreviewFile(file)}
                                      >
                                        <Eye className="w-3 h-3" />
                                        Preview
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Modal>

      <Modal
        open={open}
        title={editing ? 'Edit PO' : sourceOpp ? `Add PO · ${sourceOpp.prospect_number}` : 'Add PO'}
        onClose={() => !save.isPending && closeForm()}
        wide
        footer={
          <>
            {sourceOpp && !editing ? (
              <button
                type="button"
                className={`${btnSecondaryClass} mr-auto text-danger hover:text-danger hover:border-danger`}
                disabled={save.isPending}
                onClick={() => setReportOpen(true)}
              >
                <AlertTriangle className="w-4 h-4" strokeWidth={2} aria-hidden />
                Report issue
              </button>
            ) : null}
            <button type="submit" form="po-workflow-form" disabled={save.isPending} className={btnPrimaryClass}>
              {save.isPending ? (editing ? 'Saving…' : 'Validating…') : editing ? 'Update PO' : 'Validate PO'}
            </button>
          </>
        }
      >
        <form
          id="po-workflow-form"
          onSubmit={onSubmit}
          className={splitMode ? 'grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-5' : undefined}
        >
          {splitMode ? (
            <div className="rounded-xl border border-line bg-canvas/50 p-3 flex flex-col gap-2 min-h-[380px] lg:min-h-[640px]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Win documents</p>
              {sourceAttachments.isLoading ? (
                <p className="text-xs text-muted py-8 text-center">Loading documents…</p>
              ) : winDocs.length === 0 ? (
                <p className="text-xs text-muted py-8 text-center">No attachments on the Win stage change.</p>
              ) : (
                <>
                  <ul className="space-y-1.5 shrink-0">
                    {winDocs.map((file) => {
                      const active = selectedWinDoc?.id === file.id
                      return (
                        <li key={file.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedWinDoc(file)}
                            className={`w-full flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                              active
                                ? 'border-brand bg-brand-soft text-ink'
                                : 'border-line bg-surface hover:border-brand hover:bg-brand-soft'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 text-brand shrink-0" />
                            <span className="truncate flex-1 text-ink">{file.file_name}</span>
                            <Eye className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-brand' : 'text-muted'}`} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="flex-1 min-h-0 rounded-xl border border-line bg-surface/80 backdrop-blur-md overflow-hidden">
                    <DocumentPreviewBody
                      file={selectedWinDoc}
                      compact
                      emptyMessage="Select a document to preview while filling the form."
                    />
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-3 content-start">
            {formError ? <p className="sm:col-span-2 text-sm text-danger">{formError}</p> : null}
            {sourceIssue && !editing ? (
              <div className="sm:col-span-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">
                  Issue reported by {sourceIssue.raised_by_name || 'Ops'} on {formatWhen(sourceIssue.created_at)}
                </p>
                <p className="text-xs mt-0.5">
                  {sourceIssue.reason_labels.join(', ')}. Waiting for corrected documents from the owner.
                </p>
              </div>
            ) : null}
            {(sourceOpp || form.prospect_number) ? (
              <div className="sm:col-span-2">
                <label className={labelClass}>Prospect No</label>
                <input className={`${fieldClass} bg-canvas`} value={form.prospect_number} readOnly />
              </div>
            ) : null}
            <Field label="Customer*" value={form.customer_name} onChange={(value) => setForm((prev) => ({ ...prev, customer_name: value }))} />
            <SelectField label="Billing Entity*" value={form.billing_entity} options={BILLING_ENTITIES} onChange={(value) => setForm((prev) => ({ ...prev, billing_entity: value }))} />
            <SelectField label="Service Pillar*" value={form.service_pillar} options={SERVICE_PILLARS} onChange={(value) => setForm((prev) => ({ ...prev, service_pillar: value }))} />
            <Field label="PO Number*" value={form.po_number} onChange={(value) => setForm((prev) => ({ ...prev, po_number: value }))} />
            <Field label="PO Date" type="date" value={form.po_date} onChange={(value) => setForm((prev) => ({ ...prev, po_date: value }))} />
            <SelectField label="Agreement*" value={form.agreement} options={AGREEMENTS} onChange={(value) => setForm((prev) => ({ ...prev, agreement: value }))} />
            <Field label="Start Date" type="date" value={form.start_date} onChange={(value) => setForm((prev) => ({ ...prev, start_date: value }))} />
            <Field label="End Date" type="date" value={form.end_date} onChange={(value) => setForm((prev) => ({ ...prev, end_date: value }))} />
            <Field label="Hand Over Date" type="date" value={form.expiry} onChange={(value) => setForm((prev) => ({ ...prev, expiry: value }))} />
            <Field label="Total value" value={form.total_value} onChange={(value) => setForm((prev) => ({ ...prev, total_value: value }))} />
            <Field label="Value per Invoice" value={form.value_per_invoice} onChange={(value) => setForm((prev) => ({ ...prev, value_per_invoice: value }))} />
            <SelectField
              label="Billing Cycle*"
              value={form.billing_cycle}
              options={BILLING_CYCLES}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  billing_cycle: value,
                  milestone_details: value === MILESTONE_CYCLE ? prev.milestone_details : '',
                }))
              }
            />
            <SelectField label="Billing Due*" value={form.billing_due} options={BILLING_DUES} allowCustom onChange={(value) => setForm((prev) => ({ ...prev, billing_due: value }))} />
            {form.billing_cycle === MILESTONE_CYCLE ? (
              <div className="sm:col-span-2">
                <label className={labelClass}>Milestone Details*</label>
                <input
                  className={fieldClass}
                  maxLength={255}
                  value={form.milestone_details}
                  placeholder="e.g. 40% on UAT sign-off, 60% on go-live"
                  onChange={(e) => setForm((prev) => ({ ...prev, milestone_details: e.target.value }))}
                />
              </div>
            ) : null}
          </div>
        </form>
      </Modal>

      {reportOpen && sourceOpp ? (
        <ReportPoIssueModal
          opportunityId={sourceOpp.id}
          prospectNumber={sourceOpp.prospect_number}
          ownerName={sourceOpp.owner_display}
          documents={winDocs}
          defaultDocumentId={selectedWinDoc?.id ?? null}
          onClose={() => setReportOpen(false)}
          onReported={async () => {
            setReportOpen(false)
            await queryClient.invalidateQueries({ queryKey: ['po-issues'] })
            await queryClient.invalidateQueries({ queryKey: ['pulse-opportunities'] })
          }}
        />
      ) : null}

      <DocumentPreviewModal
        open={Boolean(previewFile)}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        title="Delete PO"
        message={
          pendingDelete
            ? `Delete PO ${pendingDelete.po_display} for ${pendingDelete.customer_name}? This cannot be undone.`
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

function Timeline({ rows }: { rows: PoWorkflowDashboard['timeline'] }) {
  const dated = rows.filter((row) => row.start && row.end)
  if (rows.length === 0) {
    return <p className="text-sm text-muted py-16 text-center">No contracts in this filter.</p>
  }
  const starts = dated.map((row) => new Date(`${row.start}T00:00:00`).getTime())
  const ends = dated.map((row) => new Date(`${row.end}T00:00:00`).getTime())
  const min = starts.length ? Math.min(...starts) : 0
  const max = ends.length ? Math.max(...ends) : 1
  const span = Math.max(max - min, 1)
  const ticks = dated.length
    ? [min, min + span / 2, max].map((value) => monthLabel(new Date(value).toISOString().slice(0, 10)))
    : []

  return (
    <div className="space-y-3">
      {ticks.length ? (
        <div className="flex justify-between text-[10px] text-subtle px-1">
          {ticks.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {rows.map((row) => {
          if (!row.start || !row.end) {
            return (
              <div key={row.id} className="flex items-center gap-2 text-xs text-muted">
                <span className="w-24 truncate text-ink font-medium">{row.po_display}</span>
                <span className="flex-1 h-2 rounded-full bg-canvas" />
                <span>No dates</span>
              </div>
            )
          }
          const start = new Date(`${row.start}T00:00:00`).getTime()
          const end = new Date(`${row.end}T00:00:00`).getTime()
          const left = ((start - min) / span) * 100
          const width = Math.max(((end - start) / span) * 100, 2)
          return (
            <div key={row.id} className="flex items-center gap-2">
              <div className="w-28 min-w-0">
                <p className="text-xs text-ink truncate" title={row.po_display}>{row.customer_name}</p>
                <p className="text-[10px] text-subtle truncate">{row.po_display}</p>
              </div>
              <div className="flex-1 h-2 rounded-full bg-canvas relative">
                <div
                  className={`absolute top-0 h-2 rounded-full ${
                    row.status === 'Completed' ? 'bg-emerald-400' : 'bg-brand'
                  }`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
  edge,
}: {
  label: string
  value: string
  sub: string
  accent?: boolean
  edge?: 'brand' | 'emerald'
}) {
  const edgeClass =
    edge === 'brand'
      ? 'border-l-4 border-l-brand'
      : edge === 'emerald'
        ? 'border-l-4 border-l-emerald-500'
        : ''
  return (
    <div className={`bg-surface/80 backdrop-blur-md border border-line rounded-2xl p-4 shadow-sm ${edgeClass} ${accent ? 'bg-brand-soft/40' : ''}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-xl font-semibold text-ink mt-1 tabular-nums">{value}</p>
      <p className="text-[11px] text-subtle mt-1">{sub}</p>
    </div>
  )
}

function StatusPill({ status }: { status: 'Active' | 'Completed' }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
        status === 'Completed'
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800'
          : 'bg-brand-soft text-brand border border-brand/20'
      }`}
    >
      {status}
    </span>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  allowCustom,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  allowCustom?: boolean
}) {
  const id = `po-sel-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      {allowCustom ? (
        <>
          <input
            id={id}
            list={`${id}-list`}
            className={fieldClass}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <datalist id={`${id}-list`}>
            {options.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </>
      ) : (
        <select id={id} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
    </div>
  )
}
