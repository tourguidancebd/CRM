import { money } from '../utils/money'
import { formatDate, today } from '../utils/dateHelpers'
import { escapeHtml, buildLetterheadDoc } from '../utils/printService'

/**
 * Chart of Accounts (COA) Structure customized for Tour Guidance BD
 */
export const DEFAULT_CHART_OF_ACCOUNTS = [
  // --- ASSETS ---
  { id: '1010', code: '1010', name: 'Cash in Hand (Main Office)', type: 'Asset', category: 'Cash', normalBalance: 'Debit', isSystem: true },
  { id: '1020', code: '1020', name: 'Petty Cash', type: 'Asset', category: 'Cash', normalBalance: 'Debit', isSystem: true },
  { id: '1030', code: '1030', name: 'Branch & Operations Cash', type: 'Asset', category: 'Cash', normalBalance: 'Debit', isSystem: true },
  { id: '1110', code: '1110', name: 'Bank Accounts (Current/Savings)', type: 'Asset', category: 'Bank', normalBalance: 'Debit', isSystem: true },
  { id: '1210', code: '1210', name: 'Mobile Banking (bKash/Nagad/Rocket)', type: 'Asset', category: 'Mobile Banking', normalBalance: 'Debit', isSystem: true },
  { id: '1310', code: '1310', name: 'Accounts Receivable (Customers)', type: 'Asset', category: 'Receivables', normalBalance: 'Debit', isSystem: true },
  { id: '1410', code: '1410', name: 'Advance to Suppliers / Hotels', type: 'Asset', category: 'Advances', normalBalance: 'Debit', isSystem: false },
  { id: '1510', code: '1510', name: 'Office Equipment & Furniture', type: 'Asset', category: 'Fixed Assets', normalBalance: 'Debit', isSystem: false },
  { id: '1520', code: '1520', name: 'Vehicles & Tour Assets', type: 'Asset', category: 'Fixed Assets', normalBalance: 'Debit', isSystem: false },

  // --- LIABILITIES ---
  { id: '2010', code: '2010', name: 'Accounts Payable (Vendors/Hotels/Transport)', type: 'Liability', category: 'Payables', normalBalance: 'Credit', isSystem: true },
  { id: '2110', code: '2110', name: 'Customer Advances & Deposits', type: 'Liability', category: 'Customer Advances', normalBalance: 'Credit', isSystem: true },
  { id: '2210', code: '2210', name: 'Short Term Loans & Borrowings', type: 'Liability', category: 'Loans', normalBalance: 'Credit', isSystem: false },
  { id: '2310', code: '2310', name: 'Taxes & VAT Payable', type: 'Liability', category: 'Taxes', normalBalance: 'Credit', isSystem: false },

  // --- EQUITY ---
  { id: '3010', code: '3010', name: "Owner's Capital / Investment", type: 'Equity', category: 'Capital', normalBalance: 'Credit', isSystem: true },
  { id: '3020', code: '3020', name: 'Retained Earnings', type: 'Equity', category: 'Earnings', normalBalance: 'Credit', isSystem: true },
  { id: '3030', code: '3030', name: "Owner's Drawings / Withdrawals", type: 'Equity', category: 'Drawings', normalBalance: 'Debit', isSystem: true },

  // --- REVENUE ---
  { id: '4010', code: '4010', name: 'Tour Package Sales', type: 'Revenue', category: 'Operating Revenue', normalBalance: 'Credit', isSystem: true },
  { id: '4020', code: '4020', name: 'Hotel & Resort Booking Revenue', type: 'Revenue', category: 'Operating Revenue', normalBalance: 'Credit', isSystem: true },
  { id: '4030', code: '4030', name: 'Bus Ticket Sales Revenue', type: 'Revenue', category: 'Operating Revenue', normalBalance: 'Credit', isSystem: true },
  { id: '4040', code: '4040', name: 'Ship & Launch Ticket Sales', type: 'Revenue', category: 'Operating Revenue', normalBalance: 'Credit', isSystem: true },
  { id: '4050', code: '4050', name: 'Air Ticket & Visa Processing', type: 'Revenue', category: 'Operating Revenue', normalBalance: 'Credit', isSystem: true },
  { id: '4060', code: '4060', name: 'Service Fees & Commissions', type: 'Revenue', category: 'Other Revenue', normalBalance: 'Credit', isSystem: true },
  { id: '4090', code: '4090', name: 'Miscellaneous Income', type: 'Revenue', category: 'Other Revenue', normalBalance: 'Credit', isSystem: false },

  // --- DIRECT & OPERATING EXPENSES ---
  { id: '5010', code: '5010', name: 'Hotel & Accommodation Cost', type: 'Expense', category: 'Tour Cost', normalBalance: 'Debit', isSystem: true },
  { id: '5020', code: '5020', name: 'Tour Transport & Vehicle Hire', type: 'Expense', category: 'Tour Cost', normalBalance: 'Debit', isSystem: true },
  { id: '5030', code: '5030', name: 'Food & Catering Cost', type: 'Expense', category: 'Tour Cost', normalBalance: 'Debit', isSystem: true },
  { id: '5040', code: '5040', name: 'Tour Guide & Operational Staff Fee', type: 'Expense', category: 'Tour Cost', normalBalance: 'Debit', isSystem: true },
  { id: '5110', code: '5110', name: 'Salary & Employee Wages', type: 'Expense', category: 'Staff Cost', normalBalance: 'Debit', isSystem: true },
  { id: '5120', code: '5120', name: 'Staff Allowance & Meals', type: 'Expense', category: 'Staff Cost', normalBalance: 'Debit', isSystem: true },
  { id: '5210', code: '5210', name: 'Office Rent & Service Charge', type: 'Expense', category: 'Administrative', normalBalance: 'Debit', isSystem: true },
  { id: '5220', code: '5220', name: 'Electricity & Utilities', type: 'Expense', category: 'Administrative', normalBalance: 'Debit', isSystem: true },
  { id: '5230', code: '5230', name: 'Internet & Telephone', type: 'Expense', category: 'Administrative', normalBalance: 'Debit', isSystem: true },
  { id: '5240', code: '5240', name: 'Printing, Stationery & Supplies', type: 'Expense', category: 'Administrative', normalBalance: 'Debit', isSystem: true },
  { id: '5310', code: '5310', name: 'Facebook & Digital Advertising', type: 'Expense', category: 'Marketing', normalBalance: 'Debit', isSystem: true },
  { id: '5320', code: '5320', name: 'Promotions & Client Entertainment', type: 'Expense', category: 'Marketing', normalBalance: 'Debit', isSystem: true },
  { id: '5410', code: '5410', name: 'Bank Charges & Gateway Fees', type: 'Expense', category: 'Financial', normalBalance: 'Debit', isSystem: true },
  { id: '5420', code: '5420', name: 'bKash/Nagad Cash Out & Transfer Fees', type: 'Expense', category: 'Financial', normalBalance: 'Debit', isSystem: true },
  { id: '5510', code: '5510', name: 'Customer Refund & Cancellation', type: 'Expense', category: 'Customer Related', normalBalance: 'Debit', isSystem: true },
  { id: '5990', code: '5990', name: 'Miscellaneous & Petty Expenses', type: 'Expense', category: 'General', normalBalance: 'Debit', isSystem: true },
]

