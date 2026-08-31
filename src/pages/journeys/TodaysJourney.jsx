import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { StatusPill } from '../../components/common/StatusPill'
import { useSettings } from '../../contexts/SettingsContext'
import { money } from '../../utils/money'
import { formatDate, today, tomorrow } from '../../utils/dateHelpers'
import { invoiceReceived } from '../../utils/calculations'
import { printHtml, downloadHtml, buildLetterheadDoc, escapeHtml } from '../../utils/printService'

export default function TodaysJourney() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('today') // 'today' | 'tomorrow' | 'upcoming' | 'all'
  const [search, setSearch] = useState('')
  const [viewInvoice, setViewInvoice] = useState(null)

  const { toasts, dismiss, error: toastError } = useToast()
  const { settings, currencySymbol } = useSettings()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(name, mobile, email, address), employees(name), receipts(amount)')
      .order('travel_date', { ascending: true })

    if (error) {
      toastError('Failed to load journeys: ' + error.message)
    } else {
      setInvoices(data || [])
    }
    setLoading(false)
  }, [toastError])

  useEffect(() => {
    load()
  }, [load])

  const todayStr = today()
  const tomorrowStr = tomorrow()

  const filtered = invoices.filter(inv => {
    const tDate = inv.travel_date || ''
    
    // Time filter
    if (filter === 'today' && tDate !== todayStr) return false
    if (filter === 'tomorrow' && tDate !== tomorrowStr) return false
    if (filter === 'upcoming' && tDate < todayStr) return false

    // Search filter
    if (search.trim()) {
      const s = search.toLowerCase()
      const invId = (inv.id || '').toLowerCase()
      const custName = (inv.customers?.name || '').toLowerCase()
      const custPhone = (inv.customers?.mobile || '')
      const itemNames = (inv.items || []).map(i => i.name || '').join(' ').toLowerCase()

      return invId.includes(s) || custName.includes(s) || custPhone.includes(s) || itemNames.includes(s)
    }

    return true
  })

  const getTourNames = (items) => {
    if (!Array.isArray(items) || items.length === 0) return '—'
    return items.map(i => i.name).filter(Boolean).join(', ')
  }

  const handlePrint = (inv) => {
    const received = invoiceReceived(inv.receipts || [])
    const due = (parseFloat(inv.grand_total) || 0) - received
    const items = inv.items || []

    const content = `
      <div class="doc-title">TOUR ITINERARY & JOURNEY VOUCHER</div>
      <div class="travel-date-banner">✈ TRAVEL DATE: ${formatDate(inv.travel_date)}</div>
      
      <div class="doc-meta">
        <div class="doc-meta-row"><span class="doc-meta-label">Booking ID:</span><span class="doc-meta-value">${escapeHtml(inv.id)}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label">Travel Date:</span><span class="doc-meta-value">${formatDate(inv.travel_date)}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label">Customer Name:</span><span class="doc-meta-value">${escapeHtml(inv.customers?.name || '—')}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label">Contact Phone:</span><span class="doc-meta-value">${escapeHtml(inv.customers?.mobile || '—')}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label">No. of Travelers:</span><span class="doc-meta-value">${inv.num_travelers || 1} Person(s)</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label">Tour Manager:</span><span class="doc-meta-value">${escapeHtml(inv.employees?.name || 'Assigned Guide')}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item / Service / Destination</th>
            <th class="amount-col">Travelers / Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><b>${escapeHtml(it.name)}</b></td>
              <td class="amount-col">${it.qty || 1}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 20px; padding: 12px; background: #fdfaf2; border: 1px dashed #C9A24B; border-radius: 6px;">
        <div style="font-weight: 700; color: #0A0F1C; margin-bottom: 6px;">Passenger Notice & Guidelines:</div>
        <ul style="padding-left: 18px; color: #555; font-size: 11px; line-height: 1.6;">
          <li>Please arrive at the departure terminal / reporting location at least 45 minutes before departure.</li>
          <li>Carry your original NID / Passport & this booking voucher for verification.</li>
          <li>For any operational assistance, contact Tour Guidance BD Helpdesk immediately.</li>
        </ul>
      </div>

      <div class="totals-section" style="margin-top: 16px;">
        <div class="totals-row"><span>Total Booking:</span><span>${money(inv.grand_total, currencySymbol)}</span></div>
        <div class="totals-row paid-row"><span>Paid:</span><span>${money(received, currencySymbol)}</span></div>
        <div class="totals-row ${due > 0 ? 'due-row' : 'paid-row'}"><span>Due Balance:</span><span>${money(due, currencySymbol)}</span></div>
      </div>
    `

    const html = buildLetterheadDoc({
      title: `Journey-Voucher-${inv.id}`,
      content,
      company: settings?.company
    })
    printHtml(html, `Journey-${inv.id}`)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Today's Journey & Arrivals</h1>
          <p className="page-subtitle">Track traveler departures, upcoming journeys, and operational schedules</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="tabs" style={{ marginBottom: 14 }}>
          <button className={`tab ${filter === 'today' ? 'active' : ''}`} onClick={() => setFilter('today')}>
            Today's Journey ({invoices.filter(i => (i.travel_date || '') === todayStr).length})
          </button>
          <button className={`tab ${filter === 'tomorrow' ? 'active' : ''}`} onClick={() => setFilter('tomorrow')}>
            Tomorrow's Journey ({invoices.filter(i => (i.travel_date || '') === tomorrowStr).length})
          </button>
          <button className={`tab ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>
            Upcoming Journeys ({invoices.filter(i => (i.travel_date || '') >= todayStr).length})
          </button>
          <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            All Schedule ({invoices.length})
          </button>
        </div>

        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input
              className="form-input search-input"
              placeholder="Search by tour name, customer, phone, invoice #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading travel schedules..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🚢"
            title="No journeys found"
            description={
              filter === 'today'
                ? "There are no travelers scheduled for departure today."
                : filter === 'tomorrow'
                ? "No departures scheduled for tomorrow."
                : "No journeys matching the selected criteria."
            }
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Tour / Package Name</th>
                  <th>Travel Date</th>
                  <th className="text-center">Travelers</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th>Sales By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const received = invoiceReceived(inv.receipts || [])
                  const due = (parseFloat(inv.grand_total) || 0) - received
                  const isToday = inv.travel_date === todayStr

                  return (
                    <tr key={inv.id} style={isToday ? { background: 'rgba(201,162,75,0.04)' } : {}}>
                      <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{inv.id}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inv.customers?.name || '—'}</td>
                      <td className="mono">{inv.customers?.mobile || '—'}</td>
                      <td style={{ color: 'var(--gold-light)', maxWidth: 220 }} className="truncate" title={getTourNames(inv.items)}>
                        {getTourNames(inv.items)}
                      </td>
                      <td style={{ color: isToday ? 'var(--gold)' : 'var(--teal)', fontWeight: 600 }}>
                        {formatDate(inv.travel_date)} {isToday && '★'}
                      </td>
                      <td className="text-center mono">{inv.travelers || inv.num_travelers || 1}</td>
                      <td className="mono text-right">{money(inv.grand_total, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--teal)' }}>{money(received, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: due > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                        {money(due, currencySymbol)}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{inv.employees?.name || '—'}</td>
                      <td><StatusPill grandTotal={inv.grand_total} received={received} /></td>
                      <td>
                        <div className="actions-col">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewInvoice(inv)} title="View Details">
                            <EyeIcon />
                          </button>
                          <button className="btn btn-teal btn-sm btn-icon" onClick={() => handlePrint(inv)} title="Print Journey Voucher">
                            <PrintIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal View */}
      <Modal
        isOpen={!!viewInvoice}
        onClose={() => setViewInvoice(null)}
        title={`Journey Voucher & Details — ${viewInvoice?.id}`}
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-teal btn-sm" onClick={() => handlePrint(viewInvoice)}>
              Print Journey Voucher
            </button>
            <button className="btn btn-ghost" onClick={() => setViewInvoice(null)}>
              Close
            </button>
          </div>
        }
      >
        {viewInvoice && (
          <div>
            <div style={{ padding: '12px 16px', background: 'var(--gold-dim)', border: '1px solid rgba(201,162,75,0.3)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scheduled Travel Date</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: 'var(--gold)', fontWeight: 700 }}>
                ✈ {formatDate(viewInvoice.travel_date)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 16 }}>
              {[
                ['Customer Name', viewInvoice.customers?.name || '—'],
                ['Customer Mobile', viewInvoice.customers?.mobile || '—'],
                ['Email', viewInvoice.customers?.email || '—'],
                ['Address', viewInvoice.customers?.address || '—'],
                ['Total Travelers', `${viewInvoice.travelers || viewInvoice.num_travelers || 1} Person(s)`],
                ['Sales Executive', viewInvoice.employees?.name || '—'],
                ['Invoice Date', formatDate(viewInvoice.date || viewInvoice.invoice_date)],
                ['Payment Status', invoiceReceived(viewInvoice.receipts || []) >= viewInvoice.grand_total ? 'Paid' : 'Due Pending'],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>

            <div className="table-wrapper" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item / Package Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewInvoice.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{it.name}</td>
                      <td className="text-right mono">{it.qty || 1}</td>
                      <td className="text-right mono">{money(it.price, currencySymbol)}</td>
                      <td className="text-right mono">{money((it.qty || 1) * (it.price || 0), currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EyeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function PrintIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
