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

export default function DueInvoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [collectTarget, setCollectTarget] = useState(null)
  const { toasts, dismiss } = useToast()
  const { currencySymbol } = useSettings()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(name, mobile), employees(name), receipts(amount)')
      .order('invoice_date', { ascending: false })

    if (!error) {
      // Filter client-side to invoices with due > 0
      const due = (data || []).filter(inv => {
        const received = invoiceReceived(inv.receipts || [])
        const due = (parseFloat(inv.grand_total) || 0) - received
        return due > 0
      })
      setInvoices(due)
    }
    setLoading(false)
  }, [])

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
          <p className="page-subtitle">{invoices.length} invoices with outstanding balance</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Outstanding</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', color: 'var(--red)', fontWeight: 600 }}>{money(totalDue, currencySymbol)}</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input className="form-input search-input" placeholder="Search by invoice ID, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
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
                  <th>Sales By</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const received = invoiceReceived(inv.receipts || [])
                  const due = (parseFloat(inv.grand_total) || 0) - received
                  return (
                    <tr key={inv.id}>
                      <td className="mono" style={{ color: 'var(--gold)' }}>{inv.id}</td>
                      <td>{formatDate(inv.invoice_date)}</td>
                      <td style={{ color: 'var(--teal)' }}>{formatDate(inv.travel_date)}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inv.customers?.name || '—'}</td>
                      <td className="mono">{inv.customers?.mobile || '—'}</td>
                      <td className="mono text-right">{money(inv.grand_total, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--teal)' }}>{money(received, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: 700 }}>{money(due, currencySymbol)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{inv.employees?.name || '—'}</td>
                      <td><StatusPill grandTotal={inv.grand_total} received={received} /></td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => setCollectTarget({ inv, due, received })} id={`collect-${inv.id}`}>
                          Collect Due
                        </button>
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
          onClose={() => { setCollectTarget(null); load() }}
          currencySymbol={currencySymbol}
          settings={collectTarget}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function CollectDueModal({ inv, dueAmount, onClose, currencySymbol }) {
  const [amount, setAmount] = useState(dueAmount)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const { success, error: toastError, toasts, dismiss } = useToast()
  const { settings, idSettings } = useSettings()

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { toastError('Amount must be greater than 0'); return }
    setSaving(true)
    try {
      const rcptConfig = settings?.idSettings?.receipt || idSettings?.receipt
      const rcptId = await generateId('receipt', 'receipts', rcptConfig)
      const { error } = await supabase.from('receipts').insert({
        id: rcptId,
        customer_id: inv.customer_id,
        invoice_id: inv.id,
        amount: parseFloat(amount),
        date,
        note: note || `Due collection for ${inv.id}`,
      })
      if (error) throw error
      success(`Payment ${rcptId} recorded`)
      onClose()
    } catch (err) {
      toastError('Failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title={`Collect Due — ${inv.id}`} size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button>
          </>
        }
      >
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid rgba(239,100,97,0.3)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Outstanding Balance</div>
          <div style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700 }}>{money(dueAmount, currencySymbol)}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Customer: {inv.customers?.name}</div>
        </div>
        <div className="form-group"><label className="form-label required">Amount ({currencySymbol})</label><input type="number" step="0.01" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Note</label><input className="form-input" placeholder="Optional note" value={note} onChange={e => setNote(e.target.value)} /></div>
      </Modal>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
