import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { btnPrimaryClass, btnSecondaryClass } from './Modal'
import {
  PRESET_OPTIONS,
  addMonths,
  compareISO,
  daysInMonth,
  formatMonthTitle,
  formatRangeLabel,
  matchPreset,
  parseISO,
  resolvePreset,
  defaultOpsDateRange,
  toISO,
  weekdaySun0,
  type DateRange,
  type PresetId,
} from '../lib/dateRange'

type UniversalCalendarProps = {
  from: string
  to: string
  onChange: (next: DateRange) => void
  /** Defaults to "Date range" */
  label?: string
  compact?: boolean
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
const PANEL_WIDTH = 672 // ~42rem

function MonthGrid({
  year,
  month,
  draftFrom,
  draftTo,
  pickingStart,
  onPick,
}: {
  year: number
  month: number
  draftFrom: string
  draftTo: string
  pickingStart: boolean
  onPick: (iso: string) => void
}) {
  const firstDow = weekdaySun0(year, month, 1)
  const total = daysInMonth(year, month)
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(toISO(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-brand text-center mb-2">{formatMonthTitle(year, month)}</p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-[10px] font-semibold text-brand/80 text-center py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((iso, idx) => {
          if (!iso) return <span key={`e-${idx}`} className="h-8" />
          const inRange =
            draftFrom &&
            draftTo &&
            compareISO(iso, draftFrom) >= 0 &&
            compareISO(iso, draftTo) <= 0
          const isStart = iso === draftFrom
          const isEnd = iso === draftTo
          const isEdge = isStart || isEnd
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className={`h-8 text-xs rounded-lg tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                isEdge
                  ? 'bg-brand text-white font-semibold'
                  : inRange
                    ? 'bg-brand-soft text-brand font-medium'
                    : 'text-ink hover:bg-brand-soft/60'
              } ${pickingStart && !draftFrom ? 'ring-1 ring-brand/30' : ''}`}
            >
              {Number(iso.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function UniversalCalendar({
  from,
  to,
  onChange,
  label = 'Date range',
  compact = false,
}: UniversalCalendarProps) {
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [pickingStart, setPickingStart] = useState(true)
  const [activePreset, setActivePreset] = useState<PresetId | null>(() => matchPreset(from, to))
  const [viewY, setViewY] = useState(() => {
    const p = parseISO(from) ?? parseISO(to)
    if (p) return p.y
    const now = new Date()
    return now.getFullYear()
  })
  const [viewM, setViewM] = useState(() => {
    const p = parseISO(from) ?? parseISO(to)
    if (p) return p.m
    return new Date().getMonth() + 1
  })
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: PANEL_WIDTH,
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const updatePanelPosition = () => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = Math.min(window.innerWidth - 24, PANEL_WIDTH)
    let left = rect.right - width
    if (left < 12) left = 12
    if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12)
    setPanelPos({ top: rect.bottom + 8, left, width })
  }

  useEffect(() => {
    if (!open) return
    setDraftFrom(from)
    setDraftTo(to)
    setActivePreset(matchPreset(from, to))
    setPickingStart(true)
    const p = parseISO(from) ?? parseISO(to)
    if (p) {
      setViewY(p.y)
      setViewM(p.m)
    }
  }, [open, from, to])

  useLayoutEffect(() => {
    if (!open) return
    updatePanelPosition()
    const onResize = () => updatePanelPosition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const second = useMemo(() => addMonths(viewY, viewM, 1), [viewY, viewM])
  const headerLabel = formatRangeLabel(draftFrom, draftTo)
  const appliedLabel = formatRangeLabel(from, to)

  const shiftMonths = (delta: number) => {
    const next = addMonths(viewY, viewM, delta)
    setViewY(next.y)
    setViewM(next.m)
  }

  const applyPreset = (id: PresetId) => {
    setActivePreset(id)
    if (id === 'custom') {
      setPickingStart(true)
      return
    }
    if (id === 'specific') {
      setPickingStart(true)
      if (draftFrom) {
        setDraftTo(draftFrom)
      }
      return
    }
    const range = resolvePreset(id)
    if (!range) return
    setDraftFrom(range.from)
    setDraftTo(range.to)
    if (range.from) {
      const p = parseISO(range.from)!
      setViewY(p.y)
      setViewM(p.m)
    }
    setPickingStart(true)
  }

  const pickDay = (iso: string) => {
    if (activePreset === 'specific') {
      setDraftFrom(iso)
      setDraftTo(iso)
      setActivePreset('specific')
      setPickingStart(true)
      return
    }
    setActivePreset('custom')
    if (pickingStart || !draftFrom) {
      setDraftFrom(iso)
      setDraftTo('')
      setPickingStart(false)
      return
    }
    if (compareISO(iso, draftFrom) < 0) {
      setDraftFrom(iso)
      setDraftTo(draftFrom)
    } else {
      setDraftTo(iso)
    }
    setPickingStart(true)
  }

  const commit = () => {
    let nextFrom = draftFrom
    let nextTo = draftTo
    if (nextFrom && !nextTo) nextTo = nextFrom
    if (nextTo && !nextFrom) nextFrom = nextTo
    if (nextFrom && nextTo && compareISO(nextFrom, nextTo) > 0) {
      const tmp = nextFrom
      nextFrom = nextTo
      nextTo = tmp
    }
    onChange({ from: nextFrom, to: nextTo })
    setOpen(false)
  }

  const clearApplied = () => {
    onChange(defaultOpsDateRange())
    setOpen(false)
  }

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[80] overflow-y-auto rounded-2xl border border-line bg-surface shadow-[0_20px_50px_-24px_rgba(63,68,145,0.45)]"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: `min(40rem, calc(100dvh - ${panelPos.top + 12}px))`,
          }}
        >
          <div className="flex flex-col md:flex-row">
            <div className="flex-1 min-w-0 p-4 border-b md:border-b-0 md:border-r border-line">
              <div className="flex items-center justify-between gap-2 mb-4">
                <button
                  type="button"
                  aria-label="Previous months"
                  onClick={() => shiftMonths(-1)}
                  className="p-1.5 rounded-lg text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2.25} />
                </button>
                <p className="text-sm font-semibold text-brand tabular-nums text-center">{headerLabel}</p>
                <button
                  type="button"
                  aria-label="Next months"
                  onClick={() => shiftMonths(1)}
                  className="p-1.5 rounded-lg text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MonthGrid
                  year={viewY}
                  month={viewM}
                  draftFrom={draftFrom}
                  draftTo={draftTo}
                  pickingStart={pickingStart}
                  onPick={pickDay}
                />
                <MonthGrid
                  year={second.y}
                  month={second.m}
                  draftFrom={draftFrom}
                  draftTo={draftTo}
                  pickingStart={pickingStart}
                  onPick={pickDay}
                />
              </div>
            </div>

            <div className="md:w-44 shrink-0 p-2 md:p-3 bg-canvas max-h-64 md:max-h-none overflow-x-auto md:overflow-y-auto">
              <div className="flex md:flex-col gap-1 min-w-max md:min-w-0">
                {PRESET_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => applyPreset(opt.id)}
                    className={`text-left text-sm px-3 py-2 rounded-lg whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      activePreset === opt.id
                        ? 'bg-brand-soft text-brand font-semibold'
                        : 'text-brand hover:bg-surface'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line bg-surface">
            <p className="text-xs font-medium text-brand/80">Timezone: IST</p>
            <button type="button" className={`${btnPrimaryClass} !bg-brand hover:!bg-brand-hover`} onClick={commit}>
              Update
            </button>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <div className={`flex flex-nowrap items-center gap-2 shrink-0 ${compact ? '' : 'items-end flex-wrap'}`}>
        {!compact ? (
          <span className="text-[11px] font-medium text-muted w-full mb-0.5">{label}</span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={label}
          className={`inline-flex items-center gap-2 shrink-0 rounded-xl border border-brand/25 bg-gradient-to-br from-brand-soft/80 to-surface text-sm font-medium text-ink shadow-sm hover:border-brand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            compact ? 'px-2.5 py-1.5' : 'rounded-2xl px-3 py-2.5'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-brand shrink-0" strokeWidth={2} />
          {compact ? <span className="text-[11px] text-muted font-medium hidden sm:inline">{label}</span> : null}
          <span className="tabular-nums whitespace-nowrap text-xs sm:text-sm">{appliedLabel}</span>
        </button>
        <button
          type="button"
          className={`${btnSecondaryClass} shrink-0 ${compact ? '!px-2 !py-1.5 text-xs' : '!px-3 !py-2'}`}
          onClick={clearApplied}
          title="Reset to default date range (prior + current FY)"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
          Clear
        </button>
      </div>
      {panel}
    </div>
  )
}