/**
 * Initial Default Accounts - Fresh & Empty
 */
export const DEFAULT_ACCOUNTS = []

/**
 * Unified Transaction Ledger Engine
 * Aggregates all financial streams:
 * - CRM Receipts (Money In / Collections)
 * - CRM Expenses (Money Out / Disbursements)
 * - CRM Vendor Payments (Accounts Payable settlements)
 * - CRM Invoices (Sales / Receivables)
 * - Manual Transfers (Inter-account)
 * - Deposits & Withdrawals
 * - Manual Double-Entry Journal Entries
 */
export function buildUnifiedTransactions({
  accounts = [],
  receipts = [],
  expenses = [],
  vendorPayments = [],
  invoices = [],
  transfers = [],
  deposits = [],
  withdrawals = [],
  journalEntries = [],
}) {
  const list = []

  // 1. Receipts (Money In)
  receipts.forEach(r => {
    const accId = r.account_id || (r.note?.toLowerCase().includes('bkash') ? 'acc-mobile-bkash' : r.note?.toLowerCase().includes('nagad') ? 'acc-mobile-nagad' : r.note?.toLowerCase().includes('bank') ? 'acc-bank-islami' : 'acc-cash-main')
    const acc = accounts.find(a => a.id === accId) || accounts[0]
    list.push({
      id: r.id,
      date: r.date || today(),
      type: 'Income',
      category: 'Customer Collection',
      accountId: acc?.id || 'acc-cash-main',
      accountName: acc?.name || 'Cash Vault',
      accountType: acc?.type || 'cash',
      entityName: r.customers?.name || 'Customer',
      entityType: 'Customer',
      debit: parseFloat(r.amount) || 0, // Asset increases
      credit: 0,
      amount: parseFloat(r.amount) || 0,
      paymentMethod: r.note?.includes('bKash') ? 'bKash' : r.note?.includes('Nagad') ? 'Nagad' : r.note?.includes('Bank') ? 'Bank Transfer' : 'Cash',
      reference: r.invoice_id ? `Invoice: ${r.invoice_id}` : 'Direct Receipt',
      description: r.note || 'Customer payment received',
      source: 'receipts',
      raw: r
    })
  })

  // 2. Expenses (Money Out)
  expenses.forEach(e => {
    const accId = e.account_id || (e.payment_method === 'bKash' ? 'acc-mobile-bkash' : e.payment_method === 'Nagad' ? 'acc-mobile-nagad' : e.payment_method === 'Bank Transfer' ? 'acc-bank-islami' : 'acc-cash-main')
    const acc = accounts.find(a => a.id === accId) || accounts[0]
    list.push({
      id: e.id,
      date: e.date || today(),
      type: 'Expense',
      category: e.category || 'Operating Expense',
      accountId: acc?.id || 'acc-cash-main',
      accountName: acc?.name || 'Cash Vault',
      accountType: acc?.type || 'cash',
      entityName: e.paid_to || e.vendor || 'Vendor / Payee',
      entityType: 'Vendor',
      debit: 0,
      credit: parseFloat(e.amount) || 0, // Asset decreases
      amount: parseFloat(e.amount) || 0,
      paymentMethod: e.payment_method || 'Cash',
      reference: e.id,
      description: e.note || e.description || 'Expense voucher disbursed',
      source: 'expenses',
      raw: e
    })
  })

  // 3. Vendor Payments (Outflow / Credit Asset)
  vendorPayments.forEach(vp => {
    let matchedAcc = null
    let cleanDesc = vp.note || 'Vendor payment settlement'
    if (vp.note) {
      const match = vp.note.match(/^\[Paid From:\s*([^\]]+)\]\s*([\s\S]*)$/)
      if (match) {
        const parsedName = match[1].trim().toLowerCase()
        cleanDesc = match[2].trim() || 'Vendor payment settlement'
        matchedAcc = accounts.find(a => a.name.toLowerCase() === parsedName || a.id.toLowerCase() === parsedName || a.name.toLowerCase().includes(parsedName))
      }
    }
    if (!matchedAcc && vp.account_id) {
      matchedAcc = accounts.find(a => a.id === vp.account_id)
    }
    const acc = matchedAcc || accounts[0]
    const accId = acc?.id || 'acc-main-cash'
    const accName = acc?.name || 'Main Office Cash Vault'

    list.push({
      id: vp.id,
      date: vp.date || today(),
      type: 'Payment',
      category: 'Supplier Disbursement',
      accountId: accId,
      accountName: accName,
      accountType: acc?.type || 'bank',
      entityName: vp.vendors?.name || 'Vendor',
      entityType: 'Vendor',
      debit: 0,
      credit: parseFloat(vp.amount) || 0, // Asset decreases
      amount: parseFloat(vp.amount) || 0,
      paymentMethod: 'Bank Transfer / Cash',
      reference: `VP: ${vp.id}`,
      description: cleanDesc,
      source: 'vendor_payments',
      raw: vp
    })
  })

  // 4. Fund Transfers
  transfers.forEach(tr => {
    const fromAcc = accounts.find(a => a.id === tr.fromAccountId)
    const toAcc = accounts.find(a => a.id === tr.toAccountId)
    const amt = parseFloat(tr.amount) || 0
    const fee = parseFloat(tr.fee) || 0

    // Outflow entry for FROM account
    list.push({
      id: `${tr.id}-OUT`,
      date: tr.date || today(),
      type: 'Transfer',
      category: 'Fund Transfer (Out)',
      accountId: tr.fromAccountId,
      accountName: fromAcc?.name || 'Sending Account',
      accountType: fromAcc?.type || 'bank',
      entityName: toAcc?.name || 'Receiving Account',
      entityType: 'Account',
      debit: 0,
      credit: amt + fee,
      amount: amt,
      fee,
      paymentMethod: 'Internal Transfer',
      reference: tr.id,
      description: `Transfer to ${toAcc?.name || 'Account'}${fee > 0 ? ` (Fee: ${fee})` : ''} - ${tr.description || ''}`,
      source: 'transfers',
      raw: tr
    })

    // Inflow entry for TO account
    list.push({
      id: `${tr.id}-IN`,
      date: tr.date || today(),
      type: 'Transfer',
      category: 'Fund Transfer (In)',
      accountId: tr.toAccountId,
      accountName: toAcc?.name || 'Receiving Account',
      accountType: toAcc?.type || 'mobile',
      entityName: fromAcc?.name || 'Sending Account',
      entityType: 'Account',
      debit: amt,
      credit: 0,
      amount: amt,
      fee: 0,
      paymentMethod: 'Internal Transfer',
      reference: tr.id,
      description: `Transfer from ${fromAcc?.name || 'Account'} - ${tr.description || ''}`,
      source: 'transfers',
      raw: tr
    })
  })

  // 5. Deposits
  deposits.forEach(dep => {
    const acc = accounts.find(a => a.id === dep.accountId) || accounts[0]
    list.push({
      id: dep.id,
      date: dep.date || today(),
      type: 'Deposit',
      category: dep.depositType || 'Capital Deposit',
      accountId: dep.accountId,
      accountName: acc?.name || 'Account',
      accountType: acc?.type || 'bank',
      entityName: dep.source || 'Depositor / Owner',
      entityType: 'Depositor',
      debit: parseFloat(dep.amount) || 0,
      credit: 0,
      amount: parseFloat(dep.amount) || 0,
      paymentMethod: dep.paymentMethod || 'Deposit',
      reference: dep.reference || dep.id,
      description: dep.description || 'Capital / Fund deposit',
      source: 'deposits',
      raw: dep
    })
  })

  // 6. Withdrawals
  withdrawals.forEach(w => {
    const acc = accounts.find(a => a.id === w.accountId) || accounts[0]
    list.push({
      id: w.id,
      date: w.date || today(),
      type: 'Withdrawal',
      category: w.withdrawalType || 'Owner Drawing',
      accountId: w.accountId,
      accountName: acc?.name || 'Account',
      accountType: acc?.type || 'bank',
      entityName: w.withdrawnBy || 'Owner / Partner',
      entityType: 'Partner',
      debit: 0,
      credit: parseFloat(w.amount) || 0,
      amount: parseFloat(w.amount) || 0,
      paymentMethod: 'Withdrawal',
      reference: w.reference || w.id,
      description: w.purpose || 'Owner withdrawal / Drawings',
      source: 'withdrawals',
      raw: w
    })
  })

  // 7. Journal Entries
  journalEntries.forEach(j => {
    (j.lines || []).forEach((line, idx) => {
      const acc = accounts.find(a => a.id === line.accountId)
      list.push({
        id: `${j.id}-L${idx + 1}`,
        date: j.date || today(),
        type: 'Journal',
        category: line.accountName || 'Journal Entry',
        accountId: line.accountId,
        accountName: acc?.name || line.accountName || 'Journal Ledger',
        accountType: acc?.type || 'ledger',
        entityName: j.reference || 'General Ledger',
        entityType: 'Journal',
        debit: parseFloat(line.debit) || 0,
        credit: parseFloat(line.credit) || 0,
        amount: Math.max(parseFloat(line.debit) || 0, parseFloat(line.credit) || 0),
        paymentMethod: 'Journal Voucher',
        reference: j.id,
        description: line.narration || j.description || 'Manual Journal adjustment',
        source: 'journal_entries',
        raw: j
      })
    })
  })

  // Sort descending by date
  return list.sort((a, b) => new Date(b.date) - new Date(a.date))
}

