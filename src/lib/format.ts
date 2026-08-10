/**
 * Shared formatting helpers.
 */

export function formatINR(amount: number, compact = false): string {
  if (compact) {
    if (Math.abs(amount) >= 1_00_00_000) {
      return `₹ ${(amount / 1_00_00_000).toFixed(2)} Cr`
    }
    if (Math.abs(amount) >= 1_00_000) {
      return `₹ ${(amount / 1_00_000).toFixed(2)} L`
    }
    if (Math.abs(amount) >= 1_000) {
      return `₹ ${(amount / 1_000).toFixed(1)}K`
    }
    return `₹ ${amount.toFixed(0)}`
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(p: number): string {
  return `${p.toFixed(1)}%`
}

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Color palette for charts (matches the design diagram's vibe).
// Note: navy/amber/emerald palette — explicitly requested by the user-supplied design.
export const CHART_COLORS = [
  '#1e3a8a', // navy
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#0ea5e9', // sky
  '#ec4899', // pink
  '#84cc16', // lime
]
