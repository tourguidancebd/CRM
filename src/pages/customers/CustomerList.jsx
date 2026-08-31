import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { ActivePill } from '../../components/common/StatusPill'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { generateId } from '../../utils/idGenerator'
import { formatDate, today } from '../../utils/dateHelpers'
import { escapeHtml } from '../../utils/printService'

const INIT_FORM = {
  name: '', mobile: '', alt_mobile: '', email: '', gender: '',
  dob: '', nationality: 'Bangladeshi', nid_passport: '', address: '', city: '',
  country: 'Bangladesh', customer_type: 'Individual', company_name: '',
  emergency_name: '', emergency_phone: '', preferred_destination: '',
  preferred_travel_type: '', source: '', notes: '', status: 'Active',
  registration_date: today(),
}

export default function CustomerList() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(INIT_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [viewCustomer, setViewCustomer] = useState(null)

  const { toasts, success, error: toastError, dismiss } = useToast()
  const { can, isAgent } = useAuth()
  const { settings, idSettings } = useSettings()

  const canEdit = can('customers') && !isAgent

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toastError('Failed to load customers: ' + error.message)
    else setCustomers(data || [])
    setLoading(false)
  }, [toastError])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm({ ...INIT_FORM, registration_date: today() })
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (c) => {
    setForm({
      name: c.name || '', mobile: c.mobile || '', alt_mobile: c.alt_mobile || '',
      email: c.email || '', gender: c.gender || '', dob: c.dob || '',
      nationality: c.nationality || 'Bangladeshi', nid_passport: c.nid_passport || '',
      address: c.address || '', city: c.city || '', country: c.country || 'Bangladesh',
      customer_type: c.customer_type || 'Individual', company_name: c.company_name || '',
      emergency_name: c.emergency_name || '', emergency_phone: c.emergency_phone || '',
      preferred_destination: c.preferred_destination || '',
      preferred_travel_type: c.preferred_travel_type || '',
      source: c.source || '', notes: c.notes || '', status: c.status || 'Active',
      registration_date: c.registration_date || today(),
    })
    setEditingId(c.id)
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toastError('Customer name is required'); return }
    if (!form.mobile.trim()) { toastError('Mobile number is required'); return }
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('customers').update(form).eq('id', editingId)
        if (error) throw error
        success('Customer updated successfully')
      } else {
        const idConfig = settings?.idSettings?.customer || idSettings?.customer
        const newId = await generateId('customer', 'customers', idConfig)
        const { error } = await supabase.from('customers').insert({ ...form, id: newId })
        if (error) throw error
        success(`Customer ${newId} created`)
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
      const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id)
      if (error) throw error
      success('Customer deleted')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toastError('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = customers.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.id?.toLowerCase().includes(search.toLowerCase())
  )

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} total customers</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={openCreate} id="add-customer-btn">
            <PlusIcon /> Add Customer
          </button>
        )}
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input
              className="form-input search-input"
              placeholder="Search by name, mobile, email, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="customer-search"
            />
          </div>
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState icon="👥" title="No customers found"
            description={search ? 'No customers match your search.' : 'Add your first customer to get started.'}
            action={canEdit && !search ? <button className="btn btn-primary" onClick={openCreate}>Add Customer</button> : null}
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Mobile</th><th>Email</th>
                  <th>Type</th><th>Source</th><th>Status</th><th>Reg. Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="mono" style={{ color: 'var(--gold)' }}>{c.id}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{escapeHtml(c.name)}</td>
                    <td className="mono">{c.mobile}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.email || '—'}</td>
                    <td><span className="pill pill-gold">{c.customer_type || 'Individual'}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.source || '—'}</td>
                    <td><ActivePill active={c.status === 'Active'} /></td>
                    <td>{formatDate(c.registration_date)}</td>
                    <td>
                      <div className="actions-col">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewCustomer(c)} title="View details">
                          <EyeIcon />
                        </button>
                        {canEdit && (
                          <>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(c)} title="Edit">
                              <EditIcon />
                            </button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(c)} title="Delete">
                              <TrashIcon />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Form Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Customer' : 'Add New Customer'}
        size="xl"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-customer-btn">
              {saving ? 'Saving...' : (editingId ? 'Update Customer' : 'Create Customer')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label required" htmlFor="c-name">Full Name</label>
              <input id="c-name" className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="c-mobile">Mobile</label>
              <input id="c-mobile" className="form-input" value={form.mobile} onChange={e => set('mobile', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-altmobile">Alt Mobile</label>
              <input id="c-altmobile" className="form-input" value={form.alt_mobile} onChange={e => set('alt_mobile', e.target.value)} />
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="c-email">Email</label>
              <input id="c-email" type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-gender">Gender</label>
              <select id="c-gender" className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Select</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-dob">Date of Birth</label>
              <input id="c-dob" type="date" className="form-input" value={form.dob} onChange={e => set('dob', e.target.value)} />
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="c-type">Customer Type</label>
              <select id="c-type" className="form-select" value={form.customer_type} onChange={e => set('customer_type', e.target.value)}>
                <option>Individual</option><option>Corporate</option><option>Group</option><option>VIP</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-company">Company/Organization</label>
              <input id="c-company" className="form-input" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-nationality">Nationality</label>
              <input id="c-nationality" className="form-input" value={form.nationality} onChange={e => set('nationality', e.target.value)} />
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="c-nid">NID / Passport No.</label>
              <input id="c-nid" className="form-input" value={form.nid_passport} onChange={e => set('nid_passport', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-city">City</label>
              <input id="c-city" className="form-input" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-country">Country</label>
              <input id="c-country" className="form-input" value={form.country} onChange={e => set('country', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="c-address">Address</label>
            <input id="c-address" className="form-input" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>

          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="c-ename">Emergency Contact Name</label>
              <input id="c-ename" className="form-input" value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-ephone">Emergency Phone</label>
              <input id="c-ephone" className="form-input" value={form.emergency_phone} onChange={e => set('emergency_phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-source">Customer Source</label>
              <select id="c-source" className="form-select" value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="">Select</option>
                {['Facebook','Google','Referral','Walk-in','Website','Repeat Customer','Agent','Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="c-dest">Preferred Destination</label>
              <input id="c-dest" className="form-input" value={form.preferred_destination} onChange={e => set('preferred_destination', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-travel-type">Preferred Travel Type</label>
              <select id="c-travel-type" className="form-select" value={form.preferred_travel_type} onChange={e => set('preferred_travel_type', e.target.value)}>
                <option value="">Select</option>
                {['Leisure','Business','Family','Adventure','Religious/Pilgrimage','Honeymoon','Group Tour','Other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="c-status">Status</label>
              <select id="c-status" className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-regdate">Registration Date</label>
              <input id="c-regdate" type="date" className="form-input" value={form.registration_date} onChange={e => set('registration_date', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="c-notes">Notes</label>
            <textarea id="c-notes" className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>
        </form>
      </Modal>

      {/* View Customer Modal */}
      <Modal isOpen={!!viewCustomer} onClose={() => setViewCustomer(null)} title="Customer Details" size="lg">
        {viewCustomer && <CustomerDetail customer={viewCustomer} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Customer"
        message={`Delete ${deleteTarget?.name}? This will NOT delete their invoices but will unlink the customer reference. This cannot be undone.`}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function CustomerDetail({ customer: c }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const { currencySymbol } = useSettings()

  useEffect(() => {
    supabase.from('invoices').select('*, receipts(amount)').eq('customer_id', c.id).order('created_at', { ascending: false }).then(({ data }) => {
      setInvoices(data || [])
      setLoading(false)
    })
  }, [c.id])

  const stats = customerStats(invoices, [])

  const rows = [
    ['Customer ID', c.id], ['Name', c.name], ['Mobile', c.mobile],
    ['Alt Mobile', c.alt_mobile], ['Email', c.email], ['Gender', c.gender],
    ['Date of Birth', formatDate(c.dob)], ['Nationality', c.nationality],
    ['NID/Passport', c.nid_passport], ['Customer Type', c.customer_type],
    ['Company', c.company_name], ['Address', c.address],
    ['City', c.city], ['Country', c.country],
    ['Emergency Contact', c.emergency_name], ['Emergency Phone', c.emergency_phone],
    ['Preferred Destination', c.preferred_destination],
    ['Preferred Travel Type', c.preferred_travel_type],
    ['Source', c.source], ['Status', c.status],
    ['Registration Date', formatDate(c.registration_date)], ['Notes', c.notes],
  ]

  return (
    <div>
      {/* 1. Identity & Contact Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 20 }}>
        {rows.filter(([, v]) => v).map(([label, value]) => (
          <div key={label} style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{escapeHtml(String(value))}</div>
          </div>
        ))}
      </div>

      {/* 2. Customer Aggregate Stats Strip */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card teal" style={{ padding: '12px 16px' }}>
          <div className="kpi-label" style={{ fontSize: '0.65rem' }}>Total Bookings</div>
          <div className="kpi-value teal" style={{ fontSize: '1.2rem' }}>{stats.totalBooking}</div>
        </div>
        <div className="kpi-card teal" style={{ padding: '12px 16px' }}>
          <div className="kpi-label" style={{ fontSize: '0.65rem' }}>Total Sales</div>
          <div className="kpi-value teal" style={{ fontSize: '1.2rem' }}>{money(stats.totalSales, currencySymbol)}</div>
        </div>
        <div className="kpi-card gold" style={{ padding: '12px 16px' }}>
          <div className="kpi-label" style={{ fontSize: '0.65rem' }}>Total Profit</div>
          <div className="kpi-value gold" style={{ fontSize: '1.2rem' }}>{money(stats.totalProfit, currencySymbol)}</div>
        </div>
        <div className="kpi-card teal" style={{ padding: '12px 16px' }}>
          <div className="kpi-label" style={{ fontSize: '0.65rem' }}>Total Paid</div>
          <div className="kpi-value teal" style={{ fontSize: '1.2rem' }}>{money(stats.totalPaid, currencySymbol)}</div>
        </div>
        <div className="kpi-card red" style={{ padding: '12px 16px' }}>
          <div className="kpi-label" style={{ fontSize: '0.65rem' }}>Total Due</div>
          <div className="kpi-value red" style={{ fontSize: '1.2rem' }}>{money(stats.totalDue, currencySymbol)}</div>
        </div>
      </div>

      {/* 3. Purchase & Invoice History */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
          Booking & Payment History ({invoices.length})
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0' }}>Loading history...</div>
        ) : invoices.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0' }}>No bookings created yet for this customer.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Travel Date</th>
                  <th className="text-right">Grand Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const received = (inv.receipts || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
                  const due = (parseFloat(inv.grand_total) || 0) - received
                  return (
                    <tr key={inv.id}>
                      <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{inv.id}</td>
                      <td>{formatDate(inv.date || inv.invoice_date)}</td>
                      <td style={{ color: 'var(--teal)' }}>{formatDate(inv.travel_date)}</td>
                      <td className="mono text-right">{money(inv.grand_total, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--teal)' }}>{money(received, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: due > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{money(due, currencySymbol)}</td>
                      <td><StatusPill grandTotal={inv.grand_total} received={received} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Icons
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EyeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