/**
 * Calculate dynamic live balances for each Account
 */
export function calculateAccountBalances(accounts = [], transactions = []) {
  return accounts.map(acc => {
    const opening = parseFloat(acc.openingBalance) || 0
    const accTx = transactions.filter(t => t.accountId === acc.id)

    const totalInflow = accTx.reduce((sum, t) => sum + (parseFloat(t.debit) || 0), 0)
    const totalOutflow = accTx.reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0)

    const currentBalance = opening + totalInflow - totalOutflow

    return {
      ...acc,
      totalInflow,
      totalOutflow,
      currentBalance
    }
  })
}

/**
 * Calculate Customer Receivables with Aging Analysis
 */
export function calculateCustomerReceivables(invoices = [], receipts = []) {
  const customerMap = {}

  invoices.forEach(inv => {
    const custId = inv.customer_id || 'unassigned'
    const custName = inv.customers?.name || 'Walk-in Customer'
    const custMobile = inv.customers?.mobile || '—'

    if (!customerMap[custId]) {
      customerMap[custId] = {
        customerId: custId,
        customerName: custName,
        customerMobile: custMobile,
        totalInvoiced: 0,
        totalPaid: 0,
        totalDue: 0,
        invoicesCount: 0,
        invoices: []
      }
    }

    const invReceipts = receipts.filter(r => r.invoice_id === inv.id)
    const paid = invReceipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const grandTotal = parseFloat(inv.grand_total) || 0
    const due = Math.max(0, grandTotal - paid)

    customerMap[custId].totalInvoiced += grandTotal
    customerMap[custId].totalPaid += paid
    customerMap[custId].totalDue += due
    customerMap[custId].invoicesCount += 1
    customerMap[custId].invoices.push({
      ...inv,
      paid,
      due,
      status: due <= 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Due'
    })
  })

  // Also include general receipts
  receipts.filter(r => !r.invoice_id).forEach(gr => {
    const custId = gr.customer_id
    if (custId && customerMap[custId]) {
      const amt = parseFloat(gr.amount) || 0
      customerMap[custId].totalPaid += amt
      customerMap[custId].totalDue = Math.max(0, customerMap[custId].totalDue - amt)
    }
  })

  return Object.values(customerMap).sort((a, b) => b.totalDue - a.totalDue)
}

