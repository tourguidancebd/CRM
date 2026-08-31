import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { money } from '../../utils/money'
import { formatDate, today, currentMonth, monthRange, monthLabel } from '../../utils/dateHelpers'
import { invoiceSubtotal, invoiceReceived, invoiceNetProfit, customerStats } from '../../utils/calculations'
import { printHtml, downloadHtml, buildLetterheadDoc, escapeHtml } from '../../utils/printService'

export default function Reports() {
  const { isAgent, user, profile } = useAuth()
  const { settings, currencySymbol } = useSettings()
  const { toasts, dismiss, error: toastError } = useToast()

  // Active report tab
  const [activeTab, setActiveTab] = useState(isAgent ? 'my-sales' : 'daily-sales')

  // Filter dates
  const [selectedDate, setSelectedDate] = useState(today())
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())

  // Data sets
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [customers, setCustomers] = useState([])
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAllData = useCallback(async () => {
    setLoading(true)
    const [invRes, expRes, custRes, rcptRes] = await Promise.all([
      supabase.from('invoices').select('*, customers(name, mobile, email), receipts(amount)').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
      supabase.from('receipts').select('*').order('date', { ascending: false })
    ])

    if (invRes.error) toastError('Error loading invoices: ' + invRes.error.message)
    else setInvoices(invRes.data || [])

    if (expRes.error) toastError('Error loading expenses: ' + expRes.error.message)
    else setExpenses(expRes.data || [])

    if (custRes.data) setCustomers(custRes.data)
    if (rcptRes.data) setReceipts(rcptRes.data)

    setLoading(false)
  }, [toastError])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Helper to extract line items with apportioned discounts
  const extractApportionedLineItems = (invoiceList) => {
    const rows = []
    for (const inv of invoiceList) {
      const items = inv.items || []
      const subtotal = invoiceSubtotal(items)
      const invDiscount = parseFloat(inv.discount) || 0

      items.forEach((item, idx) => {
        const qty = parseFloat(item.qty) || 1
        const price = parseFloat(item.price) || 0
        const buyingPrice = parseFloat(item.buying_price) || 0
        const itemSales = qty * price
        const itemCost = qty * buyingPrice

        // Apportion discount by item's share of subtotal
        const itemDiscount = subtotal > 0 ? (itemSales / subtotal) * invDiscount : 0
        const grossProfit = itemSales - itemCost
        const netProfit = grossProfit - itemDiscount

        rows.push({
          date: inv.date || inv.invoice_date,
          invoice_id: inv.id,
          customer_name: inv.customers?.name || '—',
          item_name: item.name,
          qty,
          price,
          sales: itemSales,
          discount: itemDiscount,
          cost: itemCost,
          gross_profit: grossProfit,
          profit_margin: netProfit,
          sales_by: inv.employees?.name || '—',
          employee_id: inv.sales_by_id || inv.sales_by
        })
      })
    }
    return rows
  }

  // Filtered datasets per report
  const dailySalesItems = extractApportionedLineItems(
    invoices.filter(i => (i.date || i.invoice_date || '') === selectedDate)
  )

  const { start: mStart, end: mEnd } = monthRange(selectedMonth)
  const monthlyInvoices = invoices.filter(i => {
    const d = i.date || i.invoice_date || ''
    return d >= mStart && d <= mEnd
  })

  // Group monthly invoices by day
  const monthlySalesDays = {}
  monthlyInvoices.forEach(inv => {
    const d = inv.date || inv.invoice_date || ''
    if (!monthlySalesDays[d]) {
      monthlySalesDays[d] = { date: d, sales: 0, discount: 0, profit: 0 }
    }
    const invSales = parseFloat(inv.grand_total) || 0
    const invDiscount = parseFloat(inv.discount) || 0
    const invProfit = invoiceNetProfit(inv.items || [], inv.discount)

    monthlySalesDays[d].sales += invSales
    monthlySalesDays[d].discount += invDiscount
    monthlySalesDays[d].profit += invProfit
  })
  const monthlySalesList = Object.values(monthlySalesDays).sort((a, b) => a.date.localeCompare(b.date))

  // Daily Expenses
  const dailyExpensesList = expenses.filter(e => (e.date || '') === selectedDate)

  // Monthly Expenses grouped by day
  const monthlyExpenses = expenses.filter(e => {
    const d = e.date || ''
    return d >= mStart && d <= mEnd
  })
  const monthlyExpenseDays = {}
  monthlyExpenses.forEach(exp => {
    const d = exp.date || ''
    if (!monthlyExpenseDays[d]) {
      monthlyExpenseDays[d] = { date: d, amount: 0 }
    }
    monthlyExpenseDays[d].amount += parseFloat(exp.amount) || 0
  })
  const monthlyExpenseList = Object.values(monthlyExpenseDays).sort((a, b) => a.date.localeCompare(b.date))

  // Profit report items for selected date range or month
  const profitReportItems = extractApportionedLineItems(monthlyInvoices)

  // Customer aggregates
  const customerReportData = customers.map(c => {
    const cInvs = invoices.filter(i => i.customer_id === c.id)
    const cGenReceipts = receipts.filter(r => r.customer_id === c.id && !r.invoice_id)
    const stats = customerStats(cInvs, cGenReceipts)
    return {
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      ...stats
    }
  })

  // Agent's own sales report
  const mySalesInvoices = invoices.filter(i => {
    // Check if employee matches linked profile or current user email
    return i.sales_by === profile?.employee_id || (profile?.full_name && i.employees?.name === profile.full_name)
  })
  const mySalesItems = extractApportionedLineItems(mySalesInvoices)

  // --- PRINT / DOWNLOAD HANDLERS ---
  const handlePrint = () => {
    const { title, html } = getActiveReportHtml()
    printHtml(html, title)
  }

  const handleDownload = () => {
    const { title, html } = getActiveReportHtml()
    downloadHtml(html, `${title}-${today()}`)
  }

  const getActiveReportHtml = () => {
    let title = 'Report'
    let content = ''

    if (activeTab === 'daily-sales') {
      title = `Daily-Sales-Report-${selectedDate}`
      const totalSales = dailySalesItems.reduce((s, r) => s + r.sales, 0)
      const totalDisc = dailySalesItems.reduce((s, r) => s + r.discount, 0)
      const totalProfit = dailySalesItems.reduce((s, r) => s + r.profit_margin, 0)

      content = `
        <div class="doc-title">DAILY SALES & PROFIT STATEMENT</div>
        <div style="text-align:center;color:#666;font-size:11px;margin-bottom:16px;">Date: <b>${formatDate(selectedDate)}</b></div>
        <table>
          <thead>
            <tr><th>#</th><th>Invoice #</th><th>Customer</th><th>Item / Service</th><th class="amount-col">Sales</th><th class="amount-col">Discount</th><th class="amount-col">Profit Margin</th></tr>
          </thead>
          <tbody>
            ${dailySalesItems.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td class="mono">${escapeHtml(r.invoice_id)}</td>
                <td>${escapeHtml(r.customer_name)}</td>
                <td>${escapeHtml(r.item_name)}</td>
                <td class="amount-col">${money(r.sales, currencySymbol)}</td>
                <td class="amount-col" style="color:#e65100">${money(r.discount, currencySymbol)}</td>
                <td class="amount-col" style="color:#2e7d32">${money(r.profit_margin, currencySymbol)}</td>
              </tr>
            `).join('')}
            <tr class="grand-total-row">
              <td colspan="4">GRAND TOTAL</td>
              <td class="amount-col">${money(totalSales, currencySymbol)}</td>
              <td class="amount-col">${money(totalDisc, currencySymbol)}</td>
              <td class="amount-col">${money(totalProfit, currencySymbol)}</td>
            </tr>
          </tbody>
        </table>
      `
    } else if (activeTab === 'monthly-sales') {
      title = `Monthly-Sales-Report-${selectedMonth}`
      const totalSales = monthlySalesList.reduce((s, r) => s + r.sales, 0)
      const totalDisc = monthlySalesList.reduce((s, r) => s + r.discount, 0)
      const totalProfit = monthlySalesList.reduce((s, r) => s + r.profit_margin || s + r.profit, 0)

      content = `
        <div class="doc-title">MONTHLY SALES STATEMENT</div>
        <div style="text-align:center;color:#666;font-size:11px;margin-bottom:16px;">Month: <b>${monthLabel(selectedMonth)}</b></div>
        <table>
          <thead>
            <tr><th>#</th><th>Date</th><th class="amount-col">Total Sales</th><th class="amount-col">Total Discount</th><th class="amount-col">Net Profit</th></tr>
          </thead>
          <tbody>
            ${monthlySalesList.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${formatDate(r.date)}</td>
                <td class="amount-col">${money(r.sales, currencySymbol)}</td>
                <td class="amount-col" style="color:#e65100">${money(r.discount, currencySymbol)}</td>
                <td class="amount-col" style="color:#2e7d32">${money(r.profit, currencySymbol)}</td>
              </tr>
            `).join('')}
            <tr class="grand-total-row">
              <td colspan="2">GRAND TOTAL</td>
              <td class="amount-col">${money(totalSales, currencySymbol)}</td>
              <td class="amount-col">${money(totalDisc, currencySymbol)}</td>
              <td class="amount-col">${money(totalProfit, currencySymbol)}</td>
            </tr>
          </tbody>
        </table>
      `
    } else if (activeTab === 'profit-report') {
      title = `Profit-Report-${selectedMonth}`
      const totSales = profitReportItems.reduce((s, r) => s + r.sales, 0)
      const totDisc = profitReportItems.reduce((s, r) => s + r.discount, 0)
      const totCost = profitReportItems.reduce((s, r) => s + r.cost, 0)
      const totGross = profitReportItems.reduce((s, r) => s + r.gross_profit, 0)
      const totNet = profitReportItems.reduce((s, r) => s + r.profit_margin, 0)

      content = `
        <div class="doc-title">PROFIT & MARGIN AUDIT REPORT</div>
        <div style="text-align:center;color:#666;font-size:11px;margin-bottom:4px;">Period: <b>${monthLabel(selectedMonth)}</b></div>
        <div style="text-align:center;color:#888;font-size:10px;margin-bottom:16px;">*Gross Profit = Sales - Cost | Net Profit = Gross Profit - Discount. Operating expenses tracked separately.</div>
        <table>
          <thead>
            <tr><th>Date</th><th>Invoice #</th><th>Customer</th><th>Item</th><th class="amount-col">Sales</th><th class="amount-col">Discount</th><th class="amount-col">Cost</th><th class="amount-col">Gross Profit</th><th class="amount-col">Net Profit</th></tr>
          </thead>
          <tbody>
            ${profitReportItems.map((r) => `
              <tr>
                <td>${formatDate(r.date)}</td>
                <td class="mono">${escapeHtml(r.invoice_id)}</td>
                <td>${escapeHtml(r.customer_name)}</td>
                <td>${escapeHtml(r.item_name)}</td>
                <td class="amount-col">${money(r.sales, currencySymbol)}</td>
                <td class="amount-col" style="color:#e65100">${money(r.discount, currencySymbol)}</td>
                <td class="amount-col">${money(r.cost, currencySymbol)}</td>
                <td class="amount-col">${money(r.gross_profit, currencySymbol)}</td>
                <td class="amount-col" style="color:#2e7d32;font-weight:600">${money(r.profit_margin, currencySymbol)}</td>
              </tr>
            `).join('')}
            <tr class="grand-total-row">
              <td colspan="4">GRAND TOTALS</td>
              <td class="amount-col">${money(totSales, currencySymbol)}</td>
              <td class="amount-col">${money(totDisc, currencySymbol)}</td>
              <td class="amount-col">${money(totCost, currencySymbol)}</td>
              <td class="amount-col">${money(totGross, currencySymbol)}</td>
              <td class="amount-col">${money(totNet, currencySymbol)}</td>
            </tr>
          </tbody>
        </table>
      `
    } else if (activeTab === 'daily-expense') {
      title = `Daily-Expense-Report-${selectedDate}`
      const totalExp = dailyExpensesList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
      content = `
        <div class="doc-title">DAILY EXPENSE REPORT</div>
        <div style="text-align:center;color:#666;font-size:11px;margin-bottom:16px;">Date: <b>${formatDate(selectedDate)}</b></div>
        <table>
          <thead>
            <tr><th>Voucher #</th><th>Category</th><th>Description</th><th>Vendor / Paid To</th><th>Payment Method</th><th class="amount-col">Amount</th></tr>
          </thead>
          <tbody>
            ${dailyExpensesList.map((e) => `
              <tr>
                <td class="mono">${escapeHtml(e.id)}</td>
                <td>${escapeHtml(e.category)}</td>
                <td>${escapeHtml(e.note || e.description || '—')}</td>
                <td>${escapeHtml(e.paid_to || e.vendor || '—')}</td>
                <td>${escapeHtml(e.payment_method || 'Cash')}</td>
                <td class="amount-col" style="color:#d32f2f">${money(e.amount, currencySymbol)}</td>
              </tr>
            `).join('')}
            <tr class="grand-total-row">
              <td colspan="5">GRAND TOTAL</td>
              <td class="amount-col" style="color:#d32f2f">${money(totalExp, currencySymbol)}</td>
            </tr>
          </tbody>
        </table>
      `
    } else if (activeTab === 'monthly-expense') {
      title = `Monthly-Expense-Report-${selectedMonth}`
      const totalExp = monthlyExpenseList.reduce((s, r) => s + r.amount, 0)
      content = `
        <div class="doc-title">MONTHLY EXPENSE STATEMENT</div>
        <div style="text-align:center;color:#666;font-size:11px;margin-bottom:16px;">Month: <b>${monthLabel(selectedMonth)}</b></div>
        <table>
          <thead>
            <tr><th>#</th><th>Date</th><th class="amount-col">Total Expense</th></tr>
          </thead>
          <tbody>
            ${monthlyExpenseList.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${formatDate(r.date)}</td>
                <td class="amount-col" style="color:#d32f2f">${money(r.amount, currencySymbol)}</td>
              </tr>
            `).join('')}
            <tr class="grand-total-row">
              <td colspan="2">GRAND TOTAL</td>
              <td class="amount-col" style="color:#d32f2f">${money(totalExp, currencySymbol)}</td>
            </tr>
          </tbody>
        </table>
      `
    } else if (activeTab === 'customer-report') {
      title = `Customer-Audit-Report`
      const totBookings = customerReportData.reduce((s, r) => s + r.totalBooking, 0)
      const totSales = customerReportData.reduce((s, r) => s + r.totalSales, 0)
      const totDisc = customerReportData.reduce((s, r) => s + r.totalDiscount, 0)
      const totPaid = customerReportData.reduce((s, r) => s + r.totalPaid, 0)
      const totDue = customerReportData.reduce((s, r) => s + r.totalDue, 0)
      const totProfit = customerReportData.reduce((s, r) => s + r.totalProfit, 0)

      content = `
        <div class="doc-title">CUSTOMER LIFETIME SALES & PROFIT REPORT</div>
        <div style="text-align:center;color:#666;font-size:11px;margin-bottom:16px;">Total Customers Audited: ${customerReportData.length}</div>
        <table>
          <thead>
            <tr><th>Customer ID</th><th>Name</th><th>Mobile</th><th class="amount-col">Bookings</th><th class="amount-col">Sales</th><th class="amount-col">Discount</th><th class="amount-col">Paid</th><th class="amount-col">Due</th><th class="amount-col">Profit</th></tr>
          </thead>
          <tbody>
            ${customerReportData.map((c) => `
              <tr>
                <td class="mono">${escapeHtml(c.id)}</td>
                <td><b>${escapeHtml(c.name)}</b></td>
                <td class="mono">${escapeHtml(c.mobile || '—')}</td>
                <td class="amount-col">${c.totalBooking}</td>
                <td class="amount-col">${money(c.totalSales, currencySymbol)}</td>
                <td class="amount-col" style="color:#e65100">${money(c.totalDiscount, currencySymbol)}</td>
                <td class="amount-col" style="color:#2e7d32">${money(c.totalPaid, currencySymbol)}</td>
                <td class="amount-col" style="color:${c.totalDue > 0 ? '#d32f2f' : '#888'}">${money(c.totalDue, currencySymbol)}</td>
                <td class="amount-col" style="color:#2e7d32;font-weight:600">${money(c.totalProfit, currencySymbol)}</td>
              </tr>
            `).join('')}
            <tr class="grand-total-row">
              <td colspan="3">GRAND TOTALS</td>
              <td class="amount-col">${totBookings}</td>
              <td class="amount-col">${money(totSales, currencySymbol)}</td>
              <td class="amount-col">${money(totDisc, currencySymbol)}</td>
              <td class="amount-col">${money(totPaid, currencySymbol)}</td>
              <td class="amount-col">${money(totDue, currencySymbol)}</td>
              <td class="amount-col">${money(totProfit, currencySymbol)}</td>
            </tr>
          </tbody>
        </table>
      `
    }

    const html = buildLetterheadDoc({
      title,
      content,
      company: settings?.company
    })
    return { title, html }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Detailed business performance, sales breakdown, expense ledgers, and profit margins</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-teal" onClick={handlePrint}>
            <PrintIcon /> Print Report
          </button>
          <button className="btn btn-secondary" onClick={handleDownload}>
            <DownloadIcon /> Download File
          </button>
        </div>
      </div>

      <div className="card">
        {/* Navigation Tabs */}
        <div className="tabs">
          {!isAgent && (
            <>
              <button className={`tab ${activeTab === 'daily-sales' ? 'active' : ''}`} onClick={() => setActiveTab('daily-sales')}>
                Daily Sales & Profit
              </button>
              <button className={`tab ${activeTab === 'monthly-sales' ? 'active' : ''}`} onClick={() => setActiveTab('monthly-sales')}>
                Monthly Sales
              </button>
              <button className={`tab ${activeTab === 'daily-expense' ? 'active' : ''}`} onClick={() => setActiveTab('daily-expense')}>
                Daily Expenses
              </button>
              <button className={`tab ${activeTab === 'monthly-expense' ? 'active' : ''}`} onClick={() => setActiveTab('monthly-expense')}>
                Monthly Expenses
              </button>
              <button className={`tab ${activeTab === 'profit-report' ? 'active' : ''}`} onClick={() => setActiveTab('profit-report')}>
                Profit Report
              </button>
              <button className={`tab ${activeTab === 'customer-report' ? 'active' : ''}`} onClick={() => setActiveTab('customer-report')}>
                Customer Report
              </button>
            </>
          )}
          {isAgent && (
            <button className="tab active">
              My Sales Performance
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="filter-bar">
          {(activeTab === 'daily-sales' || activeTab === 'daily-expense') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Select Date:</label>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto' }}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          {(activeTab === 'monthly-sales' || activeTab === 'monthly-expense' || activeTab === 'profit-report') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Select Month:</label>
              <input
                type="month"
                className="form-input"
                style={{ width: 'auto' }}
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
            </div>
          )}

          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-secondary btn-sm" onClick={loadAllData}>↻ Refresh Data</button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Generating report data..." />
        ) : (
          <div>
            {/* 1. Daily Sales & Profit */}
            {activeTab === 'daily-sales' && (
              dailySalesItems.length === 0 ? (
                <EmptyState title="No sales on this date" description={`There were no invoices generated on ${formatDate(selectedDate)}.`} />
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Item / Package</th>
                        <th className="text-right">Sales Amount</th>
                        <th className="text-right">Apportioned Discount</th>
                        <th className="text-right">Profit Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySalesItems.map((r, i) => (
                        <tr key={i}>
                          <td>{formatDate(r.date)}</td>
                          <td className="mono" style={{ color: 'var(--gold)' }}>{r.invoice_id}</td>
                          <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.customer_name}</td>
                          <td>{r.item_name}</td>
                          <td className="mono text-right">{money(r.sales, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--orange)' }}>{money(r.discount, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 600 }}>{money(r.profit_margin, currencySymbol)}</td>
                        </tr>
                      ))}
                      <tr className="table-grand-total">
                        <td colSpan="4">GRAND TOTAL</td>
                        <td className="mono text-right">{money(dailySalesItems.reduce((s, r) => s + r.sales, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(dailySalesItems.reduce((s, r) => s + r.discount, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(dailySalesItems.reduce((s, r) => s + r.profit_margin, 0), currencySymbol)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 2. Monthly Sales */}
            {activeTab === 'monthly-sales' && (
              monthlySalesList.length === 0 ? (
                <EmptyState title="No sales for this month" description={`No sales recorded in ${monthLabel(selectedMonth)}.`} />
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="text-right">Daily Total Sales</th>
                        <th className="text-right">Daily Total Discount</th>
                        <th className="text-right">Daily Total Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySalesList.map((r, i) => (
                        <tr key={i}>
                          <td>{formatDate(r.date)}</td>
                          <td className="mono text-right">{money(r.sales, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--orange)' }}>{money(r.discount, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 600 }}>{money(r.profit, currencySymbol)}</td>
                        </tr>
                      ))}
                      <tr className="table-grand-total">
                        <td>GRAND TOTAL ({monthLabel(selectedMonth)})</td>
                        <td className="mono text-right">{money(monthlySalesList.reduce((s, r) => s + r.sales, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(monthlySalesList.reduce((s, r) => s + r.discount, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(monthlySalesList.reduce((s, r) => s + r.profit, 0), currencySymbol)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 3. Daily Expenses */}
            {activeTab === 'daily-expense' && (
              dailyExpensesList.length === 0 ? (
                <EmptyState title="No expenses recorded on this date" description={`No expense vouchers were logged on ${formatDate(selectedDate)}.`} />
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Voucher #</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Vendor / Paid To</th>
                        <th>Payment Method</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyExpensesList.map(e => (
                        <tr key={e.id}>
                          <td className="mono" style={{ color: 'var(--gold)' }}>{e.id}</td>
                          <td><span className="pill pill-gold">{e.category}</span></td>
                          <td>{e.note || e.description || '—'}</td>
                          <td>{e.paid_to || e.vendor || '—'}</td>
                          <td>{e.payment_method || 'Cash'}</td>
                          <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: 600 }}>{money(e.amount, currencySymbol)}</td>
                        </tr>
                      ))}
                      <tr className="table-grand-total">
                        <td colSpan="5">GRAND TOTAL</td>
                        <td className="mono text-right" style={{ color: 'var(--red)' }}>
                          {money(dailyExpensesList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), currencySymbol)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 4. Monthly Expenses */}
            {activeTab === 'monthly-expense' && (
              monthlyExpenseList.length === 0 ? (
                <EmptyState title="No expenses for this month" description={`No expenses logged in ${monthLabel(selectedMonth)}.`} />
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="text-right">Total Daily Expenses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyExpenseList.map((r, i) => (
                        <tr key={i}>
                          <td>{formatDate(r.date)}</td>
                          <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: 600 }}>{money(r.amount, currencySymbol)}</td>
                        </tr>
                      ))}
                      <tr className="table-grand-total">
                        <td>GRAND TOTAL ({monthLabel(selectedMonth)})</td>
                        <td className="mono text-right" style={{ color: 'var(--red)' }}>
                          {money(monthlyExpenseList.reduce((s, r) => s + r.amount, 0), currencySymbol)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 5. Profit Report */}
            {activeTab === 'profit-report' && (
              profitReportItems.length === 0 ? (
                <EmptyState title="No profit data available" description={`No invoices found in ${monthLabel(selectedMonth)}.`} />
              ) : (
                <div>
                  <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    💡 <b>Rule:</b> Gross Profit = (Sales − Cost) | Net Profit = (Gross Profit − Discount). Operating expenses are tracked separately in the Expense Report.
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Invoice #</th>
                          <th>Customer</th>
                          <th>Line Item</th>
                          <th className="text-right">Sales</th>
                          <th className="text-right">Discount</th>
                          <th className="text-right">Item Cost</th>
                          <th className="text-right">Gross Profit</th>
                          <th className="text-right">Net Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitReportItems.map((r, i) => (
                          <tr key={i}>
                            <td>{formatDate(r.date)}</td>
                            <td className="mono" style={{ color: 'var(--gold)' }}>{r.invoice_id}</td>
                            <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.customer_name}</td>
                            <td>{r.item_name}</td>
                            <td className="mono text-right">{money(r.sales, currencySymbol)}</td>
                            <td className="mono text-right" style={{ color: 'var(--orange)' }}>{money(r.discount, currencySymbol)}</td>
                            <td className="mono text-right">{money(r.cost, currencySymbol)}</td>
                            <td className="mono text-right" style={{ color: 'var(--text-primary)' }}>{money(r.gross_profit, currencySymbol)}</td>
                            <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 600 }}>{money(r.profit_margin, currencySymbol)}</td>
                          </tr>
                        ))}
                        <tr className="table-grand-total">
                          <td colSpan="4">GRAND TOTALS</td>
                          <td className="mono text-right">{money(profitReportItems.reduce((s, r) => s + r.sales, 0), currencySymbol)}</td>
                          <td className="mono text-right">{money(profitReportItems.reduce((s, r) => s + r.discount, 0), currencySymbol)}</td>
                          <td className="mono text-right">{money(profitReportItems.reduce((s, r) => s + r.cost, 0), currencySymbol)}</td>
                          <td className="mono text-right">{money(profitReportItems.reduce((s, r) => s + r.gross_profit, 0), currencySymbol)}</td>
                          <td className="mono text-right">{money(profitReportItems.reduce((s, r) => s + r.profit_margin, 0), currencySymbol)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}

            {/* 6. Customer Report */}
            {activeTab === 'customer-report' && (
              <div>
                {/* Summary Strip */}
                <div className="kpi-grid" style={{ marginBottom: 16 }}>
                  <div className="kpi-card gold">
                    <div className="kpi-label">Total Customers</div>
                    <div className="kpi-value gold">{customerReportData.length}</div>
                  </div>
                  <div className="kpi-card teal">
                    <div className="kpi-label">Total Sales</div>
                    <div className="kpi-value teal">{money(customerReportData.reduce((s, c) => s + c.totalSales, 0), currencySymbol)}</div>
                  </div>
                  <div className="kpi-card red">
                    <div className="kpi-label">Total Due</div>
                    <div className="kpi-value red">{money(customerReportData.reduce((s, c) => s + c.totalDue, 0), currencySymbol)}</div>
                  </div>
                  <div className="kpi-card teal">
                    <div className="kpi-label">Total Profit</div>
                    <div className="kpi-value teal">{money(customerReportData.reduce((s, c) => s + c.totalProfit, 0), currencySymbol)}</div>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer ID</th>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th className="text-center">Bookings</th>
                        <th className="text-right">Total Sales</th>
                        <th className="text-right">Total Discount</th>
                        <th className="text-right">Total Paid</th>
                        <th className="text-right">Total Due</th>
                        <th className="text-right">Total Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerReportData.map(c => (
                        <tr key={c.id}>
                          <td className="mono" style={{ color: 'var(--gold)' }}>{c.id}</td>
                          <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</td>
                          <td className="mono">{c.mobile || '—'}</td>
                          <td className="text-center mono">{c.totalBooking}</td>
                          <td className="mono text-right">{money(c.totalSales, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--orange)' }}>{money(c.totalDiscount, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--teal)' }}>{money(c.totalPaid, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: c.totalDue > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{money(c.totalDue, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 600 }}>{money(c.totalProfit, currencySymbol)}</td>
                        </tr>
                      ))}
                      <tr className="table-grand-total">
                        <td colSpan="3">GRAND TOTALS</td>
                        <td className="mono text-center">{customerReportData.reduce((s, c) => s + c.totalBooking, 0)}</td>
                        <td className="mono text-right">{money(customerReportData.reduce((s, c) => s + c.totalSales, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(customerReportData.reduce((s, c) => s + c.totalDiscount, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(customerReportData.reduce((s, c) => s + c.totalPaid, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(customerReportData.reduce((s, c) => s + c.totalDue, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(customerReportData.reduce((s, c) => s + c.totalProfit, 0), currencySymbol)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. Agent's My Sales */}
            {activeTab === 'my-sales' && (
              mySalesItems.length === 0 ? (
                <EmptyState title="No sales booked" description="Invoices assigned to your profile will appear here." />
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Tour / Item</th>
                        <th className="text-right">Sales Amount</th>
                        <th className="text-right">Discount</th>
                        <th className="text-right">Profit Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySalesItems.map((r, i) => (
                        <tr key={i}>
                          <td>{formatDate(r.date)}</td>
                          <td className="mono" style={{ color: 'var(--gold)' }}>{r.invoice_id}</td>
                          <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.customer_name}</td>
                          <td>{r.item_name}</td>
                          <td className="mono text-right">{money(r.sales, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--orange)' }}>{money(r.discount, currencySymbol)}</td>
                          <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 600 }}>{money(r.profit_margin, currencySymbol)}</td>
                        </tr>
                      ))}
                      <tr className="table-grand-total">
                        <td colSpan="4">MY TOTALS</td>
                        <td className="mono text-right">{money(mySalesItems.reduce((s, r) => s + r.sales, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(mySalesItems.reduce((s, r) => s + r.discount, 0), currencySymbol)}</td>
                        <td className="mono text-right">{money(mySalesItems.reduce((s, r) => s + r.profit_margin, 0), currencySymbol)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function PrintIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
function DownloadIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
