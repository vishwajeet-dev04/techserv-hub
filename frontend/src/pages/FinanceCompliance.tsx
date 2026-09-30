import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  List,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { financeApi } from '../api/finance'
import { getErrorMessage } from '../api/errors'
import { notify } from '../lib/notify'
import Modal, {
  btnPrimaryClass,
  btnSecondaryClass,
  btnRowDeleteClass,
  fieldClass,
  labelClass,
} from '../components/Modal'
import type { ComplianceItem, ComplianceStatus } from '../types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const ACT_OPTIONS = [
  'Income Tax',
  'GST',
  'State Law',
  'ESIC Act',
  'EPF Act',
  'Companies Act',
  'FEMA',
  'Companies Act / Tax / GST',
]

const STATUS_OPTIONS: { id: ComplianceStatus; label: string }[] = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'NOT_APPLICABLE', label: 'Not applicable' },
]

type ActFamily = 'tax' | 'gst' | 'labour' | 'companies' | 'other'
type CalendarView = 'month' | 'week' | 'list'

const FAMILIES: ActFamily[] = ['tax', 'gst', 'labour', 'companies', 'other']

const FAMILY_META: Record<ActFamily, { label: string; dot: string; pill: string }> = {
  tax: {
    label: 'Direct Tax',
    dot: 'bg-sky-500',
    pill: 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-100 dark:border-sky-800',
  },
  gst: {
    label: 'Indirect Tax (GST)',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800',
  },
  labour: {
    label: 'Labour & Payroll',
    dot: 'bg-violet-500',
    pill: 'bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border-violet-100 dark:border-violet-800',
  },
  companies: {
    label: 'ROC & Corporate',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 border-amber-100 dark:border-amber-800',
  },
  other: {
    label: 'Other',
    dot: 'bg-pink-500',
    pill: 'bg-pink-50 text-pink-800 border-pink-100',
  },
}

type Draft = {
  title: string
  form_name: string
  applicable_act: string
  period_month: string
  due_date: string
  due_date_note: string
  status: ComplianceStatus
  notes: string
}

type MonthCell = {
  day: number
  iso: string
  inMonth: boolean
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function firstOfMonthISO(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfWeek(d: Date) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  next.setDate(next.getDate() - next.getDay())
  return next
}

function actFamily(act: string): ActFamily {
  const a = act.toLowerCase()
  if (a.includes('gst')) return 'gst'
  if (a.includes('income tax')) return 'tax'
  if (a.includes('esic') || a.includes('epf')) return 'labour'
  if (a.includes('companies') || a.includes('fema') || a.includes('state')) return 'companies'
  if (a.includes('tax')) return 'tax'
  return 'other'
}

function emptyDraft(periodMonth: string, dueDate = ''): Draft {
  return {
    title: '',
    form_name: '',
    applicable_act: 'GST',
    period_month: periodMonth,
    due_date: dueDate,
    due_date_note: '',
    status: 'PENDING',
    notes: '',
  }
}

function fromItem(item: ComplianceItem): Draft {
  return {
    title: item.title,
    form_name: item.form_name,
    applicable_act: item.applicable_act,
    period_month: item.period_month.slice(0, 10),
    due_date: item.due_date ? item.due_date.slice(0, 10) : '',
    due_date_note: item.due_date_note,
    status: item.status,
    notes: item.notes,
  }
}

function buildMonthCells(year: number, monthIndex: number): MonthCell[] {
  const first = new Date(year, monthIndex, 1)
  const start = startOfWeek(first)
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({
      day: date.getDate(),
      iso: toIsoDate(date),
      inMonth: date.getMonth() === monthIndex,
    })
  }
  return cells
}

function EventPill({
  item,
  onOpen,
}: {
  item: ComplianceItem
  onOpen: (item: ComplianceItem) => void
}) {
  const family = actFamily(item.applicable_act)
  const done = item.status === 'COMPLETED'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(item)
      }}
      title={`${item.title} · ${item.form_name || item.applicable_act}`}
      className={`flex w-full items-center gap-1 truncate rounded-md border px-1 py-0.5 text-[10px] leading-tight font-medium text-left ${
        done ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-800 line-through opacity-70' : FAMILY_META[family].pill
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-slate-400' : FAMILY_META[family].dot}`}
        aria-hidden
      />
      <span className="truncate">{item.form_name || item.title}</span>
    </button>
  )
}

