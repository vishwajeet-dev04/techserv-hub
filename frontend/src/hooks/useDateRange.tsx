import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { defaultOpsDateRange, type DateRange } from '../lib/dateRange'

/** Bumped when default range semantics change so stale FY-only session values reset. */
const STORAGE_KEY = 'ops-date-range-v2'

type DateRangeContextValue = {
  from: string
  to: string
  setRange: (next: DateRange) => void
  resetToFy: () => void
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null)

function readStored(): DateRange {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DateRange>
      if (typeof parsed.from === 'string' && typeof parsed.to === 'string' && parsed.from && parsed.to) {
        return { from: parsed.from, to: parsed.to }
      }
    }
  } catch {
    /* ignore */
  }
  return defaultOpsDateRange()
}

function writeStored(range: DateRange) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(range))
  } catch {
    /* ignore */
  }
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<DateRange>(() => readStored())

  const setRange = useCallback((next: DateRange) => {
    const fallback = defaultOpsDateRange()
    const resolved =
      next.from && next.to
        ? next
        : next.from || next.to
          ? { from: next.from || next.to, to: next.to || next.from }
          : fallback
    setRangeState(resolved)
    writeStored(resolved)
  }, [])

  const resetToFy = useCallback(() => {
    const next = defaultOpsDateRange()
    setRangeState(next)
    writeStored(next)
  }, [])

  const value = useMemo(
    () => ({ from: range.from, to: range.to, setRange, resetToFy }),
    [range.from, range.to, setRange, resetToFy],
  )

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext)
  if (!ctx) {
    throw new Error('useDateRange must be used within DateRangeProvider')
  }
  return ctx
}
