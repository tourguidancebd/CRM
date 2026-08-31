import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { StatusPill } from '../../components/common/StatusPill'
import { useSettings } from '../../contexts/SettingsContext'
import { generateId } from '../../utils/idGenerator'
import { money } from '../../utils/money'
import { formatDate, today } from '../../utils/dateHelpers'
import { invoiceSubtotal, invoiceCost, invoiceNetProfit, invoiceReceived } from '../../utils/calculations'
import { printHtml, downloadHtml, buildLetterheadDoc, escapeHtml } from '../../utils/printService'

const EMPTY_LINE = () => ({ item_id: '', name: '', qty: 1, price: '', buying_price: 0 })

const INIT_FORM = {
  customer_id: '', sales_by: '', invoice_date: today(), travel_date: '',
  num_travelers: 1, discount: 0, paid_now: 0, bank_account: 'none',
  items: [EMPTY_LINE()],
}

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [employees, setEmployees] = useState([])
  const [masterItems, setMasterItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(INIT_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [viewInvoice, setViewInvoice] = useState(null)

  const { toasts, success, error: toastError, dismiss } = useToast()
  const { settings, currencySymbol, idSettings, company } = useSettings()

  const load = useCallback(async () => {
    setLoading(true)
    const [invRes, custRes, empRes, itemRes, rcptRes] = await Promise.all([
      supabase.from('invoices').select('*, customers(name, mobile)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name, mobile').order('name'),
      supabase.from('employees').select('id, name').order('name'),
      supabase.from('items').select('*').order('name'),
      supabase.from('receipts').select('id, invoice_id, amount, date, note'),
    ])

    const allReceipts = rcptRes.data || []
    if (!invRes.error) {
      const invoicesWithReceipts = (invRes.data || []).map(inv => ({
        ...inv,
        receipts: allReceipts.filter(r => r.invoice_id === inv.id)
      }))
      setInvoices(invoicesWithReceipts)
    }
    if (!custRes.error) setCustomers(custRes.data || [])
    if (!empRes.error) setEmployees(empRes.data || [])
    if (!itemRes.error) setMasterItems(itemRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = (prefillCustomer = null) => {
    setForm({ ...INIT_FORM, customer_id: prefillCustomer?.id || '', items: [EMPTY_LINE()], invoice_date: today() })
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = async (inv) => {
    // Load full invoice items
    const { data: invData } = await supabase.from('invoices').select('*').eq('id', inv.id).single()
    setForm({
      customer_id: invData.customer_id || '',
      sales_by: invData.sales_by_id || invData.sales_by || '',
      invoice_date: invData.date || invData.invoice_date || today(),
      travel_date: invData.travel_date || '',
      num_travelers: invData.travelers || invData.num_travelers || 1,
      discount: invData.discount || 0,
      paid_now: 0, // Don't re-apply past payment
      bank_account: invData.bank_choice || invData.bank_account || 'primary',
      items: (invData.items && invData.items.length > 0) ? invData.items : [EMPTY_LINE()],
    })
    setEditingId(inv.id)
    setModalOpen(true)
  }

  // Line item helpers
  const setLine = (idx, key, val) => {
    setForm(f => {
      const items = [...f.items]
      items[idx] = { ...items[idx], [key]: val }
      if (key === 'item_id' && val) {
        const master = masterItems.find(m => m.id === val || String(m.id) === val)
        if (master) {
          items[idx].name = master.name
          items[idx].price = master.selling_price || 0
          items[idx].buying_price = master.buying_price || 0
        }
      }
      return { ...f, items }
    })
  }

  const addLine = () => setForm(f => ({ ...f, items: [...f.items, EMPTY_LINE()] }))
  const removeLine = (idx) => {
    if (form.items.length === 1) return
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  const subtotal = invoiceSubtotal(form.items)
  const grandTotal = subtotal - (parseFloat(form.discount) || 0)
  const netProfit = invoiceNetProfit(form.items, form.discount)

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.customer_id) { toastError('Customer is required'); return }
    if (!form.travel_date) { toastError('Travel date is required'); return }
    if (form.items.some(i => !i.name?.trim())) { toastError('All line items must have a name'); return }

    setSaving(true)
    try {
      const payload = {
        customer_id: form.customer_id,
        sales_by_id: form.sales_by || null,
        date: form.invoice_date || today(),
        travel_date: form.travel_date,
        travelers: parseInt(form.num_travelers) || 1,
        discount: parseFloat(form.discount) || 0,
        grand_total: grandTotal,
        bank_choice: form.bank_account || 'primary',
        items: form.items.map(i => ({
          item_id: i.item_id || null,
          name: i.name,
          qty: parseFloat(i.qty) || 1,
          price: parseFloat(i.price) || 0,
          buying_price: parseFloat(i.buying_price) || 0,
        })),
      }

      if (editingId) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', editingId)
        if (error) throw error
        
        // If additional payment entered on edit
        const addPayment = parseFloat(form.paid_now) || 0
        if (addPayment > 0) {
          const rcptConfig = settings?.idSettings?.receipt || idSettings?.receipt
          const rcptId = await generateId('receipt', 'receipts', rcptConfig)
          await supabase.from('receipts').insert({
            id: rcptId,
            customer_id: form.customer_id,
            invoice_id: editingId,
            amount: addPayment,
            date: form.invoice_date || today(),
            note: 'Additional payment recorded on invoice update',
          })
        }
        success('Invoice updated' + (addPayment > 0 ? ' and payment recorded' : ''))
      } else {
        const idConfig = settings?.idSettings?.invoice || idSettings?.invoice
        const newId = await generateId('invoice', 'invoices', idConfig)
        const { error: invErr } = await supabase.from('invoices').insert({ ...payload, id: newId })
        if (invErr) throw invErr

        // Record initial payment if provided
        const paidNow = parseFloat(form.paid_now) || 0
        if (paidNow > 0) {
          const rcptConfig = settings?.idSettings?.receipt || idSettings?.receipt
          const rcptId = await generateId('receipt', 'receipts', rcptConfig)
          await supabase.from('receipts').insert({
            id: rcptId,
            customer_id: form.customer_id,
            invoice_id: newId,
            amount: paidNow,
            date: form.invoice_date || today(),
            note: 'Paid at invoice creation',
          })
        }
        success(`Invoice ${newId} created`)
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
      // Delete linked receipts first
      await supabase.from('receipts').delete().eq('invoice_id', deleteTarget.id)
      const { error } = await supabase.from('invoices').delete().eq('id', deleteTarget.id)
      if (error) throw error
      success('Invoice and linked receipts deleted')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toastError('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handlePrint = async (inv) => {
    const { data } = await supabase.from('invoices').select('*, customers(*), employees(name)').eq('id', inv.id).single()
    const { data: receipts } = await supabase.from('receipts').select('amount').eq('invoice_id', inv.id)
    if (data) {
      const html = buildInvoiceHtml(data, receipts || [], settings, currencySymbol)
      printHtml(html, `Invoice-${inv.id}`)
    }
  }

  const handleDownload = async (inv) => {
    const { data } = await supabase.from('invoices').select('*, customers(*), employees(name)').eq('id', inv.id).single()
    const { data: receipts } = await supabase.from('receipts').select('amount').eq('invoice_id', inv.id)
    if (data) {
      const html = buildInvoiceHtml(data, receipts || [], settings, currencySymbol)
      downloadHtml(html, `Invoice-${inv.id}`)
    }
  }

  const filtered = invoices.filter(inv => {
    if (!search) return true
    const s = search.toLowerCase()
    return inv.id?.toLowerCase().includes(s) ||
      inv.customers?.name?.toLowerCase().includes(s) ||
      inv.customers?.mobile?.includes(s)
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{invoices.length} total invoices</p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreate()} id="new-invoice-btn">
          <PlusIcon /> New Invoice
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input className="form-input search-input" placeholder="Search by invoice ID, customer name or phone..." value={search} onChange={e => setSearch(e.target.value)} id="invoice-search" />
          </div>
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState icon="🧾" title="No invoices" description="Create your first invoice." action={<button className="btn btn-primary" onClick={() => openCreate()}>New Invoice</button>} />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Date</th><th>Travel Date</th>
                  <th>Customer</th><th>Phone</th>
                  <th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Due</th>
                  <th>Sales By</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const received = invoiceReceived(inv.receipts || [])
                  const due = (parseFloat(inv.grand_total) || 0) - received
                  return (
                    <tr key={inv.id}>
                      <td className="mono" style={{ color: 'var(--gold)' }}>{inv.id}</td>
                      <td>{formatDate(inv.date || inv.invoice_date)}</td>
                      <td style={{ color: 'var(--teal)', fontWeight: 500 }}>{formatDate(inv.travel_date)}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inv.customers?.name || '—'}</td>
                      <td className="mono">{inv.customers?.mobile || '—'}</td>
                      <td className="mono text-right">{money(inv.grand_total, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--teal)' }}>{money(received, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: due > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{money(due, currencySymbol)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{employees.find(e => e.id === inv.sales_by_id || e.id === inv.sales_by)?.name || inv.employees?.name || '—'}</td>
                      <td><StatusPill grandTotal={inv.grand_total} received={received} /></td>
                      <td>
                        <div className="actions-col">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewInvoice(inv)} title="View"><EyeIcon /></button>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(inv)} title="Edit"><EditIcon /></button>
                          <button className="btn btn-teal btn-sm btn-icon" onClick={() => handlePrint(inv)} title="Print"><PrintIcon /></button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDownload(inv)} title="Download"><DownloadIcon /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(inv)} title="Delete"><TrashIcon /></button>
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

      {/* Invoice Form Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? `Edit Invoice ${editingId}` : 'New Invoice'} size="xl"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-invoice-btn">
              {saving ? 'Saving...' : (editingId ? 'Update Invoice' : 'Create Invoice')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          {/* Header fields */}
          <div className="form-grid form-grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label required">Customer</label>
              <select className="form-select" value={form.customer_id} onChange={e => set('customer_id', e.target.value)} required>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.mobile}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sales By (Employee)</label>
              <select className="form-select" value={form.sales_by} onChange={e => set('sales_by', e.target.value)}>
                <option value="">— None —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">No. of Travelers</label>
              <input type="number" min="1" className="form-input" value={form.num_travelers} onChange={e => set('num_travelers', e.target.value)} />
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Invoice Date</label>
              <input type="date" className="form-input" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label required" style={{ color: 'var(--gold)' }}>✈ Travel Date (Required)</label>
              <input type="date" className="form-input" style={{ borderColor: 'rgba(201,162,75,0.4)' }} value={form.travel_date} onChange={e => set('travel_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Print Bank Account</label>
              <select className="form-select" value={form.bank_account} onChange={e => set('bank_account', e.target.value)}>
                <option value="none">None</option>
                {settings?.primaryBank?.bankName && <option value="primary">Primary Bank ({settings.primaryBank.bankName})</option>}
                {settings?.secondaryBank?.bankName && <option value="secondary">Secondary Bank ({settings.secondaryBank.bankName})</option>}
              </select>
            </div>
          </div>

          <hr className="divider" />
          <div style={{ marginBottom: 8, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Line Items</div>

          <table className="line-items-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Item / Service</th>
                <th style={{ width: '15%' }}>From Catalog</th>
                <th style={{ width: '8%' }}>Qty</th>
                <th style={{ width: '15%' }}>Price ({currencySymbol})</th>
                <th style={{ width: '15%' }}>Subtotal</th>
                <th style={{ width: '12%' }}>Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((line, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                      placeholder="Item name or description"
                      value={line.name}
                      onChange={e => setLine(idx, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <select className="form-select" style={{ fontSize: '0.78rem', padding: '6px 6px' }} value={line.item_id}
                      onChange={e => setLine(idx, 'item_id', e.target.value)}>
                      <option value="">Custom</option>
                      {masterItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="number" min="1" className="form-input" style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                      value={line.qty} onChange={e => setLine(idx, 'qty', e.target.value)} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="form-input" style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                      value={line.price} onChange={e => setLine(idx, 'price', e.target.value)} />
                  </td>
                  <td className="line-item-total">{money((parseFloat(line.qty)||1)*(parseFloat(line.price)||0), currencySymbol)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {money((parseFloat(line.qty)||1)*(parseFloat(line.buying_price)||0), currencySymbol)}
                  </td>
                  <td>
                    <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeLine(idx)} disabled={form.items.length === 1}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" className="btn btn-ghost btn-sm" onClick={addLine} style={{ marginBottom: 16 }}>
            <PlusIcon /> Add Line Item
          </button>

          {/* Summary */}
          <div className="form-grid form-grid-2">
            <div>
              <div className="form-group">
                <label className="form-label">Discount ({currencySymbol})</label>
                <input type="number" step="0.01" min="0" className="form-input" value={form.discount} onChange={e => set('discount', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{editingId ? `Add Payment (${currencySymbol})` : `Paid Now (${currencySymbol})`}</label>
                <input type="number" step="0.01" min="0" className="form-input" placeholder="0.00" value={form.paid_now} onChange={e => set('paid_now', e.target.value)} />
                {editingId && <div className="form-hint">Optional: enter an amount to record an additional money receipt.</div>}
              </div>
            </div>
            <div className="invoice-summary">
              <div className="invoice-summary-row">
                <span>Subtotal</span>
                <span className="mono">{money(subtotal, currencySymbol)}</span>
              </div>
              <div className="invoice-summary-row">
                <span>Discount</span>
                <span className="mono" style={{ color: 'var(--orange)' }}>- {money(parseFloat(form.discount)||0, currencySymbol)}</span>
              </div>
              <div className="invoice-summary-row grand">
                <span>Grand Total</span>
                <span className="mono">{money(grandTotal, currencySymbol)}</span>
              </div>
              {!editingId && (
                <div className="invoice-summary-row paid">
                  <span>Paid Now</span>
                  <span className="mono">{money(parseFloat(form.paid_now)||0, currencySymbol)}</span>
                </div>
              )}
              {!editingId && (
                <div className="invoice-summary-row due">
                  <span>Due</span>
                  <span className="mono">{money(grandTotal - (parseFloat(form.paid_now)||0), currencySymbol)}</span>
                </div>
              )}
              <div className="invoice-summary-row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--card-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Net Profit</span>
                <span className="mono" style={{ color: 'var(--teal)', fontSize: '0.82rem' }}>{money(netProfit, currencySymbol)}</span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* View Invoice Modal */}
      <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Invoice ${viewInvoice?.id}`} size="lg"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-teal btn-sm" onClick={() => { handlePrint(viewInvoice); }}>Print</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { handleDownload(viewInvoice); }}>Download</button>
            <button className="btn btn-ghost" onClick={() => setViewInvoice(null)}>Close</button>
          </div>
        }
      >
        {viewInvoice && <InvoiceDetail inv={viewInvoice} invoices={invoices} customers={customers} currencySymbol={currencySymbol} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Invoice"
        message={`Delete invoice ${deleteTarget?.id}? This will also permanently delete all money receipts linked to this invoice. This CANNOT be undone.`}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function InvoiceDetail({ inv, invoices, customers, currencySymbol }) {
  const [receipts, setReceipts] = useState([])
  useEffect(() => {
    supabase.from('receipts').select('*').eq('invoice_id', inv.id).then(({ data }) => setReceipts(data || []))
  }, [inv.id])

  const received = invoiceReceived(receipts)
  const due = (parseFloat(inv.grand_total) || 0) - received
  const fullInv = invoices.find(i => i.id === inv.id) || inv

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 16 }}>
        {[
          ['Invoice ID', inv.id], ['Invoice Date', formatDate(inv.date || inv.invoice_date)],
          ['Travel Date', formatDate(inv.travel_date) + ' ✈'],
          ['Customer', inv.customers?.name || '—'],
          ['Phone', inv.customers?.mobile || '—'],
          ['Sales By', inv.employees?.name || '—'],
          ['No. of Travelers', inv.travelers || inv.num_travelers || 1],
        ].map(([label, val]) => (
          <div key={label} style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{val}</div>
          </div>
        ))}
      </div>

      {inv.items && (
        <div className="table-wrapper" style={{ marginBottom: 12 }}>
          <table className="data-table">
            <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {inv.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.name}</td>
                  <td className="text-right">{item.qty}</td>
                  <td className="mono text-right">{money(item.price, currencySymbol)}</td>
                  <td className="mono text-right">{money((item.qty||1)*(item.price||0), currencySymbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 260 }}>
          {[
            ['Subtotal', invoiceSubtotal(inv.items||[]), ''],
            ['Discount', -(parseFloat(inv.discount)||0), 'var(--orange)'],
            ['Grand Total', inv.grand_total, 'var(--gold)'],
            ['Paid', received, 'var(--teal)'],
            ['Due', due, due > 0 ? 'var(--red)' : 'var(--text-muted)'],
          ].map(([label, val, color]) => (
            <div key={label} className="invoice-summary-row" style={color ? { color } : {}}>
              <span style={{ fontWeight: label === 'Grand Total' ? 700 : 400 }}>{label}</span>
              <span className="mono">{money(val, currencySymbol)}</span>
            </div>
          ))}
        </div>
      </div>

      {receipts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Payment History</div>
          {receipts.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--card-border)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{r.id} — {formatDate(r.date)} {r.note ? `(${r.note})` : ''}</span>
              <span className="mono" style={{ color: 'var(--teal)' }}>{money(r.amount, currencySymbol)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function buildInvoiceHtml(inv, receipts, settings, currencySymbol) {
  const received = receipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const due = (parseFloat(inv.grand_total) || 0) - received
  const items = inv.items || []
  const subtotal = invoiceSubtotal(items)

  const bankChoice = inv.bank_choice || inv.bank_account || 'none'
  const bank = bankChoice === 'primary' ? settings?.primaryBank :
    bankChoice === 'secondary' ? settings?.secondaryBank : null

  const bankHtml = bank?.bankName ? `
    <div class="bank-box">
      <div class="bank-box-title">💳 Payment to Bank Account</div>
      <div class="bank-detail"><b>Bank:</b> ${escapeHtml(bank.bankName)}</div>
      <div class="bank-detail"><b>Account Name:</b> ${escapeHtml(bank.accountName)}</div>
      <div class="bank-detail"><b>Account No:</b> ${escapeHtml(bank.accountNumber)}</div>
      <div class="bank-detail"><b>Branch:</b> ${escapeHtml(bank.branchName)}</div>
      ${bank.routingNumber ? `<div class="bank-detail"><b>Routing:</b> ${escapeHtml(bank.routingNumber)}</div>` : ''}
      ${bank.otherInfo ? `<div class="bank-detail">${escapeHtml(bank.otherInfo)}</div>` : ''}
    </div>` : ''

  const signatureHtml = settings?.company?.authoritySignature ? `
    <div class="signature-section">
      <div class="signature-block">
        <img src="${escapeHtml(settings.company.authoritySignature)}" alt="Signature" class="signature-img" />
        <div class="signature-line">Authorized Signature</div>
      </div>
    </div>` : `
    <div class="signature-section">
      <div class="signature-block">
        <div style="height:60px;border-bottom:1px solid #333;width:180px;"></div>
        <div class="signature-line">Authorized Signature</div>
      </div>
    </div>`

  const content = `
    <div class="doc-title">INVOICE</div>
    <div class="travel-date-banner">✈ TRAVEL DATE: ${formatDate(inv.travel_date)}</div>
    <div class="doc-meta">
      <div class="doc-meta-row"><span class="doc-meta-label">Invoice No:</span><span class="doc-meta-value">${escapeHtml(inv.id)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Invoice Date:</span><span class="doc-meta-value">${formatDate(inv.date || inv.invoice_date)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Customer:</span><span class="doc-meta-value">${escapeHtml(inv.customers?.name || '—')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Phone:</span><span class="doc-meta-value">${escapeHtml(inv.customers?.mobile || '—')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">No. of Travelers:</span><span class="doc-meta-value">${inv.travelers || inv.num_travelers || 1}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Sales By:</span><span class="doc-meta-value">${escapeHtml(inv.employees?.name || '—')}</span></div>
    </div>

    <table>
      <thead><tr><th>#</th><th>Description</th><th class="amount-col">Qty</th><th class="amount-col">Unit Price</th><th class="amount-col">Amount</th></tr></thead>
      <tbody>
        ${items.map((item, i) => `
          <tr>
            <td>${i+1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td class="amount-col">${item.qty || 1}</td>
            <td class="amount-col">${money(item.price || 0, currencySymbol)}</td>
            <td class="amount-col">${money((item.qty||1)*(item.price||0), currencySymbol)}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="totals-row"><span>Subtotal</span><span>${money(subtotal, currencySymbol)}</span></div>
      <div class="totals-row" style="color:#e65100"><span>Discount</span><span>- ${money(inv.discount||0, currencySymbol)}</span></div>
      <div class="totals-row grand-total"><span>Grand Total</span><span>${money(inv.grand_total, currencySymbol)}</span></div>
      <div class="totals-row paid-row"><span>Amount Received</span><span>${money(received, currencySymbol)}</span></div>
      <div class="totals-row ${due > 0 ? 'due-row' : 'paid-row'}"><span>${due > 0 ? 'Balance Due' : 'Fully Paid'}</span><span>${money(due, currencySymbol)}</span></div>
    </div>

    ${bankHtml}
    ${signatureHtml}
  `

  return buildLetterheadDoc({ title: `Invoice ${inv.id}`, content, company: settings?.company })
}

// Icons
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EyeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
function PrintIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
function DownloadIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
