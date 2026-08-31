/**
 * Core business logic calculations.
 * These are THE canonical formulas — used identically everywhere (Dashboard, Reports).
 */

/**
 * Sum of (qty × price) for all line items on an invoice
 */
export function invoiceSubtotal(items) {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => {
    const qty = parseFloat(item.qty) || 1
    const price = parseFloat(item.price) || 0
    return sum + qty * price
  }, 0)
}

/**
 * Sum of (qty × buyingPrice) for line items linked to Items master.
 * Items without a master record (custom items) contribute 0 cost.
 */
export function invoiceCost(items) {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => {
    const qty = parseFloat(item.qty) || 1
    const buyingPrice = parseFloat(item.buying_price) || 0
    return sum + qty * buyingPrice
  }, 0)
}

/**
 * Gross profit = Subtotal − Cost
 */
export function invoiceGrossProfit(items) {
  return invoiceSubtotal(items) - invoiceCost(items)
}

/**
 * Net profit = Gross Profit − Discount
 */
export function invoiceNetProfit(items, discount) {
  return invoiceGrossProfit(items) - (parseFloat(discount) || 0)
}

/**
 * Total received for an invoice from its receipts
 */
export function invoiceReceived(receipts) {
  if (!Array.isArray(receipts)) return 0
  return receipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
}

/**
 * Due amount = Grand Total − Received
 */
export function invoiceDue(grandTotal, received) {
  return (parseFloat(grandTotal) || 0) - (parseFloat(received) || 0)
}

/**
 * Payment status label and color class
 */
export function paymentStatus(grandTotal, received) {
  const due = invoiceDue(grandTotal, received)
  const rec = parseFloat(received) || 0
  if (due <= 0) return { label: 'Paid', color: 'paid' }
  if (rec > 0) return { label: 'Partially Paid', color: 'partial' }
  return { label: 'Due', color: 'due' }
}

/**
 * Period Net Profit = Σ invoiceNetProfit − Σ expenses
 * THIS is the one canonical formula for "Net Profit" everywhere.
 */
export function periodNetProfit(invoices, expenses) {
  const invoiceProfit = invoices.reduce((sum, inv) => {
    return sum + invoiceNetProfit(inv.items || [], inv.discount)
  }, 0)
  const expenseTotal = expenses.reduce((sum, exp) => {
    return sum + (parseFloat(exp.amount) || 0)
  }, 0)
  return invoiceProfit - expenseTotal
}

/**
 * Customer aggregate stats derived from their invoices + receipts
 */
export function customerStats(invoices, generalReceipts = []) {
  let totalBooking = invoices.length
  let totalSales = 0
  let totalDiscount = 0
  let totalPaid = 0
  let totalProfit = 0
  let lastBookingDate = null

  for (const inv of invoices) {
    totalSales += parseFloat(inv.grand_total) || 0
    totalDiscount += parseFloat(inv.discount) || 0
    const received = invoiceReceived(inv.receipts || [])
    totalPaid += received
    totalProfit += invoiceNetProfit(inv.items || [], inv.discount)

    const invDate = inv.invoice_date || inv.created_at
    if (invDate) {
      const d = new Date(invDate)
      if (!lastBookingDate || d > new Date(lastBookingDate)) {
        lastBookingDate = invDate
      }
    }
  }

  // Add general receipts (not linked to any invoice)
  for (const r of generalReceipts) {
    totalPaid += parseFloat(r.amount) || 0
  }

  const totalDue = totalSales - totalPaid

  return {
    totalBooking,
    totalSales,
    totalDiscount,
    totalPaid,
    totalDue,
    totalProfit,
    lastBookingDate,
  }
}

/**
 * Grand total = Subtotal − Discount
 */
export function invoiceGrandTotal(items, discount) {
  return invoiceSubtotal(items) - (parseFloat(discount) || 0)
}
