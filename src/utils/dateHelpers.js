/**
 * Date helper utilities
 */

/**
 * Format a date string or Date object to display format (DD/MM/YYYY)
 */
export function formatDate(date) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Format a date for input[type=date] value (YYYY-MM-DD)
 */
export function toInputDate(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function today() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get the current month as YYYY-MM string
 */
export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get start and end of a month (YYYY-MM-DD)
 */
export function monthRange(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0).toISOString().split('T')[0]
  return { start, end }
}

/**
 * Get tomorrow's date as YYYY-MM-DD string
 */
export function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

/**
 * Check if a date's month/day matches today (for birthdays)
 */
export function isBirthdayToday(dob) {
  if (!dob) return false
  const d = new Date(dob)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

/**
 * Format date as human-readable long format
 */
export function formatDateLong(date) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

/**
 * Get display label for a month (e.g. "August 2026")
 */
export function monthLabel(yearMonth) {
  if (!yearMonth) return ''
  const [year, month] = yearMonth.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