/**
 * Calculate Vendor Payables
 */
export function calculateVendorPayables(vendors = [], vendorPayments = [], expenses = []) {
  return vendors.map(v => {
    // Total expenses disbursed to this vendor
    const vExpenses = expenses.filter(e => (e.paid_to && e.paid_to.toLowerCase() === v.name.toLowerCase()) || (e.vendor && e.vendor.toLowerCase() === v.name.toLowerCase()))
    const totalBilled = vExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

    // Total payments made
    const vPayments = vendorPayments.filter(vp => vp.vendor_id === v.id)
    const totalPaid = vPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

    const totalDue = Math.max(0, totalBilled - totalPaid)

    return {
      vendorId: v.id,
      vendorName: v.name,
      vendorPhone: v.phone || '—',
      vendorAddress: v.address || '—',
      totalBilled,
      totalPaid,
      totalDue,
      status: totalDue === 0 ? 'Cleared' : totalPaid > 0 ? 'Partially Paid' : 'Pending'
    }
  }).sort((a, b) => b.totalDue - a.totalDue)
}

/**
 * Profit & Loss Report Generator
 */
export function generateProfitAndLossReport({
  invoices = [],
  expenses = [],
  startDate,
  endDate
}) {
  const filteredInvoices = invoices.filter(i => {
    const d = i.date || i.created_at || ''
    if (startDate && d < startDate) return false
    if (endDate && d > endDate) return false
    return true
  })

  const filteredExpenses = expenses.filter(e => {
    const d = e.date || e.created_at || ''
    if (startDate && d < startDate) return false
    if (endDate && d > endDate) return false
    return true
  })

  // Group revenues by items/categories
  const revenueCategories = {
    'Tour Package Sales': 0,
    'Hotel & Resort Bookings': 0,
    'Bus Ticket Sales': 0,
    'Ship & Launch Tickets': 0,
    'Air Ticket & Visa Processing': 0,
    'General Tour Sales': 0
  }

  let totalSalesDiscount = 0

  filteredInvoices.forEach(inv => {
    const total = parseFloat(inv.grand_total) || 0
    const disc = parseFloat(inv.discount) || 0
    totalSalesDiscount += disc

    const items = inv.items || []
    if (items.length > 0) {
      items.forEach(it => {
        const itemTotal = (parseFloat(it.qty) || 1) * (parseFloat(it.price) || 0)
        const name = (it.name || '').toLowerCase()
        if (name.includes('hotel') || name.includes('resort') || name.includes('room')) {
          revenueCategories['Hotel & Resort Bookings'] += itemTotal
        } else if (name.includes('bus')) {
          revenueCategories['Bus Ticket Sales'] += itemTotal
        } else if (name.includes('ship') || name.includes('boat') || name.includes('launch')) {
          revenueCategories['Ship & Launch Tickets'] += itemTotal
        } else if (name.includes('air') || name.includes('flight') || name.includes('visa')) {
          revenueCategories['Air Ticket & Visa Processing'] += itemTotal
        } else if (name.includes('package') || name.includes('tour')) {
          revenueCategories['Tour Package Sales'] += itemTotal
        } else {
          revenueCategories['General Tour Sales'] += itemTotal
        }
      })
    } else {
      revenueCategories['General Tour Sales'] += total
    }
  })

  const grossRevenue = Object.values(revenueCategories).reduce((s, v) => s + v, 0)
  const netRevenue = Math.max(0, grossRevenue - totalSalesDiscount)

  // Group operating expenses
  const expenseCategories = {}
  filteredExpenses.forEach(e => {
    const cat = e.category || 'General Operating Expense'
    expenseCategories[cat] = (expenseCategories[cat] || 0) + (parseFloat(e.amount) || 0)
  })

  const totalExpenses = Object.values(expenseCategories).reduce((s, v) => s + v, 0)
  const netProfit = netRevenue - totalExpenses
  const netProfitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0

  return {
    startDate,
    endDate,
    grossRevenue,
    totalSalesDiscount,
    netRevenue,
    revenueCategories,
    expenseCategories,
    totalExpenses,
    netProfit,
    netProfitMargin: netProfitMargin.toFixed(1)
  }
}

