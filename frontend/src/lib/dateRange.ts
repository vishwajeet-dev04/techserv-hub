/** Date-range helpers for Universal Calendar. All "today" / preset math uses Asia/Kolkata (IST). */

export type DateRange = { from: string; to: string }

export type PresetId =
  | 'last_60'
  | 'last_90'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'specific'
  | 'custom'

const IST = 'Asia/Kolkata'

/** Parts of "now" in IST as calendar Y/M/D. */
export function istTodayParts(now = new Date()): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

export function parseISO(iso: string): { y: number; m: number; d: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

/** UTC noon date for stable weekday/calendar math without local TZ shift. */
export function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

export function addDaysISO(iso: string, days: number): string {
  const p = parseISO(iso)
  if (!p) return iso
  const dt = utcDate(p.y, p.m, p.d)
  dt.setUTCDate(dt.getUTCDate() + days)
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 }
}

export function compareISO(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function formatDayLabel(iso: string): string {
  const p = parseISO(iso)
  if (!p) return iso
  const dt = utcDate(p.y, p.m, p.d)
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatRangeLabel(from: string, to: string): string {
  if (from && to) return `${formatDayLabel(from)} – ${formatDayLabel(to)}`
  if (from) return `From ${formatDayLabel(from)}`
  if (to) return `Until ${formatDayLabel(to)}`
  const fy = thisFinancialYear()
  return `${formatDayLabel(fy.from)} – ${formatDayLabel(fy.to)}`
}

export function formatMonthTitle(y: number, m: number): string {
  return utcDate(y, m, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Sunday = 0 … Saturday = 6 (matches SU MO TU WE TH FR SA). */
export function weekdaySun0(y: number, m: number, d: number): number {
  return utcDate(y, m, d).getUTCDay()
}

export function istTodayISO(now = new Date()): string {
  const { y, m, d } = istTodayParts(now)
  return toISO(y, m, d)
}

/** Indian FY: Apr 1 → Mar 31. Returns FY start year (e.g. 2026 for Apr 2026–Mar 2027). */
export function fyStartYear(iso: string): number {
  const p = parseISO(iso)
  if (!p) return istTodayParts().y
  return p.m >= 4 ? p.y : p.y - 1
}

export function thisFinancialYear(now = new Date()): DateRange {
  const today = istTodayISO(now)
  const startY = fyStartYear(today)
  return { from: toISO(startY, 4, 1), to: toISO(startY + 1, 3, 31) }
}

/** Previous Indian FY (Apr 1 → Mar 31). */
export function lastFinancialYear(now = new Date()): DateRange {
  const thisFy = thisFinancialYear(now)
  const startY = fyStartYear(thisFy.from) - 1
  return { from: toISO(startY, 4, 1), to: toISO(startY + 1, 3, 31) }
}

/**
 * Default ops/finance header range: previous FY start through current FY end.
 * Covers carry-over books (e.g. MIS still dated in the prior year) without dropping
 * the calendar filter entirely.
 */
export function defaultOpsDateRange(now = new Date()): DateRange {
  const thisFy = thisFinancialYear(now)
  const prior = lastFinancialYear(now)
  return { from: prior.from, to: thisFy.to }
}

/** FY quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar. */
export function fyQuarterRange(iso: string): DateRange {
  const p = parseISO(iso) ?? istTodayParts()
  const startY = fyStartYear(toISO(p.y, p.m, p.d))
  if (p.m >= 4 && p.m <= 6) return { from: toISO(startY, 4, 1), to: toISO(startY, 6, 30) }
  if (p.m >= 7 && p.m <= 9) return { from: toISO(startY, 7, 1), to: toISO(startY, 9, 30) }
  if (p.m >= 10 && p.m <= 12) return { from: toISO(startY, 10, 1), to: toISO(startY, 12, 31) }
  return { from: toISO(startY + 1, 1, 1), to: toISO(startY + 1, 3, 31) }
}

export function lastFyQuarterRange(now = new Date()): DateRange {
  const today = istTodayISO(now)
  const current = fyQuarterRange(today)
  const dayBefore = addDaysISO(current.from, -1)
  return fyQuarterRange(dayBefore)
}

/** Week starts Sunday (matches calendar header). */
export function thisWeekRange(now = new Date()): DateRange {
  const today = istTodayISO(now)
  const p = parseISO(today)!
  const dow = weekdaySun0(p.y, p.m, p.d)
  const from = addDaysISO(today, -dow)
  const to = addDaysISO(from, 6)
  return { from, to }
}

export function lastWeekRange(now = new Date()): DateRange {
  const thisW = thisWeekRange(now)
  return { from: addDaysISO(thisW.from, -7), to: addDaysISO(thisW.to, -7) }
}

export function thisMonthRange(now = new Date()): DateRange {
  const { y, m } = istTodayParts(now)
  return { from: toISO(y, m, 1), to: toISO(y, m, daysInMonth(y, m)) }
}

export function lastMonthRange(now = new Date()): DateRange {
  const { y, m } = istTodayParts(now)
  const prev = addMonths(y, m, -1)
  return {
    from: toISO(prev.y, prev.m, 1),
    to: toISO(prev.y, prev.m, daysInMonth(prev.y, prev.m)),
  }
}

export function lastNDaysRange(n: number, now = new Date()): DateRange {
  const to = istTodayISO(now)
  return { from: addDaysISO(to, -(n - 1)), to }
}

export function resolvePreset(id: PresetId, now = new Date()): DateRange | null {
  switch (id) {
    case 'last_60':
      return lastNDaysRange(60, now)
    case 'last_90':
      return lastNDaysRange(90, now)
    case 'this_week':
      return thisWeekRange(now)
    case 'last_week':
      return lastWeekRange(now)
    case 'this_month':
      return thisMonthRange(now)
    case 'last_month':
      return lastMonthRange(now)
    case 'this_quarter':
      return fyQuarterRange(istTodayISO(now))
    case 'last_quarter':
      return lastFyQuarterRange(now)
    case 'this_year':
      return thisFinancialYear(now)
    case 'specific':
    case 'custom':
      return null
    default:
      return null
  }
}

export const PRESET_OPTIONS: { id: PresetId; label: string }[] = [
  { id: 'last_60', label: 'Last 60 Days' },
  { id: 'last_90', label: 'Last 90 Days' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'last_quarter', label: 'Last Quarter' },
  { id: 'this_year', label: 'This Year' },
  { id: 'specific', label: 'Specific date…' },
  { id: 'custom', label: 'Custom…' },
]

/** Detect which preset matches an applied range (best-effort). */
export function matchPreset(from: string, to: string, now = new Date()): PresetId | null {
  for (const { id } of PRESET_OPTIONS) {
    if (id === 'specific' || id === 'custom') continue
    const range = resolvePreset(id, now)
    if (range && range.from === from && range.to === to) return id
  }
  if (from && to && from === to) return 'specific'
  if (from && to) return 'custom'
  return null
}

export type PeriodOption = DateRange & { id: string; label: string }

export function previousWeekRange(current: DateRange): DateRange {
  return { from: addDaysISO(current.from, -7), to: addDaysISO(current.to, -7) }
}

export function previousMonthRange(current: DateRange): DateRange {
  const p = parseISO(current.from)
  if (!p) return lastMonthRange()
  const prev = addMonths(p.y, p.m, -1)
  return {
    from: toISO(prev.y, prev.m, 1),
    to: toISO(prev.y, prev.m, daysInMonth(prev.y, prev.m)),
  }
}

export function previousFyQuarterRange(current: DateRange): DateRange {
  return fyQuarterRange(addDaysISO(current.from, -1))
}

function weekOptionFromSunday(sundayIso: string): PeriodOption {
  const to = addDaysISO(sundayIso, 6)
  return {
    id: `week:${sundayIso}`,
    from: sundayIso,
    to,
    label: formatRangeLabel(sundayIso, to),
  }
}

/** Recent weeks ending at this week (Sunday start), newest first. */
export function listRecentWeeks(count = 12, now = new Date()): PeriodOption[] {
  const thisW = thisWeekRange(now)
  const options: PeriodOption[] = []
  for (let i = 0; i < count; i++) {
    const from = addDaysISO(thisW.from, -7 * i)
    options.push(weekOptionFromSunday(from))
  }
  return options
}

/** Recent calendar months, newest first. */
export function listRecentMonths(count = 12, now = new Date()): PeriodOption[] {
  const { y, m } = istTodayParts(now)
  const options: PeriodOption[] = []
  for (let i = 0; i < count; i++) {
    const { y: yy, m: mm } = addMonths(y, m, -i)
    const from = toISO(yy, mm, 1)
    const to = toISO(yy, mm, daysInMonth(yy, mm))
    options.push({
      id: `month:${from}`,
      from,
      to,
      label: utcDate(yy, mm, 1).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    })
  }
  return options
}

function fyQuarterLabel(range: DateRange): string {
  const p = parseISO(range.from)
  if (!p) return formatRangeLabel(range.from, range.to)
  const startY = fyStartYear(range.from)
  const short = String(startY).slice(2)
  let q = 1
  if (p.m >= 7 && p.m <= 9) q = 2
  else if (p.m >= 10) q = 3
  else if (p.m <= 3) q = 4
  return `FY${short} Q${q}`
}

/** Recent Indian FY quarters, newest first. */
export function listRecentFyQuarters(count = 8, now = new Date()): PeriodOption[] {
  let cursor = fyQuarterRange(istTodayISO(now))
  const options: PeriodOption[] = []
  for (let i = 0; i < count; i++) {
    options.push({
      id: `quarter:${cursor.from}`,
      from: cursor.from,
      to: cursor.to,
      label: fyQuarterLabel(cursor),
    })
    cursor = previousFyQuarterRange(cursor)
  }
  return options
}

export function defaultPeriodForMode(
  mode: 'week' | 'month' | 'quarter',
  now = new Date(),
): PeriodOption {
  if (mode === 'week') return listRecentWeeks(1, now)[0]
  if (mode === 'month') return listRecentMonths(1, now)[0]
  return listRecentFyQuarters(1, now)[0]
}

export function periodsForMode(mode: 'week' | 'month' | 'quarter', now = new Date()): PeriodOption[] {
  if (mode === 'week') return listRecentWeeks(12, now)
  if (mode === 'month') return listRecentMonths(12, now)
  return listRecentFyQuarters(8, now)
}

export function priorPeriodFor(
  mode: 'week' | 'month' | 'quarter',
  current: DateRange,
): DateRange {
  if (mode === 'week') return previousWeekRange(current)
  if (mode === 'month') return previousMonthRange(current)
  return previousFyQuarterRange(current)
}

/** Display label for a period of the given grain (matches period dropdown labels). */
export function periodLabel(mode: 'week' | 'month' | 'quarter', range: DateRange): string {
  if (mode === 'week') return formatRangeLabel(range.from, range.to)
  if (mode === 'month') {
    const p = parseISO(range.from)
    if (!p) return formatRangeLabel(range.from, range.to)
    return utcDate(p.y, p.m, 1).toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  return fyQuarterLabel(range)
}

/** Resolve a DateRange to a PeriodOption; prepend to list if not already present. */
export function resolvePeriodOption(
  mode: 'week' | 'month' | 'quarter',
  range: DateRange,
  list: PeriodOption[] = periodsForMode(mode),
): { option: PeriodOption; options: PeriodOption[] } {
  const found = list.find((o) => o.from === range.from && o.to === range.to)
  if (found) return { option: found, options: list }
  const option: PeriodOption = {
    id: `${mode}:${range.from}`,
    from: range.from,
    to: range.to,
    label: periodLabel(mode, range),
  }
  return { option, options: [option, ...list] }
}

