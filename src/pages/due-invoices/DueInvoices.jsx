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
import { formatDate } from '../../utils/dateHelpers'
import { invoiceReceived } from '../../utils/calculations'
import { generateId } from '../../utils/idGenerator'
import { parseReceiptNote } from '../../utils/printService'

export default function DueInvoices() {
  const [invoices, setInvoices] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [collectTarget, setCollectTarget] = useState(null)
  const [viewInvoice, setViewInvoice] = useState(null)
  const { toasts, dismiss, error: toastError, success } = useToast()
  const { settings, currencySymbol } = useSettings()

  const load = useCallback(async () => {
    setLoading(true)
    const [invRes, rcptRes, empRes, setRes] = await Promise.all([
      supabase.from('invoices').select('*, customers(*)').order('created_at', { ascending: false }),
      supabase.from('receipts').select('id, invoice_id, amount, date, note'),
      supabase.from('employees').select('id, name'),
      supabase.from('settings').select('*').eq('id', 1).single()
    ])

    if (invRes.error) {
      toastError('Failed to load due invoices: ' + invRes.error.message)
    } else {
      const allReceipts = rcptRes.data || []
      const allEmployees = empRes.data || []

      const invoicesWithData = (invRes.data || []).map(inv => {
        const invReceipts = allReceipts.filter(r => r.invoice_id === inv.id)
        const emp = allEmployees.find(e => e.id === inv.sales_by_id || e.id === inv.sales_by)
        return {
          ...inv,
          receipts: invReceipts,
          employees: emp ? { name: emp.name } : null,
          employee_name: emp?.name || '—'
        }
      })

      // Filter client-side to invoices with due > 0
      const due = invoicesWithData.filter(inv => {
        const received = invoiceReceived(inv.receipts || [])
        const due = (parseFloat(inv.grand_total) || 0) - received
        return due > 0
      })
      setInvoices(due)
    }

    const accs = setRes.data?.data?.accountsData?.accounts || []
    setAccounts(accs)

    setLoading(false)
  }, [toastError])

  useEffect(() => { load() }, [load])

  const filtered = invoices.filter(inv => {
    if (!search) return true
    const s = search.toLowerCase()
    return inv.id?.toLowerCase().includes(s) ||
      inv.customers?.name?.toLowerCase().includes(s) ||
      inv.customers?.mobile?.includes(s)
  })

  const totalDue = filtered.reduce((sum, inv) => {
    const received = invoiceReceived(inv.receipts || [])
    return sum + Math.max(0, (parseFloat(inv.grand_total) || 0) - received)
  }, 0)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Due Invoices</h1>
          <p className="page-subtitle">Track and collect all outstanding customer balances</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi-card orange" style={{ padding: '14px 18px' }}>
          <div className="kpi-label">Invoices with Due</div>
          <div className="kpi-value orange" style={{ fontSize: '1.4rem' }}>{filtered.length}</div>
          <div className="kpi-sub">Pending settlement</div>
        </div>
        <div className="kpi-card red" style={{ padding: '14px 18px' }}>
          <div className="kpi-label">Total Outstanding Due</div>
          <div className="kpi-value red" style={{ fontSize: '1.4rem' }}>{money(totalDue, currencySymbol)}</div>
          <div className="kpi-sub">Total uncollected revenue</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input className="form-input search-input" placeholder="Search by invoice ID, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState icon="✅" title="No outstanding invoices" description={search ? 'No invoices match your search.' : 'All invoices are fully paid!'} />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Invoice Date</th><th>Travel Date</th>
                  <th>Customer</th><th>Phone</th>
                  <th className="text-right">Total</th><th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th>Sales By</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const received = invoiceReceived(inv.receipts || [])
                  const due = (parseFloat(inv.grand_total) || 0) - received
                  return (
                    <tr key={inv.id}>
                      <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{inv.id}</td>
                      <td>{formatDate(inv.date || inv.invoice_date)}</td>
                      <td style={{ color: 'var(--teal)' }}>{formatDate(inv.travel_date)}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inv.customers?.name || '—'}</td>
                      <td className="mono">{inv.customers?.mobile || '—'}</td>
                      <td className="mono text-right">{money(inv.grand_total, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--teal)' }}>{money(received, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: 700 }}>{money(due, currencySymbol)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{inv.employees?.name || '—'}</td>
                      <td><StatusPill grandTotal={inv.grand_total} received={received} /></td>
                      <td>
                        <div className="actions-col">
                          <button className="btn btn-ghost btn-sm" onClick={() => setViewInvoice(inv)} title="View Invoice">
                            View
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => setCollectTarget({ inv, due, received })} id={`collect-${inv.id}`}>
                            Collect Due
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

      {collectTarget && (
        <CollectDueModal
          inv={collectTarget.inv}
          dueAmount={collectTarget.due}
          accounts={accounts}
          onClose={() => { setCollectTarget(null); load() }}
          currencySymbol={currencySymbol}
        />
      )}

      {/* View Invoice Modal */}
      <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Invoice ${viewInvoice?.id}`} size="lg">
        {viewInvoice && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 16 }}>
              {[
                ['Invoice ID', viewInvoice.id], ['Invoice Date', formatDate(viewInvoice.date || viewInvoice.invoice_date)],
                ['Travel Date', formatDate(viewInvoice.travel_date) + ' ✈'],
                ['Customer', viewInvoice.customers?.name || '—'],
                ['Phone', viewInvoice.customers?.mobile || '—'],
                ['Sales By', viewInvoice.employees?.name || '—'],
                ['No. of Travelers', viewInvoice.travelers || viewInvoice.num_travelers || 1],
              ].map(([label, val]) => (
                <div key={label} style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>

            <div className="table-wrapper" style={{ marginBottom: 14 }}>
              <table className="data-table">
                <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Subtotal</th></tr></thead>
                <tbody>
                  {(viewInvoice.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.name}</td>
                      <td className="text-right mono">{it.qty || 1}</td>
                      <td className="text-right mono">{money(it.price, currencySymbol)}</td>
                      <td className="text-right mono">{money((it.qty || 1) * (it.price || 0), currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payments History Breakdown */}
            {(viewInvoice.receipts || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>
                  💳 Payments Recorded On This Invoice
                </div>
                <div style={{ border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                  {viewInvoice.receipts.map(r => {
                    const { paymentMethod, accountName, cleanNote } = parseReceiptNote(r.note)
                    return (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--card-border)', fontSize: '0.82rem', background: 'rgba(255,255,255,0.01)' }}>
                        <div>
                          <span className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{r.id}</span> &middot; {formatDate(r.date)} &middot;
                          <span className="pill pill-paid" style={{ marginLeft: 6, fontSize: '0.72rem' }}>💳 {paymentMethod}</span>
                          <span className="pill pill-gold" style={{ marginLeft: 4, fontSize: '0.72rem' }}>📥 {accountName}</span>
                          {cleanNote && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({cleanNote})</span>}
                        </div>
                        <span className="mono" style={{ color: 'var(--teal)', fontWeight: 700 }}>{money(r.amount, currencySymbol)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total: <b>{money(viewInvoice.grand_total, currencySymbol)}</b></span>
                <span style={{ fontSize: '0.8rem', color: 'var(--teal)', marginLeft: 14 }}>Paid: <b>{money(invoiceReceived(viewInvoice.receipts || []), currencySymbol)}</b></span>
                <span style={{ fontSize: '0.8rem', color: 'var(--red)', marginLeft: 14 }}>Due: <b>{money((viewInvoice.grand_total || 0) - invoiceReceived(viewInvoice.receipts || []), currencySymbol)}</b></span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { const inv = viewInvoice; const rec = invoiceReceived(inv.receipts || []); setViewInvoice(null); setCollectTarget({ inv, due: (inv.grand_total || 0) - rec, received: rec }) }}>
                Collect Due
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function CollectDueModal({ inv, dueAmount, accounts = [], onClose, currencySymbol }) {
  const defaultAcc = accounts[0]?.name || 'Main Office Cash Vault'
  const [amount, setAmount] = useState(dueAmount)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [accountName, setAccountName] = useState(defaultAcc)
  const [customNote, setCustomNote] = useState('')
  const [saving, setSaving] = useState(false)
  const { success, error: toastError, toasts, dismiss } = useToast()
  const { settings, idSettings } = useSettings()

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { toastError('Amount must be greater than 0'); return }
    if (!accountName) { toastError('Please select destination account'); return }

    setSaving(true)
    try {
      const rcptConfig = settings?.idSettings?.receipt || idSettings?.receipt
      const rcptId = await generateId('receipt', 'receipts', rcptConfig)
      const formattedNote = `[Paid Via: ${paymentMethod || 'Cash'}] [Received To: ${accountName || 'Main Office Cash Vault'}] ${customNote || 'Due collection settlement for ' + inv.id}`

      const { error } = await supabase.from('receipts').insert({
        id: rcptId,
        customer_id: inv.customer_id,
        invoice_id: inv.id,
        amount: parseFloat(amount),
        date,
        note: formattedNote,
      })
      if (error) throw error
      success(`Payment ${rcptId} of ${money(amount, currencySymbol)} collected via ${paymentMethod} into ${accountName}`)
      onClose()
    } catch (err) {
      toastError('Failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title={`Collect Due — ${inv.id}`} size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button>
          </>
        }
      >
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--red-dim)', border: '1px solid rgba(239,100,97,0.3)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Customer</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>{inv.customers?.name || '—'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Invoice: {inv.id}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Remaining Due</div>
              <div style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 800 }}>{money(dueAmount, currencySymbol)}</div>
            </div>
          </div>
        </div>

        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label required">Amount to Collect ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              style={{ fontWeight: 700, color: 'var(--teal)', fontSize: '1rem' }}
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label required">Collection Date</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label required">Paid Via (Payment Method)</label>
            <select
              className="form-select"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              required
            >
              <option value="Cash">💵 Cash</option>
              <option value="Bank Transfer">🏛️ Bank Transfer</option>
              <option value="bKash">📱 bKash</option>
              <option value="Nagad">📱 Nagad</option>
              <option value="Rocket">📱 Rocket</option>
              <option value="Credit Card">💳 Credit Card</option>
              <option value="Cheque">📜 Cheque</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label required">Received Into Account / Wallet</label>
            <select
              className="form-select"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              required
            >
              {accounts.length > 0 ? (
                accounts.map(a => (
                  <option key={a.id} value={a.name}>
                    {a.type === 'bank' ? '🏛️ Bank: ' : a.type === 'cash' ? '💵 Cash: ' : '📱 Mobile: '}
                    {a.name} ({money(a.currentBalance, currencySymbol)})
                  </option>
                ))
              ) : (
                <>
                  <option value="Main Office Cash Vault">💵 Main Office Cash Vault</option>
                  <option value="Islami Bank Bangladesh Ltd">🏛️ Islami Bank Bangladesh Ltd</option>
                  <option value="The City Bank Limited">🏛️ The City Bank Limited</option>
                  <option value="bKash Merchant Account">📱 bKash Merchant Account</option>
                  <option value="Nagad Business Account">📱 Nagad Business Account</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Note / Reference</label>
          <input
            className="form-input"
            placeholder="e.g. TrxID: 9M87B2 or Cheque #123456"
            value={customNote}
            onChange={e => setCustomNote(e.target.value)}
          />
        </div>
      </Modal>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
