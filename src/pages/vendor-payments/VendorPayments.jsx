import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { useSettings } from '../../contexts/SettingsContext'
import { generateId, uid } from '../../utils/idGenerator'
import { money } from '../../utils/money'
import { formatDate, today } from '../../utils/dateHelpers'
import { printHtml, downloadHtml, buildLetterheadDoc, escapeHtml } from '../../utils/printService'

export default function VendorPayments() {
  const [tab, setTab] = useState('payments') // 'payments' | 'vendors'
  const [vendors, setVendors] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Payment form state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    vendor_id: '',
    amount: '',
    date: today(),
    note: ''
  })
  const [savingPayment, setSavingPayment] = useState(false)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState(null)
  const [deletingPayment, setDeletingPayment] = useState(false)

  // Vendor form state
  const [vendorModalOpen, setVendorModalOpen] = useState(false)
  const [editingVendorId, setEditingVendorId] = useState(null)
  const [vendorForm, setVendorForm] = useState({
    name: '',
    phone: '',
    address: ''
  })
  const [savingVendor, setSavingVendor] = useState(false)
  const [deleteVendorTarget, setDeleteVendorTarget] = useState(null)
  const [deletingVendor, setDeletingVendor] = useState(false)

  const { toasts, success, error: toastError, dismiss } = useToast()
  const { settings, currencySymbol, idSettings } = useSettings()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [vRes, pRes] = await Promise.all([
      supabase.from('vendors').select('*').order('name'),
      supabase.from('vendor_payments').select('*, vendors(id, name, phone)').order('date', { ascending: false })
    ])

    if (vRes.error) toastError('Error loading vendors: ' + vRes.error.message)
    else setVendors(vRes.data || [])

    if (pRes.error) toastError('Error loading payments: ' + pRes.error.message)
    else setPayments(pRes.data || [])

    setLoading(false)
  }, [toastError])

  useEffect(() => {
    loadData()
  }, [loadData])

  // --- Payment Actions ---
  const openCreatePayment = () => {
    setPaymentForm({
      vendor_id: vendors[0]?.id || '',
      amount: '',
      date: today(),
      note: ''
    })
    setEditingPaymentId(null)
    setPaymentModalOpen(true)
  }

  const openEditPayment = (p) => {
    setPaymentForm({
      vendor_id: p.vendor_id || '',
      amount: p.amount || '',
      date: p.date || today(),
      note: p.note || ''
    })
    setEditingPaymentId(p.id)
    setPaymentModalOpen(true)
  }

  const handleSavePayment = async (e) => {
    e.preventDefault()
    if (!paymentForm.vendor_id) {
      toastError('Please select a vendor')
      return
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toastError('Amount must be greater than 0')
      return
    }

    setSavingPayment(true)
    try {
      const payload = {
        vendor_id: paymentForm.vendor_id,
        amount: parseFloat(paymentForm.amount),
        date: paymentForm.date,
        note: paymentForm.note || null
      }

      if (editingPaymentId) {
        const { error } = await supabase.from('vendor_payments').update(payload).eq('id', editingPaymentId)
        if (error) throw error
        success('Vendor payment updated')
      } else {
        const { error } = await supabase.from('vendor_payments').insert({ ...payload, id: uid() })
        if (error) throw error
        success('Vendor payment recorded')
      }

      setPaymentModalOpen(false)
      loadData()
    } catch (err) {
      toastError('Save failed: ' + err.message)
    } finally {
      setSavingPayment(false)
    }
  }

  const handleDeletePayment = async () => {
    setDeletingPayment(true)
    try {
      const { error } = await supabase.from('vendor_payments').delete().eq('id', deletePaymentTarget.id)
      if (error) throw error
      success('Payment record deleted')
      setDeletePaymentTarget(null)
      loadData()
    } catch (err) {
      toastError('Delete failed: ' + err.message)
    } finally {
      setDeletingPayment(false)
    }
  }

  // --- Vendor Actions ---
  const openCreateVendor = () => {
    setVendorForm({ name: '', phone: '', address: '' })
    setEditingVendorId(null)
    setVendorModalOpen(true)
  }

  const openEditVendor = (v) => {
    setVendorForm({ name: v.name, phone: v.phone || '', address: v.address || '' })
    setEditingVendorId(v.id)
    setVendorModalOpen(true)
  }

  const handleSaveVendor = async (e) => {
    e.preventDefault()
    if (!vendorForm.name.trim()) {
      toastError('Vendor name is required')
      return
    }

    setSavingVendor(true)
    try {
      if (editingVendorId) {
        const { error } = await supabase.from('vendors').update(vendorForm).eq('id', editingVendorId)
        if (error) throw error
        success('Vendor updated')
      } else {
        const idConfig = settings?.idSettings?.vendor || idSettings?.vendor
        const newId = await generateId('vendor', 'vendors', idConfig)
        const { error } = await supabase.from('vendors').insert({ ...vendorForm, id: newId })
        if (error) throw error
        success(`Vendor ${newId} created`)
      }

      setVendorModalOpen(false)
      loadData()
    } catch (err) {
      toastError('Save failed: ' + err.message)
    } finally {
      setSavingVendor(false)
    }
  }

  const handleDeleteVendor = async () => {
    setDeletingVendor(true)
    try {
      const { error } = await supabase.from('vendors').delete().eq('id', deleteVendorTarget.id)
      if (error) throw error
      success('Vendor deleted')
      setDeleteVendorTarget(null)
      loadData()
    } catch (err) {
      toastError('Delete failed: ' + err.message)
    } finally {
      setDeletingVendor(false)
    }
  }

  // --- Print single voucher ---
  const handlePrintSingle = (p) => {
    const html = buildSingleVoucherHtml(p, settings, currencySymbol)
    printHtml(html, `Vendor-Payment-${p.id}`)
  }

  // --- Print full sheet ---
  const handlePrintFullSheet = () => {
    const html = buildFullPaymentSheetHtml(payments, settings, currencySymbol)
    printHtml(html, `Full-Vendor-Payment-Sheet`)
  }

  const handleDownloadFullSheet = () => {
    const html = buildFullPaymentSheetHtml(payments, settings, currencySymbol)
    downloadHtml(html, `Full-Vendor-Payment-Sheet-${today()}`)
  }

  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

  const filteredPayments = payments.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (p.vendors?.name || '').toLowerCase().includes(s) ||
      (p.vendors?.phone || '').includes(s) ||
      (p.note || '').toLowerCase().includes(s)
    )
  })

  const filteredVendors = vendors.filter(v => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (v.id || '').toLowerCase().includes(s) ||
      (v.name || '').toLowerCase().includes(s) ||
      (v.phone || '').includes(s) ||
      (v.address || '').toLowerCase().includes(s)
    )
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Payments</h1>
          <p className="page-subtitle">Manage hotel, transport, and tour supply vendor accounts & disbursements</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tab === 'payments' ? (
            <>
              <button className="btn btn-teal" onClick={handlePrintFullSheet} disabled={payments.length === 0}>
                <PrintIcon /> Print Payment Sheet
              </button>
              <button className="btn btn-secondary" onClick={handleDownloadFullSheet} disabled={payments.length === 0}>
                <DownloadIcon /> Download Full Sheet
              </button>
              <button className="btn btn-primary" onClick={openCreatePayment} disabled={vendors.length === 0} id="new-payment-btn">
                <PlusIcon /> Pay Vendor
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={openCreateVendor} id="new-vendor-btn">
              <PlusIcon /> Add New Vendor
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <button className={`tab ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>
            Payment Transactions ({payments.length})
          </button>
          <button className={`tab ${tab === 'vendors' ? 'active' : ''}`} onClick={() => setTab('vendors')}>
            Vendor Directory ({vendors.length})
          </button>
        </div>

        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input
              className="form-input search-input"
              placeholder={tab === 'payments' ? 'Search payments by vendor, phone, note...' : 'Search vendors by name, phone, address, ID...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {tab === 'payments' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Disbursed:</span>
              <span className="mono" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1rem' }}>
                {money(totalPaid, currencySymbol)}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <LoadingSpinner message="Loading vendor records..." />
        ) : tab === 'payments' ? (
          filteredPayments.length === 0 ? (
            <EmptyState
              icon="💳"
              title="No vendor payments"
              description={vendors.length === 0 ? "You need to add a vendor in the 'Vendor Directory' tab first." : "No payments have been recorded yet."}
              action={vendors.length > 0 ? <button className="btn btn-primary" onClick={openCreatePayment}>Record First Payment</button> : null}
            />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendor Name</th>
                    <th>Phone</th>
                    <th className="text-right">Amount Paid</th>
                    <th>Purpose / Note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(p => (
                    <tr key={p.id}>
                      <td>{formatDate(p.date)}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.vendors?.name || '—'}</td>
                      <td className="mono">{p.vendors?.phone || '—'}</td>
                      <td className="mono text-right" style={{ color: 'var(--gold)', fontWeight: 600 }}>
                        {money(p.amount, currencySymbol)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 220 }} className="truncate" title={p.note || ''}>
                        {p.note || '—'}
                      </td>
                      <td>
                        <div className="actions-col">
                          <button className="btn btn-teal btn-sm btn-icon" onClick={() => handlePrintSingle(p)} title="Print Voucher">
                            <PrintIcon />
                          </button>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEditPayment(p)} title="Edit">
                            <EditIcon />
                          </button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletePaymentTarget(p)} title="Delete">
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="table-grand-total">
                    <td colSpan="3">GRAND TOTAL (All Vendor Payments)</td>
                    <td className="mono text-right">{money(totalPaid, currencySymbol)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredVendors.length === 0 ? (
            <EmptyState
              icon="🏢"
              title="No vendors found"
              description="Add hotels, transport suppliers, cruise operators, and guides."
              action={<button className="btn btn-primary" onClick={openCreateVendor}>Add Vendor</button>}
            />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendor ID</th>
                    <th>Company / Vendor Name</th>
                    <th>Phone</th>
                    <th>Address / Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map(v => (
                    <tr key={v.id}>
                      <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{v.id}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v.name}</td>
                      <td className="mono">{v.phone || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{v.address || '—'}</td>
                      <td>
                        <div className="actions-col">
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEditVendor(v)} title="Edit">
                            <EditIcon />
                          </button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteVendorTarget(v)} title="Delete">
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Payment Form Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={editingPaymentId ? 'Edit Vendor Payment' : 'Record Vendor Payment'}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPaymentModalOpen(false)} disabled={savingPayment}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSavePayment} disabled={savingPayment}>
              {savingPayment ? 'Saving...' : 'Save Payment'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSavePayment}>
          <div className="form-group">
            <label className="form-label required">Vendor</label>
            <select
              className="form-select"
              value={paymentForm.vendor_id}
              onChange={e => setPaymentForm(f => ({ ...f, vendor_id: e.target.value }))}
              required
            >
              <option value="">Select Vendor...</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.phone ? `(${v.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label required">Payment Date</label>
            <input
              type="date"
              className="form-input"
              value={paymentForm.date}
              onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label required">Amount ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              placeholder="0.00"
              value={paymentForm.amount}
              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Purpose / Notes</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Hotel advance booking for Cox's Bazar tour group"
              value={paymentForm.note}
              onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))}
              rows={3}
            />
          </div>
        </form>
      </Modal>

      {/* Vendor Master Form Modal */}
      <Modal
        isOpen={vendorModalOpen}
        onClose={() => setVendorModalOpen(false)}
        title={editingVendorId ? `Edit Vendor — ${editingVendorId}` : 'Add New Vendor'}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setVendorModalOpen(false)} disabled={savingVendor}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveVendor} disabled={savingVendor}>
              {savingVendor ? 'Saving...' : 'Save Vendor'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveVendor}>
          <div className="form-group">
            <label className="form-label required">Vendor / Supplier Name</label>
            <input
              className="form-input"
              placeholder="e.g. Hotel Sea Palace, Green Line Paribahan"
              value={vendorForm.name}
              onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              className="form-input"
              placeholder="e.g. 01700000000"
              value={vendorForm.phone}
              onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Address / Office Location</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Kolatoli Beach Road, Cox's Bazar"
              value={vendorForm.address}
              onChange={e => setVendorForm(f => ({ ...f, address: e.target.value }))}
              rows={2}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Payment Confirm */}
      <ConfirmDialog
        isOpen={!!deletePaymentTarget}
        onClose={() => setDeletePaymentTarget(null)}
        onConfirm={handleDeletePayment}
        loading={deletingPayment}
        title="Delete Payment"
        message={`Delete payment of ${money(deletePaymentTarget?.amount || 0, currencySymbol)} to ${deletePaymentTarget?.vendors?.name}?`}
      />

      {/* Delete Vendor Confirm */}
      <ConfirmDialog
        isOpen={!!deleteVendorTarget}
        onClose={() => setDeleteVendorTarget(null)}
        onConfirm={handleDeleteVendor}
        loading={deletingVendor}
        title="Delete Vendor"
        message={`Delete vendor "${deleteVendorTarget?.name}"? Make sure there are no remaining payment records for this vendor.`}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function buildSingleVoucherHtml(p, settings, currencySymbol) {
  const content = `
    <div class="doc-title">VENDOR PAYMENT VOUCHER</div>
    <div style="text-align: center; color: #666; font-size: 11px; margin-bottom: 16px;">Disbursement & Supplier Remittance</div>

    <div class="doc-meta">
      <div class="doc-meta-row"><span class="doc-meta-label">Payment Date:</span><span class="doc-meta-value">${formatDate(p.date)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Paid To (Vendor):</span><span class="doc-meta-value">${escapeHtml(p.vendors?.name || '—')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Vendor Phone:</span><span class="doc-meta-value">${escapeHtml(p.vendors?.phone || '—')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Payment Purpose:</span><span class="doc-meta-value">${escapeHtml(p.note || 'Service Disbursement')}</span></div>
    </div>

    <div style="margin: 24px 0; padding: 20px; background: #fdfaf2; border: 2px solid #C9A24B; border-radius: 8px; text-align: center;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 4px;">Total Amount Disbursed</div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; color: #0A0F1C;">
        ${money(p.amount, currencySymbol)}
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-top: 40px;">
      <div style="text-align: center; width: 160px;">
        <div style="border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555;">Receiver's Signature</div>
      </div>
      <div style="text-align: center; width: 160px;">
        <div style="border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555;">Authorized Signature</div>
      </div>
    </div>
  `

  return buildLetterheadDoc({
    title: `Vendor-Payment-${p.id}`,
    content,
    company: settings?.company
  })
}

