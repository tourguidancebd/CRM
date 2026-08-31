import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { useSettings } from '../../contexts/SettingsContext'
import { generateId } from '../../utils/idGenerator'
import { money } from '../../utils/money'
import { formatDate, today } from '../../utils/dateHelpers'
import { printHtml, downloadHtml, buildLetterheadDoc, escapeHtml } from '../../utils/printService'

export default function ReceiptList() {
  const [receipts, setReceipts] = useState([])
  const [customers, setCustomers] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    customer_id: '',
    invoice_id: '',
    date: today(),
    amount: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const { toasts, success, error: toastError, dismiss } = useToast()
  const { settings, currencySymbol, idSettings } = useSettings()

  const load = useCallback(async () => {
    setLoading(true)
    const [rcptRes, custRes, invRes] = await Promise.all([
      supabase.from('receipts').select('*, customers(name, mobile)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name, mobile').order('name'),
      supabase.from('invoices').select('id, customer_id, grand_total, date').order('created_at', { ascending: false }),
    ])

    const allReceipts = rcptRes.data || []
    const allInvoices = invRes.data || []

    // Attach receipts to invoices to calculate total received & remaining due per invoice
    const invoicesWithDue = allInvoices.map(inv => {
      const invRcpts = allReceipts.filter(r => r.invoice_id === inv.id)
      const paid = invRcpts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
      const grandTotal = parseFloat(inv.grand_total) || 0
      const due = Math.max(0, grandTotal - paid)
      return { ...inv, paid, due, receipts: invRcpts }
    })

    if (rcptRes.error) toastError('Failed to load receipts: ' + rcptRes.error.message)
    else setReceipts(allReceipts)

    if (custRes.data) setCustomers(custRes.data)
    setInvoices(invoicesWithDue)

    setLoading(false)
  }, [toastError])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setForm({
      customer_id: '',
      invoice_id: '',
      date: today(),
      amount: '',
      note: '',
    })
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (rcpt) => {
    setForm({
      customer_id: rcpt.customer_id || '',
      invoice_id: rcpt.invoice_id || '',
      date: rcpt.date || today(),
      amount: rcpt.amount || '',
      note: rcpt.note || '',
    })
    setEditingId(rcpt.id)
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.customer_id) {
      toastError('Please select a customer')
      return
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toastError('Please enter a valid payment amount')
      return
    }

    setSaving(true)
    try {
      const payload = {
        customer_id: form.customer_id,
        invoice_id: form.invoice_id || null,
        date: form.date,
        amount: parseFloat(form.amount),
        note: form.note || null,
      }

      if (editingId) {
        const { error } = await supabase.from('receipts').update(payload).eq('id', editingId)
        if (error) throw error
        success(`Receipt ${editingId} updated`)
      } else {
        const idConfig = settings?.idSettings?.receipt || idSettings?.receipt
        const newId = await generateId('receipt', 'receipts', idConfig)
        const { error } = await supabase.from('receipts').insert({ ...payload, id: newId })
        if (error) throw error
        success(`Money Receipt ${newId} created`)
      }

      setModalOpen(false)
      load()
    } catch (err) {
      toastError('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('receipts').delete().eq('id', deleteTarget.id)
      if (error) throw error
      success('Money Receipt deleted')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toastError('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handlePrint = (rcpt) => {
    const inv = invoices.find(i => i.id === rcpt.invoice_id)
    const invReceipts = receipts.filter(r => r.invoice_id === rcpt.invoice_id)
    const html = buildReceiptHtml(rcpt, inv, invReceipts, settings, currencySymbol)
    printHtml(html, `Receipt-${rcpt.id}`)
  }

  const handleDownload = (rcpt) => {
    const inv = invoices.find(i => i.id === rcpt.invoice_id)
    const invReceipts = receipts.filter(r => r.invoice_id === rcpt.invoice_id)
    const html = buildReceiptHtml(rcpt, inv, invReceipts, settings, currencySymbol)
    downloadHtml(html, `Receipt-${rcpt.id}`)
  }

  const customerInvoices = invoices.filter(i => i.customer_id === form.customer_id)
  const selectedInvoice = customerInvoices.find(i => i.id === form.invoice_id)

  // Calculations for chosen invoice in modal
  const invoiceGrandTotal = selectedInvoice ? (parseFloat(selectedInvoice.grand_total) || 0) : 0
  const alreadyPaidExcludingCurrent = selectedInvoice
    ? (selectedInvoice.receipts || [])
        .filter(r => r.id !== editingId)
        .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    : 0
  const currentDueBeforeThis = Math.max(0, invoiceGrandTotal - alreadyPaidExcludingCurrent)
  const currentEnteredAmount = parseFloat(form.amount) || 0
  const remainingDueAfterThis = Math.max(0, currentDueBeforeThis - currentEnteredAmount)

  const filtered = receipts.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (r.id || '').toLowerCase().includes(s) ||
      (r.customers?.name || '').toLowerCase().includes(s) ||
      (r.customers?.mobile || '').includes(s) ||
      (r.invoice_id || '').toLowerCase().includes(s) ||
      (r.note || '').toLowerCase().includes(s)
    )
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Money Receipts</h1>
          <p className="page-subtitle">Track customer payments, view remaining amounts, and issue official branded money receipts</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="new-receipt-btn">
          <PlusIcon /> Create Money Receipt
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input
              className="form-input search-input"
              placeholder="Search by receipt #, customer, invoice #, note..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading receipts..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="💵"
            title="No money receipts"
            description="Create a money receipt whenever a customer makes a deposit or pays an invoice."
            action={<button className="btn btn-primary" onClick={openCreate}>Create Money Receipt</button>}
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Linked Invoice</th>
                  <th className="text-right">Invoice Total</th>
                  <th className="text-right">Amount Received</th>
                  <th className="text-right">Remaining Due</th>
                  <th>Payment Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const linkedInv = invoices.find(i => i.id === r.invoice_id)
                  const invTotal = linkedInv ? (parseFloat(linkedInv.grand_total) || 0) : null
                  const remainingDue = linkedInv ? linkedInv.due : null

                  return (
                    <tr key={r.id}>
                      <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{r.id}</td>
                      <td>{formatDate(r.date)}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.customers?.name || '—'}</td>
                      <td className="mono">{r.customers?.mobile || '—'}</td>
                      <td>
                        {r.invoice_id ? (
                          <span className="mono" style={{ color: 'var(--teal)', fontWeight: 500 }}>{r.invoice_id}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>General Payment</span>
                        )}
                      </td>
                      <td className="mono text-right" style={{ color: 'var(--text-secondary)' }}>
                        {invTotal !== null ? money(invTotal, currencySymbol) : '—'}
                      </td>
                      <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 700, fontSize: '0.9rem' }}>
                        {money(r.amount, currencySymbol)}
                      </td>
                      <td className="mono text-right" style={{ fontWeight: 600, color: remainingDue > 0 ? 'var(--red)' : remainingDue === 0 ? 'var(--teal)' : 'var(--text-muted)' }}>
                        {remainingDue !== null ? money(remainingDue, currencySymbol) : '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 160 }} className="truncate" title={r.note || ''}>
                        {r.note || '—'}
                      </td>
                      <td>
                        <div className="actions-col">
                          <button className="btn btn-teal btn-sm btn-icon" onClick={() => handlePrint(r)} title="Print Receipt">
                            <PrintIcon />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDownload(r)} title="Download HTML">
                            <DownloadIcon />
                          </button>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(r)} title="Edit">
                            <EditIcon />
                          </button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(r)} title="Delete">
                            <TrashIcon />
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit Receipt — ${editingId}` : 'Create Money Receipt'}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-receipt-btn">
              {saving ? 'Saving...' : editingId ? 'Update Receipt' : 'Save & Issue Receipt'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label required">Customer</label>
            <select
              className="form-select"
              value={form.customer_id}
              onChange={e => setForm(f => ({ ...f, customer_id: e.target.value, invoice_id: '' }))}
              required
            >
              <option value="">Select customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.mobile}
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Linked Invoice (Optional)</label>
              <select
                className="form-select"
                value={form.invoice_id}
                onChange={e => {
                  const invId = e.target.value
                  const chosen = customerInvoices.find(i => i.id === invId)
                  let dueAmt = ''
                  if (chosen) {
                    const prevPaid = (chosen.receipts || [])
                      .filter(r => r.id !== editingId)
                      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
                    const outstanding = Math.max(0, (parseFloat(chosen.grand_total) || 0) - prevPaid)
                    dueAmt = String(outstanding)
                  }
                  setForm(f => ({
                    ...f,
                    invoice_id: invId,
                    amount: dueAmt || f.amount
                  }))
                }}
                disabled={!form.customer_id}
              >
                <option value="">General Payment (Not linked)</option>
                {customerInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.id} · {formatDate(inv.date)} · Total: {money(inv.grand_total, currencySymbol)} · Due: {money(inv.due, currencySymbol)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Receipt Date</label>
              <input
                type="date"
                className="form-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Remaining Balance Summary Breakdown Strip */}
          {selectedInvoice && (
            <div style={{
              background: 'rgba(201,162,75,0.08)',
              border: '1px solid rgba(201,162,75,0.3)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
                    Invoice Total
                  </div>
                  <div className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                    {money(invoiceGrandTotal, currencySymbol)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
                    Already Received
                  </div>
                  <div className="mono" style={{ fontWeight: 700, color: 'var(--teal)', fontSize: '0.92rem' }}>
                    {money(alreadyPaidExcludingCurrent, currencySymbol)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
                    Remaining Due
                  </div>
                  <div className="mono" style={{
                    fontWeight: 700,
                    color: remainingDueAfterThis > 0 ? 'var(--red)' : 'var(--teal)',
                    fontSize: '0.92rem'
                  }}>
                    {money(remainingDueAfterThis, currencySymbol)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label required" style={{ margin: 0 }}>Amount Received ({currencySymbol})</label>
              {selectedInvoice && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.72rem', color: 'var(--gold)', padding: '2px 6px' }}
                  onClick={() => setForm(f => ({ ...f, amount: String(currentDueBeforeThis) }))}
                >
                  Fill Remaining Due ({money(currentDueBeforeThis, currencySymbol)})
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--teal)' }}
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method / Note</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Paid via bKash / Cash / Bank Transfer with transaction reference details"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={3}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Money Receipt"
        message={`Are you sure you want to delete money receipt ${deleteTarget?.id} for ${money(deleteTarget?.amount || 0, currencySymbol)}? This will recalculate the remaining invoice due balance.`}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function buildReceiptHtml(rcpt, linkedInvoice, allInvoiceReceipts = [], settings, currencySymbol) {
  const invoiceTotal = linkedInvoice ? (parseFloat(linkedInvoice.grand_total) || 0) : null
  const totalReceivedOnInvoice = linkedInvoice
    ? allInvoiceReceipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    : parseFloat(rcpt.amount) || 0
  const remainingDue = linkedInvoice ? Math.max(0, invoiceTotal - totalReceivedOnInvoice) : 0

  const signatureHtml = settings?.company?.authoritySignature ? `
    <div class="signature-section" style="margin-top: 35px; display: flex; justify-content: flex-end;">
      <div class="signature-block" style="text-align: center;">
        <img src="${escapeHtml(settings.company.authoritySignature)}" alt="Signature" class="signature-img" style="max-height: 50px; margin-bottom: 5px;" />
        <div class="signature-line" style="border-top: 1px solid #333; padding-top: 5px; font-size: 11px; font-weight: 600;">Authorized Cashier / Officer</div>
      </div>
    </div>` : `
    <div class="signature-section" style="margin-top: 35px; display: flex; justify-content: flex-end;">
      <div class="signature-block" style="text-align: center;">
        <div style="height:45px;border-bottom:1px solid #333;width:180px; margin-bottom: 5px;"></div>
        <div class="signature-line" style="font-size: 11px; font-weight: 600;">Authorized Cashier / Officer</div>
      </div>
    </div>`

  const balanceBreakdownHtml = linkedInvoice ? `
    <div style="margin: 20px 0; border: 1px solid #e2d7c0; border-radius: 8px; overflow: hidden; background: #fff;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <tr style="background: #faf8f3; border-bottom: 1px solid #e2d7c0;">
          <td style="padding: 9px 14px; color: #555; font-weight: 600;">Total Invoice Amount:</td>
          <td style="padding: 9px 14px; text-align: right; font-weight: 700; font-family: monospace; color: #222;">${money(invoiceTotal, currencySymbol)}</td>
        </tr>
        <tr style="background: #f2f9f6; border-bottom: 1px solid #e2d7c0;">
          <td style="padding: 9px 14px; color: #166534; font-weight: 600;">Amount Received (This Receipt):</td>
          <td style="padding: 9px 14px; text-align: right; font-weight: 700; font-family: monospace; color: #166534; font-size: 14px;">${money(rcpt.amount, currencySymbol)}</td>
        </tr>
        <tr style="background: ${remainingDue > 0 ? '#fff8f8' : '#f2f9f6'};">
          <td style="padding: 9px 14px; color: ${remainingDue > 0 ? '#991b1b' : '#166534'}; font-weight: 700;">Remaining Due Balance:</td>
          <td style="padding: 9px 14px; text-align: right; font-weight: 800; font-family: monospace; color: ${remainingDue > 0 ? '#991b1b' : '#166534'}; font-size: 14px;">
            ${money(remainingDue, currencySymbol)} ${remainingDue === 0 ? '(Fully Paid)' : ''}
          </td>
        </tr>
      </table>
    </div>
  ` : ''

  const content = `
    <div class="doc-title" style="font-size: 20px; font-weight: 800; text-align: center; color: #0A0F1C; letter-spacing: 1px; margin-top: 10px;">MONEY RECEIPT</div>
    <div style="text-align: center; color: #777; font-size: 11px; margin-bottom: 18px;">Official Payment Acknowledgement</div>

    <div class="doc-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 18px; font-size: 12px;">
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Receipt No:</span> <span class="doc-meta-value" style="font-weight: 700; font-family: monospace;">${escapeHtml(rcpt.id)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Receipt Date:</span> <span class="doc-meta-value" style="font-weight: 600;">${formatDate(rcpt.date)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Received From:</span> <span class="doc-meta-value" style="font-weight: 700;">${escapeHtml(rcpt.customers?.name || '—')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Customer Contact:</span> <span class="doc-meta-value" style="font-family: monospace;">${escapeHtml(rcpt.customers?.mobile || '—')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Linked Invoice:</span> <span class="doc-meta-value" style="font-family: monospace; font-weight: 600;">${rcpt.invoice_id ? escapeHtml(rcpt.invoice_id) : 'General Advance / Deposit'}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label" style="color: #666; font-weight: 600;">Payment Note:</span> <span class="doc-meta-value">${escapeHtml(rcpt.note || 'Cash / Electronic Transfer')}</span></div>
    </div>

    ${balanceBreakdownHtml}

    <div style="margin: 18px 0; padding: 18px; background: #fdfaf2; border: 2px solid #C9A24B; border-radius: 8px; text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 4px;">Total Amount Received</div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 800; color: #0A0F1C;">
        ${money(rcpt.amount, currencySymbol)}
      </div>
      <div style="font-size: 11px; color: #888; margin-top: 6px; font-style: italic;">
        Thank you for choosing Tour Guidance BD.
      </div>
    </div>

    ${signatureHtml}
  `

  return buildLetterheadDoc({
    title: `Money-Receipt-${rcpt.id}`,
    content,
    company: settings?.company
  })
}

function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
function PrintIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
function DownloadIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