/**
 * Balance Sheet Generator (Assets = Liabilities + Equity)
 */
export function generateBalanceSheet({
  calculatedAccounts = [],
  customerReceivables = [],
  vendorPayables = [],
  profitAndLoss = {}
}) {
  // 1. Assets
  const cashAccounts = calculatedAccounts.filter(a => a.type === 'cash')
  const bankAccounts = calculatedAccounts.filter(a => a.type === 'bank')
  const mobileAccounts = calculatedAccounts.filter(a => a.type === 'mobile')

  const totalCash = cashAccounts.reduce((s, a) => s + (parseFloat(a.currentBalance) || 0), 0)
  const totalBank = bankAccounts.reduce((s, a) => s + (parseFloat(a.currentBalance) || 0), 0)
  const totalMobile = mobileAccounts.reduce((s, a) => s + (parseFloat(a.currentBalance) || 0), 0)
  const totalReceivables = customerReceivables.reduce((s, c) => s + (parseFloat(c.totalDue) || 0), 0)

  const otherAssets = 0

  const currentAssets = totalCash + totalBank + totalMobile + totalReceivables
  const totalAssets = currentAssets + otherAssets

  // 2. Liabilities
  const totalPayables = vendorPayables.reduce((s, v) => s + (parseFloat(v.totalDue) || 0), 0)
  const customerAdvances = 0
  const taxPayable = 0
  const totalLiabilities = totalPayables + customerAdvances + taxPayable

  // 3. Equity
  const ownerCapital = totalAssets >= totalLiabilities ? totalAssets - totalLiabilities : 0
  const retainedEarnings = 0
  const totalEquity = ownerCapital + retainedEarnings

  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1

  return {
    assets: {
      cashAccounts,
      bankAccounts,
      mobileAccounts,
      totalCash,
      totalBank,
      totalMobile,
      totalReceivables,
      otherAssets,
      totalAssets
    },
    liabilities: {
      totalPayables,
      customerAdvances,
      taxPayable,
      totalLiabilities
    },
    equity: {
      ownerCapital,
      retainedEarnings,
      totalEquity
    },
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced
  }
}

