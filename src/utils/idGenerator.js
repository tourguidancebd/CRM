import { supabase } from '../supabaseClient'

/**
 * Generate a new human-readable ID for an entity type.
 * Reads from settings table (id=1) for prefix/padding config,
 * then finds the highest existing numeric part of IDs in that table.
 *
 * @param {string} entityType - 'invoice'|'customer'|'vendor'|'expense'|'receipt'
 * @param {string} tableName  - Supabase table name
 * @param {object} idConfig   - { prefix, digits, startNumber, enabled }
 * @returns {Promise<string>} - e.g. 'INV-000001'
 */
export async function generateId(entityType, tableName, idConfig) {
  const { prefix = 'REC', digits = 6, startNumber = 1 } = idConfig || {}

  try {
    // Fetch all existing IDs to find max numeric part
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .order('id', { ascending: false })
      .limit(100)

    if (error) throw error

    let maxNum = startNumber - 1

    if (data && data.length > 0) {
      for (const row of data) {
        const idStr = String(row.id)
        // Extract trailing numeric portion
        const match = idStr.match(/(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum) maxNum = num
        }
      }
    }

    const nextNum = Math.max(maxNum + 1, startNumber)
    return `${prefix}${String(nextNum).padStart(digits, '0')}`
  } catch (err) {
    console.error('ID generation error:', err)
    // Fallback: timestamp-based ID
    return `${prefix}${Date.now()}`
  }
}

/**
 * Get default ID config for each entity type.
 * These are overridden by settings.data.idSettings in practice.
 */
export const DEFAULT_ID_CONFIGS = {
  invoice: { prefix: 'INV-', digits: 6, startNumber: 1, enabled: true },
  customer: { prefix: 'CUS-', digits: 6, startNumber: 1, enabled: true },
  vendor: { prefix: 'VEN-', digits: 6, startNumber: 1, enabled: true },
  expense: { prefix: 'EXP-', digits: 6, startNumber: 1, enabled: true },
  receipt: { prefix: 'MR-', digits: 6, startNumber: 1, enabled: true },
}

/**
 * Preview what an ID will look like given a config
 */
export function previewId(config) {
  const { prefix = '', digits = 6, startNumber = 1 } = config
  return `${prefix}${String(startNumber).padStart(digits, '0')}`
}
