import { useState } from 'react'
import { useAccounts } from '../../contexts/AccountsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { money } from '../../utils/money'
import { formatDate } from '../../utils/dateHelpers'
import { Modal } from '../../components/common/Modal'
import { printHtml, downloadHtml, buildLetterheadDoc, escapeHtml } from '../../utils/printService'

export default function ReceivablesPayables() {
  const {
    customerReceivables,
    vendorPayables,
    unifiedTransactions
  } = useAccounts()

  const { settings, currencySymbol } = useSettings()

  const [activeTab, setActiveTab] = useState('receivables') // 'receivables' | 'payables'
  const [search, setSearch] = useState('')

  // Statement modal
  const [selectedEntity, setSelectedEntity] = useState(null)

  const filteredReceivables = customerReceivables.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.customerName?.toLowerCase().includes(s) || c.customerMobile?.includes(s)
  })

  const filteredPayables = vendorPayables.filter(v => {
    if (!search) return true
    const s = search.toLowerCase()
    return v.vendorName?.toLowerCase().includes(s) || v.vendorPhone?.includes(s)
  })

  const totalReceivables = customerReceivables.reduce((s, c) => s + c.totalDue, 0)
  const totalPayables = vendorPayables.reduce((s, v) => s + v.totalDue, 0)

  const handlePrintCustomerStatement = (customer) => {
    const content = `
      <div class="doc-title" style="font-size: 20px; font-weight: 800; text-align: center; color: #0A0F1C; letter-spacing: 1px; margin-top: 10px;">CUSTOMER ACCOUNT STATEMENT</div>
      <div style="text-align: center; color: #777; font-size: 11px; margin-bottom: 18px;">Statement of Bookings & Outstanding Balance</div>

      <div class="doc-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 18px; font-size: 12px;">
        <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Customer Name:</span> <span class="doc-meta-value" style="font-weight: 700;">${escapeHtml(customer.customerName)}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Mobile Number:</span> <span class="doc-meta-value" style="font-family: monospace;">${escapeHtml(customer.customerMobile || '—')}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Total Invoiced:</span> <span class="doc-meta-value" style="font-weight: 700; font-family: monospace;">${money(customer.totalInvoiced, currencySymbol)}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Outstanding Due:</span> <span class="doc-meta-value" style="font-weight: 800; font-family: monospace; color: #991b1b;">${money(customer.totalDue, currencySymbol)}</span></div>
      </div>

      <table class="doc-table">
        <thead>
          <tr>
            <th>Invoice ID</th>
            <th>Date</th>
            <th>Travel Date</th>
            <th style="text-align: right;">Total Amount</th>
            <th style="text-align: right;">Paid</th>
            <th style="text-align: right;">Due Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${(customer.invoices || []).map(inv => `
            <tr>
              <td style="font-family: monospace; font-weight: 600;">${escapeHtml(inv.id)}</td>
              <td>${formatDate(inv.date)}</td>
              <td style="color: #0d9488;">${formatDate(inv.travel_date)}</td>
              <td style="text-align: right; font-family: monospace;">${money(inv.grand_total, currencySymbol)}</td>
              <td style="text-align: right; font-family: monospace; color: #166534;">${money(inv.paid, currencySymbol)}</td>
              <td style="text-align: right; font-family: monospace; font-weight: 700; color: ${inv.due > 0 ? '#991b1b' : '#166534'};">${money(inv.due, currencySymbol)}</td>
              <td><b>${escapeHtml(inv.status)}</b></td>
            </tr>
          `).join('') || '<tr><td colspan="7" style="text-align: center; color: #888;">No invoices found.</td></tr>'}
        </tbody>
      </table>
    `
    const html = buildLetterheadDoc({
      title: `Customer-Statement-${customer.customerName}`,
      content,
      company: settings?.company
    })
    printHtml(html, `Customer-Statement-${customer.customerName}`)
  }

  const handlePrintVendorStatement = (vendor) => {
    const vTx = unifiedTransactions.filter(t => (t.entityName && t.entityName.toLowerCase() === vendor.vendorName.toLowerCase()))

    const content = `
      <div class="doc-title" style="font-size: 20px; font-weight: 800; text-align: center; color: #0A0F1C; letter-spacing: 1px; margin-top: 10px;">VENDOR PAYABLE STATEMENT</div>
      <div style="text-align: center; color: #777; font-size: 11px; margin-bottom: 18px;">Supplier Ledger & Disbursement Record</div>

      <div class="doc-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 18px; font-size: 12px;">
        <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Vendor / Supplier:</span> <span class="doc-meta-value" style="font-weight: 700;">${escapeHtml(vendor.vendorName)}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Phone / Contact:</span> <span class="doc-meta-value" style="font-family: monospace;">${escapeHtml(vendor.vendorPhone || '—')}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Total Billed:</span> <span class="doc-meta-value" style="font-weight: 700; font-family: monospace;">${money(vendor.totalBilled, currencySymbol)}</span></div>
        <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Outstanding Payable:</span> <span class="doc-meta-value" style="font-weight: 800; font-family: monospace; color: #b45309;">${money(vendor.totalDue, currencySymbol)}</span></div>
      </div>

      <table class="doc-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher #</th>
            <th>Description</th>
            <th style="text-align: right;">Billed (Expense)</th>
            <th style="text-align: right;">Disbursed (Paid)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${vTx.map(t => `
            <tr>
              <td>${formatDate(t.date)}</td>
              <td style="font-family: monospace;">${escapeHtml(t.id)}</td>
              <td>${escapeHtml(t.description)}</td>
              <td style="text-align: right; font-family: monospace;">${t.type === 'Expense' ? money(t.amount, currencySymbol) : '—'}</td>
              <td style="text-align: right; font-family: monospace; color: #166534;">${t.type === 'Payment' ? money(t.amount, currencySymbol) : '—'}</td>
              <td><b>${escapeHtml(t.type)}</b></td>
            </tr>
          `).join('') || '<tr><td colspan="6" style="text-align: center; color: #888;">No transactions found for this vendor.</td></tr>'}
        </tbody>
      </table>
    `
    const html = buildLetterheadDoc({
      title: `Vendor-Statement-${vendor.vendorName}`,
      content,
      company: settings?.company
    })
    printHtml(html, `Vendor-Statement-${vendor.vendorName}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Sub-tabs & Search */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 18px',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'receivables' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('receivables')}
          >
            👥 Customer Receivables ({customerReceivables.filter(c => c.totalDue > 0).length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'payables' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('payables')}
          >
            🏨 Vendor Payables ({vendorPayables.filter(v => v.totalDue > 0).length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder={activeTab === 'receivables' ? 'Search customer or mobile...' : 'Search vendor...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div className="kpi-card red">
          <div className="kpi-label">Total Customer Receivables</div>
          <div className="kpi-value red">{money(totalReceivables, currencySymbol)}</div>
          <div className="kpi-sub" style={{ color: 'var(--text-muted)' }}>
            {customerReceivables.filter(c => c.totalDue > 0).length} customer accounts with dues
          </div>
        </div>

        <div className="kpi-card gold">
          <div className="kpi-label">Total Vendor Payables</div>
          <div className="kpi-value gold">{money(totalPayables, currencySymbol)}</div>
          <div className="kpi-sub" style={{ color: 'var(--text-muted)' }}>
            {vendorPayables.filter(v => v.totalDue > 0).length} suppliers with pending balances
          </div>
        </div>

        <div className="kpi-card teal">
          <div className="kpi-label">Net Working Balance</div>
          <div className="kpi-value teal">{money(totalReceivables - totalPayables, currencySymbol)}</div>
          <div className="kpi-sub" style={{ color: 'var(--teal)' }}>
            Receivables minus Payables
          </div>
        </div>
      </div>

      {/* TAB 1: CUSTOMER RECEIVABLES */}
      {activeTab === 'receivables' && (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Mobile Phone</th>
                  <th>Bookings Count</th>
                  <th className="text-right">Total Invoiced</th>
                  <th className="text-right">Total Received</th>
                  <th className="text-right">Outstanding Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceivables.map(c => (
                  <tr key={c.customerId}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.customerName}</td>
                    <td className="mono">{c.customerMobile}</td>
                    <td>{c.invoicesCount} booking(s)</td>
                    <td className="mono text-right">{money(c.totalInvoiced, currencySymbol)}</td>
                    <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 600 }}>
                      {money(c.totalPaid, currencySymbol)}
                    </td>
                    <td className="mono text-right" style={{
                      fontWeight: 800,
                      color: c.totalDue > 0 ? 'var(--red)' : 'var(--teal)',
                      fontSize: '0.95rem'
                    }}>
                      {money(c.totalDue, currencySymbol)}
                    </td>
                    <td>
                      <span className={`pill ${c.totalDue <= 0 ? 'pill-paid' : c.totalPaid > 0 ? 'pill-partial' : 'pill-due'}`}>
                        {c.totalDue <= 0 ? 'PAID' : c.totalPaid > 0 ? 'PARTIAL' : 'DUE'}
                      </span>
                    </td>
                    <td>
                      <div className="actions-col">
                        <button
                          className="btn btn-teal btn-sm"
                          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                          onClick={() => handlePrintCustomerStatement(c)}
                        >
                          🖨️ Statement
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: VENDOR PAYABLES */}
      {activeTab === 'payables' && (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor / Supplier Name</th>
                  <th>Phone Number</th>
                  <th>Address</th>
                  <th className="text-right">Total Billed</th>
                  <th className="text-right">Total Disbursed</th>
                  <th className="text-right">Pending Payable</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayables.map(v => (
                  <tr key={v.vendorId}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v.vendorName}</td>
                    <td className="mono">{v.vendorPhone}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{v.vendorAddress}</td>
                    <td className="mono text-right">{money(v.totalBilled, currencySymbol)}</td>
                    <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 600 }}>
                      {money(v.totalPaid, currencySymbol)}
                    </td>
                    <td className="mono text-right" style={{
                      fontWeight: 800,
                      color: v.totalDue > 0 ? '#E8A93B' : 'var(--teal)',
                      fontSize: '0.95rem'
                    }}>
                      {money(v.totalDue, currencySymbol)}
                    </td>
                    <td>
                      <span className={`pill ${v.totalDue <= 0 ? 'pill-paid' : 'pill-gold'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td>
                      <div className="actions-col">
                        <button
                          className="btn btn-teal btn-sm"
                          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                          onClick={() => handlePrintVendorStatement(v)}
                        >
                          🖨️ Statement
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