/**
 * General Ledger Generator
 */
export function generateGeneralLedger({
  transactions = [],
  accountId = null,
  startDate = null,
  endDate = null
}) {
  let filtered = transactions

  if (accountId) {
    filtered = filtered.filter(t => t.accountId === accountId)
  }
  if (startDate) {
    filtered = filtered.filter(t => t.date >= startDate)
  }
  if (endDate) {
    filtered = filtered.filter(t => t.date <= endDate)
  }

  // Calculate running balances
  let running = 0
  const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date))

  const entriesWithBalance = sorted.map(t => {
    const dr = parseFloat(t.debit) || 0
    const cr = parseFloat(t.credit) || 0
    running += (dr - cr)
    return {
      ...t,
      runningBalance: running
    }
  })

  const totalDebit = sorted.reduce((s, t) => s + (parseFloat(t.debit) || 0), 0)
  const totalCredit = sorted.reduce((s, t) => s + (parseFloat(t.credit) || 0), 0)

  return {
    entries: entriesWithBalance.reverse(), // Show newest first for table
    totalDebit,
    totalCredit,
    closingBalance: running
  }
}

/**
 * Trial Balance Generator (Verifies Total Debit = Total Credit)
 */
export function generateTrialBalance({
  chartOfAccounts = DEFAULT_CHART_OF_ACCOUNTS,
  transactions = []
}) {
  const lines = chartOfAccounts.map(coa => {
    // Collect all transactions corresponding to this account code/name
    const matchedTx = transactions.filter(t =>
      (t.category && t.category.toLowerCase().includes(coa.name.toLowerCase().slice(0, 8))) ||
      (t.accountName && t.accountName.toLowerCase().includes(coa.name.toLowerCase().slice(0, 8)))
    )

    let dr = matchedTx.reduce((s, t) => s + (parseFloat(t.debit) || 0), 0)
    let cr = matchedTx.reduce((s, t) => s + (parseFloat(t.credit) || 0), 0)

    if (coa.type === 'Asset' || coa.type === 'Expense') {
      if (dr > cr) { dr = dr - cr; cr = 0 }
      else { cr = cr - dr; dr = 0 }
    } else {
      if (cr > dr) { cr = cr - dr; dr = 0 }
      else { dr = dr - cr; cr = 0 }
    }

    return {
      ...coa,
      debit: dr,
      credit: cr
    }
  }).filter(line => line.debit > 0 || line.credit > 0)

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const difference = Math.abs(totalDebit - totalCredit)
  const isBalanced = difference < 1

  return {
    lines,
    totalDebit,
    totalCredit,
    difference,
    isBalanced
  }
}

