function formatShortNumber(n: number) {
  const fixed = n.toFixed(1).replace(/\.0$/, '')
  const [intPart, decPart] = fixed.split('.')
  const grouped = Number(intPart).toLocaleString('en-IN')
  return decPart ? `${grouped}.${decPart}` : grouped
}

/** ₹ amount in Cr / L for large values, e.g. ₹11.1 Cr, ₹42L, ₹9,500. */
export function fmtInrShort(n: number) {
  const value = Number(n) || 0
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${formatShortNumber(abs / 1e7)} Cr`
  if (abs >= 1e5) return `${sign}₹${formatShortNumber(abs / 1e5)}L`
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)
}

export function fmtInrCompact(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n) || 0)
}

/** "+12% vs prior (₹4.2L)" style comparison against the previous period. */
export function priorLabel(current: number, prior: number | null, kind: 'money' | 'percent' | 'count') {
  if (prior === null) return 'No prior data'
  if (prior === 0 && current === 0) return 'No change vs prior'
  if (prior === 0) return 'New vs prior period'
  const pct = Math.round(((current - prior) / Math.abs(prior)) * 100)
  const sign = pct > 0 ? '+' : ''
  const priorText =
    kind === 'money' ? fmtInrCompact(prior) : kind === 'percent' ? `${prior}%` : String(prior)
  return `${sign}${pct}% vs prior (${priorText})`
}
