export const CHART_COLORS = [
  '#f59e0b',
  '#38bdf8',
  '#34d399',
  '#a78bfa',
  '#fb7185',
  '#fbbf24',
  '#2dd4bf',
  '#818cf8'
]

export const tooltipStyle = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' }
}

export function formatChf(n: number) {
  return `CHF ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}
