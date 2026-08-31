import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/common/Toast'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { StatusPill } from '../components/common/StatusPill'
import { money } from '../utils/money'
import { formatDate, today, currentMonth, monthRange, isBirthdayToday } from '../utils/dateHelpers'
import { periodNetProfit, invoiceReceived, invoiceSubtotal } from '../utils/calculations'

export default function Dashboard() {
  const { user, profile, isAgent, isCustomerService, isAdmin } = useAuth()
  const { settings, currencySymbol, company } = useSettings()
  const { toasts, success, error: toastError, dismiss } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [customers, setCustomers] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [birthdayLogs, setBirthdayLogs] = useState([])

  const todayStr = today()
  const curMonthStr = currentMonth()
  const { start: monthStart, end: monthEnd } = monthRange(curMonthStr)

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, expRes, custRes, bLogRes] = await Promise.all([
        supabase.from('invoices').select('*, customers(name, mobile, email), employees(name), receipts(amount)').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('date', { ascending: false }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('birthday_log').select('*').order('created_at', { ascending: false })
      ])

      const allInvoices = invRes.data || []
      const allExpenses = expRes.data || []
      const allCustomers = custRes.data || []

      setInvoices(allInvoices)
      setExpenses(allExpenses)
      setCustomers(allCustomers)
      setBirthdayLogs(bLogRes.data || [])

      // Filter customers with birthdays today
      const todayBdays = allCustomers.filter(c => isBirthdayToday(c.dob))
      setBirthdays(todayBdays)

    } catch (err) {
      toastError('Dashboard data error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // --- CALCULATION LOGIC ---
  // Today's numbers
  const todayInvoices = invoices.filter(i => (i.date || i.invoice_date || '') === todayStr)
  const todayExpenses = expenses.filter(e => (e.date || '') === todayStr)
  const todaySales = todayInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0)
  const todayExpenseTotal = todayExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const todayNetProfit = periodNetProfit(todayInvoices, todayExpenses)

  // Current Month numbers
  const monthInvoices = invoices.filter(i => {
    const d = i.date || i.invoice_date || ''
    return d >= monthStart && d <= monthEnd
  })
  const monthExpensesList = expenses.filter(e => {
    const d = e.date || ''
    return d >= monthStart && d <= monthEnd
  })
  const monthSales = monthInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0)
  const monthExpenseTotal = monthExpensesList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const monthNetProfit = periodNetProfit(monthInvoices, monthExpensesList)

  // Seasonal Target Range numbers
  const targetStart = settings.system?.targetStartDate || monthStart
  const targetEnd = settings.system?.targetEndDate || monthEnd
  const seasonalTarget = parseFloat(settings.system?.seasonalTarget) || 0

  const seasonalInvoices = invoices.filter(i => {
    const d = i.date || i.invoice_date || ''
    return d >= targetStart && d <= targetEnd
  })
  const seasonalExpenses = expenses.filter(e => {
    const d = e.date || ''
    return d >= targetStart && d <= targetEnd
  })
  const seasonalSales = seasonalInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0)
  const seasonalExpenseTotal = seasonalExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const seasonalNetProfit = periodNetProfit(seasonalInvoices, seasonalExpenses)

  const seasonalProgress = seasonalTarget > 0 ? Math.min(100, Math.round((seasonalSales / seasonalTarget) * 100)) : 0

  // Total Outstanding Due across all invoices
  const totalDueAmount = invoices.reduce((sum, inv) => {
    const received = invoiceReceived(inv.receipts || [])
    return sum + Math.max(0, (parseFloat(inv.grand_total) || 0) - received)
  }, 0)

  // Agent Specific Metrics
  const myInvoices = invoices.filter(i => {
    return i.sales_by_id === profile?.employee_id || i.sales_by === profile?.employee_id || (profile?.full_name && i.employees?.name === profile.full_name)
  })
  const myTotalSales = myInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0)
  const myNetProfit = periodNetProfit(myInvoices, [])

  // Birthday Wish action
  const handleSendWish = async (c) => {
    const companyName = company?.name || 'Tour Guidance BD'
    const subject = encodeURIComponent(`Happy Birthday from ${companyName}! 🎉`)
    const body = encodeURIComponent(
      `Dear ${c.name},\n\nWishing you a very Happy Birthday from all of us at ${companyName}! 🎉✨\n\nMay your year ahead be filled with wonderful adventures, happiness, and unforgettable journeys.\n\nWarm regards,\nTeam ${companyName}`
    )

    // Open mailto link
    if (c.email) {
      window.location.href = `mailto:${c.email}?subject=${subject}&body=${body}`
    } else {
      toastError(`No email on file for ${c.name}. You can call them on ${c.mobile || 'their phone'}.`)
    }

    // Log the wish send into birthday_log
    try {
      await supabase.from('birthday_log').insert({
        customer_id: c.id,
        sent_date: todayStr,
        staff_name: profile?.full_name || user?.email || 'Staff'
      })
      success(`Birthday wish logged for ${c.name}`)
      loadDashboardData()
    } catch (err) {
      console.error('Birthday log error:', err)
    }
  }

  if (loading) return <LoadingSpinner message="Loading executive dashboard..." />

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Welcome back, {profile?.full_name || user?.email?.split('@')[0] || 'Executive'}
          </h1>
          <p className="page-subtitle">
            Tour Guidance BD &middot; Sales, Booking Operations & Financial Overview
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isAgent && (
            <>
              <button className="btn btn-primary" onClick={() => navigate('/invoices')} id="dash-new-invoice-btn">
                <PlusIcon /> New Invoice
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/receipts')}>
                Record Payment
              </button>
            </>
          )}
        </div>
      </div>

      {/* AGENT VIEW */}
      {isAgent ? (
        <div>
          <div className="dashboard-section-title">My Performance Summary</div>
          <div className="kpi-grid">
            <div className="kpi-card gold">
              <div className="kpi-label">My Total Bookings</div>
              <div className="kpi-value gold">{myInvoices.length}</div>
              <div className="kpi-sub">Total invoices closed</div>
            </div>
            <div className="kpi-card teal">
              <div className="kpi-label">My Total Sales</div>
              <div className="kpi-value teal">{money(myTotalSales, currencySymbol)}</div>
              <div className="kpi-sub">Gross booking revenue</div>
            </div>
            <div className="kpi-card teal">
              <div className="kpi-label">My Profit Contribution</div>
              <div className="kpi-value teal">{money(myNetProfit, currencySymbol)}</div>
              <div className="kpi-sub">Net profit on booked tours</div>
            </div>
          </div>
        </div>
      ) : (
        /* ADMIN / CUSTOMER SERVICE VIEW */
        <>
          {/* Seasonal Target Gauge */}
          {seasonalTarget > 0 && (
            <div className="seasonal-gauge">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--gold)' }}>
                    Seasonal Sales Target
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                    ({formatDate(targetStart)} &ndash; {formatDate(targetEnd)})
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  <b style={{ color: 'var(--gold)' }}>{money(seasonalSales, currencySymbol)}</b> / {money(seasonalTarget, currencySymbol)} ({seasonalProgress}%)
                </div>
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${seasonalProgress}%` }} />
              </div>
            </div>
          )}

          {/* Today's Performance */}
          <div className="dashboard-section-title">Today's Real-Time Performance ({formatDate(todayStr)})</div>
          <div className="kpi-grid">
            <div className="kpi-card gold">
              <div className="kpi-label">Total Daily Sales</div>
              <div className="kpi-value gold">{money(todaySales, currencySymbol)}</div>
              <div className="kpi-sub">{todayInvoices.length} invoice(s) generated today</div>
            </div>
            <div className="kpi-card red">
              <div className="kpi-label">Total Daily Expenses</div>
              <div className="kpi-value red">{money(todayExpenseTotal, currencySymbol)}</div>
              <div className="kpi-sub">{todayExpenses.length} expense voucher(s) logged</div>
            </div>
            <div className="kpi-card teal">
              <div className="kpi-label">Total Daily Net Profit</div>
              <div className="kpi-value teal">{money(todayNetProfit, currencySymbol)}</div>
              <div className="kpi-sub">Cost-based net formula (Sales - Cost - Disc - Exp)</div>
            </div>
            <div className="kpi-card orange">
              <div className="kpi-label">Total Outstanding Due</div>
              <div className="kpi-value orange">{money(totalDueAmount, currencySymbol)}</div>
              <div className="kpi-sub">Pending collection across all bookings</div>
            </div>
          </div>

          {/* Monthly Performance */}
          <div className="dashboard-section-title">Current Month Performance ({new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })})</div>
          <div className="kpi-grid">
            <div className="kpi-card gold">
              <div className="kpi-label">Total Monthly Sales</div>
              <div className="kpi-value gold">{money(monthSales, currencySymbol)}</div>
              <div className="kpi-sub">{monthInvoices.length} monthly booking(s)</div>
            </div>
            <div className="kpi-card red">
              <div className="kpi-label">Total Monthly Expenses</div>
              <div className="kpi-value red">{money(monthExpenseTotal, currencySymbol)}</div>
              <div className="kpi-sub">{monthExpensesList.length} expense voucher(s)</div>
            </div>
            <div className="kpi-card teal">
              <div className="kpi-label">Total Monthly Net Profit</div>
              <div className="kpi-value teal">{money(monthNetProfit, currencySymbol)}</div>
              <div className="kpi-sub">Agrees with Monthly Profit Report</div>
            </div>
          </div>

          {/* Selected Seasonal Range Summary */}
          {seasonalTarget > 0 && (
            <>
              <div className="dashboard-section-title">Configured Seasonal Period ({formatDate(targetStart)} to {formatDate(targetEnd)})</div>
              <div className="kpi-grid">
                <div className="kpi-card gold">
                  <div className="kpi-label">Seasonal Period Sales</div>
                  <div className="kpi-value gold">{money(seasonalSales, currencySymbol)}</div>
                </div>
                <div className="kpi-card red">
                  <div className="kpi-label">Seasonal Period Expenses</div>
                  <div className="kpi-value red">{money(seasonalExpenseTotal, currencySymbol)}</div>
                </div>
                <div className="kpi-card teal">
                  <div className="kpi-label">Seasonal Period Net Profit</div>
                  <div className="kpi-value teal">{money(seasonalNetProfit, currencySymbol)}</div>
                </div>
              </div>
            </>
          )}

          {/* Today's Birthdays Notification Panel */}
          {settings.system?.birthdayWishEnabled !== false && (
            <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(201,162,75,0.3)', background: 'linear-gradient(135deg, #141C30, #1b2640)' }}>
              <div className="card-header" style={{ borderColor: 'rgba(201,162,75,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.2rem' }}>🎂</span>
                  <span className="card-title" style={{ color: 'var(--gold)' }}>
                    Today's Customer Birthdays ({birthdays.length})
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Requires staff click to send greeting email (client-side assistance)
                </span>
              </div>

              {birthdays.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>
                  No customer birthdays registered for today ({formatDate(todayStr)}).
                </div>
              ) : (
                <div>
                  {birthdays.map(c => {
                    const hasSent = birthdayLogs.some(l => l.customer_id === c.id && l.sent_date === todayStr)
                    return (
                      <div key={c.id} className="birthday-card">
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {c.name} {c.mobile ? `· ${c.mobile}` : ''}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Email: {c.email || 'No email registered'} | DOB: {formatDate(c.dob)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {hasSent && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--teal)', fontWeight: 600 }}>
                              ✓ Wish Sent Today
                            </span>
                          )}
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSendWish(c)}
                            id={`wish-btn-${c.id}`}
                          >
                            🎉 Send Birthday Wish
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Recent Invoices & Quick View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Invoices</span>
            <Link to="/invoices" style={{ color: 'var(--gold)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}>
              View All &rarr;
            </Link>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Travel Date</th>
                  <th>Customer</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 6).map(inv => {
                  const received = invoiceReceived(inv.receipts || [])
                  const due = (parseFloat(inv.grand_total) || 0) - received
                  return (
                    <tr key={inv.id}>
                      <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{inv.id}</td>
                      <td>{formatDate(inv.invoice_date)}</td>
                      <td style={{ color: 'var(--teal)' }}>{formatDate(inv.travel_date)}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inv.customers?.name || '—'}</td>
                      <td className="mono text-right">{money(inv.grand_total, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--teal)' }}>{money(received, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: due > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                        {money(due, currencySymbol)}
                      </td>
                      <td><StatusPill grandTotal={inv.grand_total} received={received} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
