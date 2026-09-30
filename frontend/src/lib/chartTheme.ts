import type { CSSProperties } from 'react'

/** Recharts styling bound to CSS variables so charts follow the light/dark theme. */
export const chartTick = { fontSize: 11, fill: 'var(--color-muted)' }

export const chartGridStroke = 'var(--color-line)'

export const chartCursor = { fill: 'color-mix(in srgb, var(--color-brand) 6%, transparent)' }

export const tooltipStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--color-ink)',
  boxShadow: '0 4px 16px rgb(0 0 0 / 0.12)',
}

export const tooltipLabelStyle: CSSProperties = { color: 'var(--color-ink)', fontWeight: 600 }

export const tooltipItemStyle: CSSProperties = { color: 'var(--color-ink)' }

/** Spread onto <Tooltip /> for consistent themed tooltips. */
export const tooltipProps = {
  contentStyle: tooltipStyle,
  labelStyle: tooltipLabelStyle,
  itemStyle: tooltipItemStyle,
}

export const legendStyle: CSSProperties = { fontSize: 12, color: 'var(--color-muted)' }

export const SERIES_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
]

export const STATUS_COLORS = {
  brand: 'var(--color-brand)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
}

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}