/**
 * Cash Flow Statement Generator
 */
export function generateCashFlowStatement({
  receipts = [],
  expenses = [],
  vendorPayments = [],
  deposits = [],
  withdrawals = []
}) {
  // 1. Operating Activities
  const customerCollections = receipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const supplierDisbursements = vendorPayments.reduce((s, vp) => s + (parseFloat(vp.amount) || 0), 0)
  const operationalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const netOperatingCash = customerCollections - (supplierDisbursements + operationalExpenses)

  // 2. Investing Activities
  const assetPurchases = 0
  const netInvestingCash = -assetPurchases

  // 3. Financing Activities
  const ownerInvestments = deposits.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const ownerDrawings = withdrawals.reduce((s, w) => s + (parseFloat(w.amount) || 0), 0)
  const netFinancingCash = ownerInvestments - ownerDrawings

  const netCashChange = netOperatingCash + netInvestingCash + netFinancingCash
  const openingCash = 0
  const closingCash = openingCash + netCashChange

  return {
    operating: {
      customerCollections,
      supplierDisbursements,
      operationalExpenses,
      netOperatingCash
    },
    investing: {
      assetPurchases,
      netInvestingCash
    },
    financing: {
      ownerInvestments,
      ownerDrawings,
      netFinancingCash
    },
    openingCash,
    netCashChange,
    closingCash
  }
}

/**
 * HTML Document Generators for Printing & Exports
 */
export function buildPaymentVoucherHtml(payment, settings, currencySymbol) {
  const content = `
    <div class="doc-title" style="font-size: 20px; font-weight: 800; text-align: center; color: #0A0F1C; letter-spacing: 1px; margin-top: 10px;">PAYMENT VOUCHER</div>
    <div style="text-align: center; color: #777; font-size: 11px; margin-bottom: 18px;">Official Financial Disbursement Voucher</div>

    <div class="doc-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 18px; font-size: 12px;">
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Voucher No:</span> <span class="doc-meta-value" style="font-weight: 700; font-family: monospace;">${escapeHtml(payment.id)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Payment Date:</span> <span class="doc-meta-value" style="font-weight: 600;">${formatDate(payment.date)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Paid To (Payee):</span> <span class="doc-meta-value" style="font-weight: 700;">${escapeHtml(payment.entityName || payment.vendors?.name || payment.paid_to || 'Payee')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Disbursement Account:</span> <span class="doc-meta-value" style="font-weight: 600;">${escapeHtml(payment.accountName || 'Primary Account')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Payment Method:</span> <span class="doc-meta-value">${escapeHtml(payment.paymentMethod || 'Bank Transfer')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Purpose / Note:</span> <span class="doc-meta-value">${escapeHtml(payment.description || payment.note || 'Disbursement')}</span></div>
    </div>

    <div style="margin: 20px 0; padding: 18px; background: #fdfaf2; border: 2px solid #C9A24B; border-radius: 8px; text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 4px;">Total Amount Disbursed</div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 800; color: #0A0F1C;">
        ${money(payment.amount, currencySymbol)}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 45px; text-align: center;">
      <div>
        <div style="height: 40px; border-bottom: 1px solid #333; margin-bottom: 6px;"></div>
        <div style="font-size: 11px; font-weight: 600;">Prepared By (Accountant)</div>
      </div>
      <div>
        <div style="height: 40px; border-bottom: 1px solid #333; margin-bottom: 6px;"></div>
        <div style="font-size: 11px; font-weight: 600;">Checked & Verified</div>
      </div>
      <div>
        <div style="height: 40px; border-bottom: 1px solid #333; margin-bottom: 6px;"></div>
        <div style="font-size: 11px; font-weight: 600;">Approved Authority</div>
      </div>
    </div>
  `

  return buildLetterheadDoc({
    title: `Payment-Voucher-${payment.id}`,
    content,
    company: settings?.company
  })
}