function DayCell({
  cell,
  items,
  isToday,
  tall,
  onDayClick,
  onOpenItem,
}: {
  cell: MonthCell
  items: ComplianceItem[]
  isToday: boolean
  tall?: boolean
  onDayClick: (iso: string) => void
  onOpenItem: (item: ComplianceItem) => void
}) {
  const maxVisible = tall ? 8 : 3
  return (
    <button
      type="button"
      onClick={() => onDayClick(cell.iso)}
      className={`rounded-xl border p-1.5 text-left align-top transition-colors hover:border-brand/40 hover:bg-brand-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        tall ? 'min-h-[12rem]' : 'min-h-[5.5rem] sm:min-h-[7rem]'
      } ${
        isToday
          ? 'border-brand/40 bg-brand-soft/30'
          : cell.inMonth
            ? 'border-line bg-surface'
            : 'border-transparent bg-canvas/40'
      }`}
    >
      <span
        className={`inline-flex w-6 h-6 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
          isToday
            ? 'bg-brand text-white'
            : cell.inMonth
              ? 'text-ink'
              : 'text-subtle'
        }`}
      >
        {cell.day}
      </span>
      <div className={`mt-1 space-y-0.5 ${tall ? 'max-h-[9rem]' : 'max-h-[4.5rem] sm:max-h-[5rem]'} overflow-y-auto`}>
        {items.slice(0, maxVisible).map((item) => (
          <EventPill key={item.id} item={item} onOpen={onOpenItem} />
        ))}
        {items.length > maxVisible ? (
          <span className="text-[10px] text-muted px-1">+{items.length - maxVisible} more</span>
        ) : null}
      </div>
    </button>
  )
}