function buildFullPaymentSheetHtml(payments, settings, currencySymbol) {
  const total = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

  const content = `
    <div class="doc-title">FULL VENDOR PAYMENT STATEMENT</div>
    <div style="text-align: center; color: #666; font-size: 11px; margin-bottom: 16px;">Comprehensive disbursement record across all tour suppliers</div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Payment Date</th>
          <th>Vendor Name</th>
          <th>Contact Phone</th>
          <th>Purpose / Remarks</th>
          <th class="amount-col">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${payments.map((p, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${formatDate(p.date)}</td>
            <td><b>${escapeHtml(p.vendors?.name || '—')}</b></td>
            <td>${escapeHtml(p.vendors?.phone || '—')}</td>
            <td>${escapeHtml(p.note || '—')}</td>
            <td class="amount-col">${money(p.amount, currencySymbol)}</td>
          </tr>
        `).join('')}
        <tr class="grand-total-row">
          <td colspan="5">GRAND TOTAL DISBURSED</td>
          <td class="amount-col">${money(total, currencySymbol)}</td>
        </tr>
      </tbody>
    </table>

    <div style="display: flex; justify-content: flex-end; margin-top: 30px;">
      <div style="text-align: center; width: 180px;">
        <div style="border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555;">Accounts Department</div>
      </div>
    </div>
  `

  return buildLetterheadDoc({
    title: `Full-Vendor-Payment-Sheet`,
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
