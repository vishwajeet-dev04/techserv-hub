const STORAGE_PREFIX = 'pulse-recent:'
const MAX_RECENTS = 8

function readList(field: string): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${field}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

function writeList(field: string, values: string[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${field}`, JSON.stringify(values.slice(0, MAX_RECENTS)))
  } catch {
    // ignore quota / private mode
  }
}

export function getRecentCustoms(field: string): string[] {
  return readList(field)
}

export function rememberCustomValue(field: string, value: string, presets: readonly string[]) {
  const text = value.trim()
  if (!text) return
  const presetSet = new Set(presets.map((item) => item.toLowerCase()))
  if (presetSet.has(text.toLowerCase())) return
  const next = [text, ...readList(field).filter((item) => item.toLowerCase() !== text.toLowerCase())]
  writeList(field, next)
}

export function mergeOptionsWithRecents(field: string, presets: readonly string[]): string[] {
  const recent = getRecentCustoms(field)
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...recent, ...presets]) {
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