export default function FinanceCompliance() {
  const queryClient = useQueryClient()
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])
  const todayIso = toIsoDate(today)

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [focusDay, setFocusDay] = useState(todayIso)
  const [view, setView] = useState<CalendarView>('month')
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus[]>([])
  const [familyFilter, setFamilyFilter] = useState<ActFamily[]>([])
  const [editing, setEditing] = useState<ComplianceItem | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [formError, setFormError] = useState('')
  const [dueDateScope, setDueDateScope] = useState<'this_month' | 'recurring'>('this_month')
  const filterRef = useRef<HTMLDivElement | null>(null)

  const year = cursor.getFullYear()
  const monthIndex = cursor.getMonth()
  const monthParam = monthKey(cursor)
  const periodMonthDefault = firstOfMonthISO(year, monthIndex)

  useEffect(() => {
    if (!filterOpen) return
    const onPointer = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [filterOpen])

  const list = useQuery({
    queryKey: ['finance-compliance', monthParam],
    queryFn: () => financeApi.listCompliance({ month: monthParam, page_size: 200 }),
  })

  const items = list.data?.results ?? []

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter.length && !statusFilter.includes(item.status)) return false
      if (familyFilter.length && !familyFilter.includes(actFamily(item.applicable_act))) return false
      return true
    })
  }, [items, statusFilter, familyFilter])

  const byDueDate = useMemo(() => {
    const map = new Map<string, ComplianceItem[]>()
    for (const item of filteredItems) {
      if (!item.due_date) continue
      const key = item.due_date.slice(0, 10)
      const bucket = map.get(key) ?? []
      bucket.push(item)
      map.set(key, bucket)
    }
    return map
  }, [filteredItems])

  const softItems = useMemo(
    () => filteredItems.filter((item) => !item.due_date),
    [filteredItems],
  )

  const datedSorted = useMemo(() => {
    return filteredItems
      .filter((item) => item.due_date)
      .slice()
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
  }, [filteredItems])

  const upcoming = useMemo(() => {
    const inViewedMonth =
      today.getFullYear() === year && today.getMonth() === monthIndex
    const floor = inViewedMonth ? todayIso : firstOfMonthISO(year, monthIndex)
    return datedSorted
      .filter((item) => item.status === 'PENDING' && String(item.due_date).slice(0, 10) >= floor)
      .slice(0, 4)
  }, [datedSorted, today, year, monthIndex, todayIso])

  const cells = useMemo(() => buildMonthCells(year, monthIndex), [year, monthIndex])
  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const weekStart = useMemo(() => {
    const focus = parseIsoDate(focusDay)
    const inMonth = focus.getFullYear() === year && focus.getMonth() === monthIndex
    const base = inMonth ? focus : new Date(year, monthIndex, 1)
    return startOfWeek(base)
  }, [focusDay, year, monthIndex])

  const weekCells = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
      return {
        day: date.getDate(),
        iso: toIsoDate(date),
        inMonth: date.getMonth() === monthIndex,
      } satisfies MonthCell
    })
  }, [weekStart, monthIndex])

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6)
    const startLabel = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const endLabel = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${startLabel} – ${endLabel}`
  }, [weekStart])

  const filtersActive = statusFilter.length > 0 || familyFilter.length > 0

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['finance-compliance'] })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No draft')
      if (!draft.title.trim()) throw new Error('Title is required.')
      const payload = {
        title: draft.title.trim(),
        form_name: draft.form_name.trim(),
        applicable_act: draft.applicable_act.trim() || 'Other',
        period_month: draft.period_month.slice(0, 7) + '-01',
        due_date: draft.due_date || null,
        due_date_note: draft.due_date_note.trim(),
        status: draft.status,
        notes: draft.notes.trim(),
      }
      if (editing) {
        const originalDue = editing.due_date ? editing.due_date.slice(0, 10) : ''
        const dueChanged = draft.due_date !== originalDue
        return financeApi.updateCompliance(editing.id, {
          ...payload,
          ...(dueChanged ? { due_date_scope: dueDateScope } : {}),
        })
      }
      return financeApi.createCompliance(payload)
    },
    onSuccess: () => {
      setDraft(null)
      setEditing(null)
      setFormError('')
      setDueDateScope('this_month')
      invalidate()
      notify.success(editing ? 'Compliance item updated.' : 'Compliance item created.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not save compliance item.')
      setFormError(message)
      notify.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('Nothing to delete')
      await financeApi.deleteCompliance(editing.id)
    },
    onSuccess: () => {
      setDraft(null)
      setEditing(null)
      invalidate()
      notify.success('Compliance item deleted.')
    },
    onError: (err) => {
      const message = getErrorMessage(err, 'Could not delete compliance item.')
      setFormError(message)
      notify.error(message)
    },
  })

  const openCreate = (dueDate = '') => {
    setEditing(null)
    setFormError('')
    setDueDateScope('this_month')
    setDraft(emptyDraft(periodMonthDefault, dueDate))
  }

  const openEdit = (item: ComplianceItem) => {
    setEditing(item)
    setFormError('')
    setDueDateScope('this_month')
    setDraft(fromItem(item))
  }

  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setFocusDay(todayIso)
  }

  const goPrev = () => {
    if (view === 'week') {
      const next = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7)
      setFocusDay(toIsoDate(next))
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1))
      return
    }
    setCursor(new Date(year, monthIndex - 1, 1))
    setFocusDay(firstOfMonthISO(year, monthIndex - 1))
  }

  const goNext = () => {
    if (view === 'week') {
      const next = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7)
      setFocusDay(toIsoDate(next))
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1))
      return
    }
    setCursor(new Date(year, monthIndex + 1, 1))
    setFocusDay(firstOfMonthISO(year, monthIndex + 1))
  }

  const onDayClick = (iso: string) => {
    setFocusDay(iso)
    const dayItems = byDueDate.get(iso) ?? []
    if (dayItems.length === 0) openCreate(iso)
  }

  const toggleStatus = (status: ComplianceStatus) => {
    setStatusFilter((current) =>
      current.includes(status) ? current.filter((s) => s !== status) : [...current, status],
    )
  }

  const toggleFamily = (family: ActFamily) => {
    setFamilyFilter((current) =>
      current.includes(family) ? current.filter((f) => f !== family) : [...current, family],
    )
  }

  const clearFilters = () => {
    setStatusFilter([])
    setFamilyFilter([])
  }

  const viewButtons: { id: CalendarView; label: string; icon?: ReactNode }[] = [
    { id: 'month', label: 'Month' },
    { id: 'week', label: 'Week' },
    { id: 'list', label: 'List', icon: <List className="w-3.5 h-3.5" strokeWidth={2} aria-hidden /> },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5 min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
            Financial Control
          </p>
          <h2 className="text-2xl font-semibold text-ink mt-1">Compliance Calendar</h2>
          <p className="text-sm text-muted mt-1">
            Statutory filings and dues for Private Limited companies (India). Seeded from FY 2026–27 reference.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-3 rounded-2xl border border-violet-200/80 dark:border-violet-800 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 dark:from-violet-950/40 dark:via-surface dark:to-surface px-4 py-3 shadow-sm max-w-sm">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink leading-tight">Stay compliant, stay ahead.</p>
              <p className="text-xs text-muted mt-0.5 leading-snug">
                Track all your statutory filings and important deadlines in one place.
              </p>
            </div>
          </div>
          <button type="button" className={btnPrimaryClass} onClick={() => openCreate()}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            Add compliance
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="bg-surface border border-line rounded-2xl shadow-sm overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-line flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={`${btnSecondaryClass} !px-2.5 !py-1.5`}
                  aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
                  onClick={goPrev}
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                </button>
                <button type="button" className={`${btnSecondaryClass} !px-3 !py-1.5 !text-xs`} onClick={goToday}>
                  Today
                </button>
                <button
                  type="button"
                  className={`${btnSecondaryClass} !px-2.5 !py-1.5`}
                  aria-label={view === 'week' ? 'Next week' : 'Next month'}
                  onClick={goNext}
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
                <CalendarDays className="w-4 h-4 text-brand shrink-0" strokeWidth={2} aria-hidden />
                <h3 className="text-base font-semibold text-ink tabular-nums truncate">
                  {view === 'week' ? weekLabel : monthLabel}
                </h3>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <div className="inline-flex rounded-xl border border-line bg-canvas/60 p-0.5">
                  {viewButtons.map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setView(btn.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-[10px] transition-colors ${
                        view === btn.id
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      {btn.icon}
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="relative" ref={filterRef}>
                  <button
                    type="button"
                    className={`${btnSecondaryClass} !px-2.5 !py-1.5 ${filtersActive ? '!border-brand !text-brand' : ''}`}
                    onClick={() => setFilterOpen((open) => !open)}
                    aria-expanded={filterOpen}
                  >
                    <Filter className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                    Filter
                  </button>
                  {filterOpen ? (
                    <div className="absolute right-0 top-full mt-2 z-30 w-64 rounded-2xl border border-line bg-surface p-3 shadow-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Filters</p>
                        <button
                          type="button"
                          className="text-xs text-brand hover:text-brand-hover"
                          onClick={clearFilters}
                        >
                          Clear
                        </button>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-ink mb-1.5">Status</p>
                        <div className="space-y-1">
                          {STATUS_OPTIONS.map((opt) => (
                            <label key={opt.id} className="flex items-center gap-2 text-sm text-ink">
                              <input
                                type="checkbox"
                                checked={statusFilter.includes(opt.id)}
                                onChange={() => toggleStatus(opt.id)}
                                className="rounded border-line text-brand focus:ring-brand"
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-ink mb-1.5">Compliance type</p>
                        <div className="space-y-1">
                          {FAMILIES.map((family) => (
                            <label key={family} className="flex items-center gap-2 text-sm text-ink">
                              <input
                                type="checkbox"
                                checked={familyFilter.includes(family)}
                                onChange={() => toggleFamily(family)}
                                className="rounded border-line text-brand focus:ring-brand"
                              />
                              <span className={`w-2 h-2 rounded-full ${FAMILY_META[family].dot}`} aria-hidden />
                              {FAMILY_META[family].label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {list.isLoading ? (
              <p className="px-4 py-10 text-sm text-muted">Loading compliance items…</p>
            ) : list.isError ? (
              <p className="px-4 py-10 text-sm text-danger">{getErrorMessage(list.error)}</p>
            ) : view === 'list' ? (
              <div className="divide-y divide-canvas">
                {datedSorted.length === 0 ? (
                  <p className="px-4 py-10 text-sm text-subtle">No dated items this month.</p>
                ) : (
                  datedSorted.map((item) => {
                    const family = actFamily(item.applicable_act)
                    const due = String(item.due_date).slice(0, 10)
                    const dueLabel = parseIsoDate(due).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                    })
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openEdit(item)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-canvas/60 transition-colors"
                      >
                        <span className="w-14 shrink-0 text-xs font-semibold text-muted tabular-nums">
                          {dueLabel}
                        </span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${FAMILY_META[family].dot}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink truncate">
                            {item.form_name || item.title}
                          </span>
                          <span className="block text-[12px] text-muted truncate">{item.title}</span>
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${
                            item.status === 'PENDING'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : item.status === 'COMPLETED'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-canvas text-muted border-line'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                        <ChevronRight className="w-4 h-4 text-subtle shrink-0" strokeWidth={2} aria-hidden />
                      </button>
                    )
                  })
                )}
              </div>
            ) : view === 'week' ? (
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[10px] font-semibold uppercase tracking-wider text-subtle py-1"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekCells.map((cell) => (
                    <DayCell
                      key={cell.iso}
                      cell={cell}
                      items={byDueDate.get(cell.iso) ?? []}
                      isToday={cell.iso === todayIso}
                      tall
                      onDayClick={onDayClick}
                      onOpenItem={openEdit}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[10px] font-semibold uppercase tracking-wider text-subtle py-1"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 auto-rows-fr">
                  {cells.map((cell) => (
                    <DayCell
                      key={cell.iso}
                      cell={cell}
                      items={cell.inMonth ? byDueDate.get(cell.iso) ?? [] : []}
                      isToday={cell.iso === todayIso}
                      onDayClick={onDayClick}
                      onOpenItem={openEdit}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface border border-line rounded-2xl shadow-sm p-4 sm:p-5">
            <div className="flex items-start gap-2">
              <List className="w-4 h-4 text-brand mt-0.5 shrink-0" strokeWidth={2} aria-hidden />
              <div>
                <h3 className="text-sm font-semibold text-ink">This month — soft deadlines</h3>
                <p className="text-[12px] text-muted mt-0.5">
                  Items without a fixed calendar due date (e.g. “As prescribed”, “Within statutory period”).
                </p>
              </div>
            </div>
            {softItems.length === 0 ? (
              <p className="text-sm text-subtle mt-3">No soft-deadline items this month.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {softItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="w-full text-left rounded-xl border border-line border-l-4 border-l-brand bg-surface px-3 py-3 flex items-center gap-3 hover:bg-canvas/50 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{item.title}</span>
                        <span className="block text-[12px] text-muted mt-0.5">
                          {[item.form_name, item.applicable_act].filter(Boolean).join(' · ')}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-1.5">
                          {item.due_date_note ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-line bg-canvas text-muted">
                              {item.due_date_note}
                            </span>
                          ) : null}
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                              item.status === 'PENDING'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : item.status === 'COMPLETED'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-canvas text-muted border-line'
                            }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-subtle shrink-0" strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <div className="bg-surface border border-line rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                className="p-1 rounded-lg text-muted hover:bg-canvas hover:text-ink"
                aria-label="Previous month"
                onClick={() => {
                  setCursor(new Date(year, monthIndex - 1, 1))
                  setFocusDay(firstOfMonthISO(year, monthIndex - 1))
                }}
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <p className="text-sm font-semibold text-ink tabular-nums">{monthLabel}</p>
              <button
                type="button"
                className="p-1 rounded-lg text-muted hover:bg-canvas hover:text-ink"
                aria-label="Next month"
                onClick={() => {
                  setCursor(new Date(year, monthIndex + 1, 1))
                  setFocusDay(firstOfMonthISO(year, monthIndex + 1))
                }}
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEKDAYS_SHORT.map((d, i) => (
                <div key={`${d}-${i}`} className="text-center text-[10px] font-semibold text-subtle py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                const hasEvents = cell.inMonth && (byDueDate.get(cell.iso)?.length ?? 0) > 0
                const isToday = cell.iso === todayIso
                return (
                  <button
                    key={`mini-${cell.iso}`}
                    type="button"
                    onClick={() => {
                      setFocusDay(cell.iso)
                      if (cell.inMonth) {
                        const dayItems = byDueDate.get(cell.iso) ?? []
                        if (dayItems.length === 0) openCreate(cell.iso)
                      } else {
                        const d = parseIsoDate(cell.iso)
                        setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
                      }
                    }}
                    className={`relative h-8 rounded-lg text-[11px] font-medium tabular-nums transition-colors ${
                      isToday
                        ? 'bg-brand text-white'
                        : cell.inMonth
                          ? 'text-ink hover:bg-brand-soft/50'
                          : 'text-subtle hover:bg-canvas'
                    }`}
                  >
                    {cell.day}
                    {hasEvents && !isToday ? (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-surface border border-line rounded-2xl shadow-sm p-4">
            <p className="text-sm font-semibold text-ink mb-3">Compliance types</p>
            <ul className="space-y-2.5">
              {FAMILIES.map((family) => (
                <li key={family} className="flex items-center gap-2.5 text-sm text-ink">
                  <span className={`w-2.5 h-2.5 rounded-full ${FAMILY_META[family].dot}`} aria-hidden />
                  {FAMILY_META[family].label}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface border border-line rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink">Upcoming (This Month)</p>
              <button
                type="button"
                className="text-xs font-medium text-brand hover:text-brand-hover"
                onClick={() => setView('list')}
              >
                View all
              </button>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-subtle">No upcoming pending items.</p>
            ) : (
              <ul className="space-y-1">
                {upcoming.map((item) => {
                  const family = actFamily(item.applicable_act)
                  const due = String(item.due_date).slice(0, 10)
                  const dueLabel = parseIsoDate(due).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  })
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="w-full flex items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-canvas transition-colors"
                      >
                        <span className="w-12 shrink-0 text-[11px] font-semibold text-muted tabular-nums">
                          {dueLabel}
                        </span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${FAMILY_META[family].dot}`} aria-hidden />
                        <span className="min-w-0 flex-1 text-sm text-ink truncate">
                          {item.form_name || item.title}
                        </span>
                        <ChevronRight className="w-4 h-4 text-subtle shrink-0" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={Boolean(draft)}
        title={editing ? 'Edit compliance' : 'Add compliance'}
        wide
        onClose={() => {
          setDraft(null)
          setEditing(null)
          setFormError('')
        }}
        footer={
          draft ? (
            <div className="flex items-center justify-between gap-3 w-full">
              {editing ? (
                <button
                  type="button"
                  className={btnRowDeleteClass}
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm('Delete this compliance item?')) deleteMutation.mutate()
                  }}
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={btnSecondaryClass}
                  onClick={() => {
                    setDraft(null)
                    setEditing(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={btnPrimaryClass}
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {draft ? (
          <>
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <div>
              <label className={labelClass} htmlFor="c-title">Title</label>
              <input
                id="c-title"
                className={fieldClass}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Compliance / particulars"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="c-form">Form</label>
                <input
                  id="c-form"
                  className={fieldClass}
                  value={draft.form_name}
                  onChange={(e) => setDraft({ ...draft, form_name: e.target.value })}
                  placeholder="e.g. GSTR-3B"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="c-act">Applicable act</label>
                <input
                  id="c-act"
                  list="compliance-acts"
                  className={fieldClass}
                  value={draft.applicable_act}
                  onChange={(e) => setDraft({ ...draft, applicable_act: e.target.value })}
                />
                <datalist id="compliance-acts">
                  {ACT_OPTIONS.map((act) => (
                    <option key={act} value={act} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="c-period">Period month</label>
                <input
                  id="c-period"
                  type="month"
                  className={fieldClass}
                  value={draft.period_month.slice(0, 7)}
                  onChange={(e) => setDraft({ ...draft, period_month: `${e.target.value}-01` })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="c-due">Due date (optional)</label>
                <input
                  id="c-due"
                  type="date"
                  className={fieldClass}
                  value={draft.due_date}
                  onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                />
                {editing
                && draft.due_date
                && draft.due_date !== (editing.due_date ? editing.due_date.slice(0, 10) : '')
                  ? (
                    <fieldset className="mt-3 space-y-2">
                      <legend className="text-xs font-medium text-muted">Apply due date change to</legend>
                      <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="due-date-scope"
                          className="mt-0.5"
                          checked={dueDateScope === 'this_month'}
                          onChange={() => setDueDateScope('this_month')}
                        />
                        <span>
                          <span className="font-medium">This month only</span>
                          <span className="block text-xs text-muted">Update only this compliance item</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="due-date-scope"
                          className="mt-0.5"
                          checked={dueDateScope === 'recurring'}
                          onChange={() => setDueDateScope('recurring')}
                          disabled={!draft.form_name.trim()}
                        />
                        <span>
                          <span className="font-medium">All recurring months</span>
                          <span className="block text-xs text-muted">
                            {draft.form_name.trim()
                              ? 'Applies the same day of month to other months with this form'
                              : 'Add a form name to update recurring months'}
                          </span>
                        </span>
                      </label>
                    </fieldset>
                    )
                  : null}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="c-note">Due date note</label>
              <input
                id="c-note"
                className={fieldClass}
                value={draft.due_date_note}
                onChange={(e) => setDraft({ ...draft, due_date_note: e.target.value })}
                placeholder="e.g. As prescribed, Within statutory period"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="c-status">Status</label>
                <select
                  id="c-status"
                  className={fieldClass}
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as ComplianceStatus })}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="c-notes">Notes</label>
                <input
                  id="c-notes"
                  className={fieldClass}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  )
}