export function buildAccountStatementHtml(account, transactions, settings, currencySymbol) {
  const accTx = transactions.filter(t => t.accountId === account.id)
  let running = parseFloat(account.openingBalance) || 0

  const rowsHtml = accTx.map(t => {
    const dr = parseFloat(t.debit) || 0
    const cr = parseFloat(t.credit) || 0
    running += (dr - cr)
    return `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td style="font-family: monospace;">${escapeHtml(t.id)}</td>
        <td><b>${escapeHtml(t.type)}</b> - ${escapeHtml(t.description || t.category || '')}</td>
        <td style="text-align: right; color: #166534; font-family: monospace;">${dr > 0 ? money(dr, currencySymbol) : '—'}</td>
        <td style="text-align: right; color: #991b1b; font-family: monospace;">${cr > 0 ? money(cr, currencySymbol) : '—'}</td>
        <td style="text-align: right; font-weight: 700; font-family: monospace;">${money(running, currencySymbol)}</td>
      </tr>
    `
  }).join('')

  const content = `
    <div class="doc-title" style="font-size: 20px; font-weight: 800; text-align: center; color: #0A0F1C; letter-spacing: 1px; margin-top: 10px;">ACCOUNT STATEMENT</div>
    <div style="text-align: center; color: #777; font-size: 11px; margin-bottom: 18px;">Statement of Financial Transactions</div>

    <div class="doc-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 18px; font-size: 12px;">
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Account Name:</span> <span class="doc-meta-value" style="font-weight: 700;">${escapeHtml(account.name)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Account Number:</span> <span class="doc-meta-value" style="font-family: monospace;">${escapeHtml(account.accountNumber || account.mobileNumber || '—')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Account Type:</span> <span class="doc-meta-value">${escapeHtml(account.type?.toUpperCase() || 'BANK')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Statement Date:</span> <span class="doc-meta-value">${today()}</span></div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; text-align: center;">
      <div style="background: #faf8f3; padding: 10px; border-radius: 6px; border: 1px solid #e0d5c1;">
        <div style="font-size: 10px; text-transform: uppercase; color: #666;">Opening Balance</div>
        <div style="font-weight: 700; font-family: monospace; font-size: 14px;">${money(account.openingBalance, currencySymbol)}</div>
      </div>
      <div style="background: #f2f9f6; padding: 10px; border-radius: 6px; border: 1px solid #c2e2d4;">
        <div style="font-size: 10px; text-transform: uppercase; color: #166534;">Total Money In</div>
        <div style="font-weight: 700; font-family: monospace; font-size: 14px; color: #166534;">${money(account.totalInflow || 0, currencySymbol)}</div>
      </div>
      <div style="background: #fdfaf2; padding: 10px; border-radius: 6px; border: 1px solid #C9A24B;">
        <div style="font-size: 10px; text-transform: uppercase; color: #0A0F1C;">Current Net Balance</div>
        <div style="font-weight: 800; font-family: monospace; font-size: 16px; color: #0A0F1C;">${money(account.currentBalance, currencySymbol)}</div>
      </div>
    </div>

    <table class="doc-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Reference</th>
          <th>Description</th>
          <th style="text-align: right;">Debit (In)</th>
          <th style="text-align: right;">Credit (Out)</th>
          <th style="text-align: right;">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="6" style="text-align: center; color: #888;">No transactions found for this account.</td></tr>'}
      </tbody>
    </table>
  `

  return buildLetterheadDoc({
    title: `Account-Statement-${account.name}`,
    content,
    company: settings?.company
  })
}
