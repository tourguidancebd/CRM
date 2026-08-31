/**
 * Format a number as money with the configured currency symbol.
 * Uses Bangladeshi number formatting (lakh/crore style grouping).
 * @param {number|string} amount
 * @param {string} symbol - currency symbol (default ৳)
 * @returns {string}
 */
export function money(amount, symbol = '৳') {
  const num = parseFloat(amount) || 0
  // Format with 2 decimal places, then apply grouping
  const formatted = formatBDNumber(Math.abs(num))
  const sign = num < 0 ? '-' : ''
  return `${sign}${symbol}${formatted}`
}

/**
 * Bangladeshi number grouping: last 3 digits, then groups of 2
 * e.g. 1234567 → 12,34,567
 */
function formatBDNumber(num) {
  const fixed = num.toFixed(2)
  const [integer, decimal] = fixed.split('.')
  
  // Apply BD grouping
  let result = ''
  const len = integer.length
  
  if (len <= 3) {
    result = integer
  } else {
    result = integer.slice(len - 3)
    let remaining = integer.slice(0, len - 3)
    while (remaining.length > 2) {
      result = remaining.slice(remaining.length - 2) + ',' + result
      remaining = remaining.slice(0, remaining.length - 2)
    }
    if (remaining.length > 0) {
      result = remaining + ',' + result
    }
  }
  
  return decimal === '00' ? result : `${result}.${decimal}`
}

/**
 * Parse a money string back to a float
 */
export function parseMoney(str) {
  if (typeof str === 'number') return str
  return parseFloat(String(str).replace(/[^0-9.-]/g, '')) || 0
}
