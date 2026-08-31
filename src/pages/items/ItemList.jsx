import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { useSettings } from '../../contexts/SettingsContext'
import { money } from '../../utils/money'
import { uid } from '../../utils/idGenerator'

export default function ItemList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', buying_price: '', selling_price: '', shipping_cost: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { toasts, success, error: toastError, dismiss } = useToast()
  const { currencySymbol } = useSettings()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('items').select('*').order('name')
    if (error) toastError('Failed to load items')
    else setItems(data || [])
    setLoading(false)
  }, [toastError])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toastError('Item name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        buying_price: parseFloat(form.buying_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        shipping_cost: parseFloat(form.shipping_cost) || 0,
      }
      if (editingId) {
        const { error } = await supabase.from('items').update(payload).eq('id', editingId)
        if (error) throw error
        success('Item updated')
      } else {
        const newItemId = uid()
        const { error } = await supabase.from('items').insert({ ...payload, id: newItemId })
        if (error) throw error
        success('Item added')
      }
      setModalOpen(false)
      load()
    } catch (err) { toastError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('items').delete().eq('id', deleteTarget.id)
      if (error) throw error
      success('Item deleted')
      setDeleteTarget(null)
      load()
    } catch (err) { toastError(err.message) }
    finally { setDeleting(false) }
  }

  const openEdit = (item) => {
    setForm({ name: item.name, buying_price: item.buying_price || '', selling_price: item.selling_price || '', shipping_cost: item.shipping_cost || '' })
    setEditingId(item.id)
    setModalOpen(true)
  }

  const filtered = items.filter(i => !search || i.name?.toLowerCase().includes(search.toLowerCase()))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Items / Products</h1>
          <p className="page-subtitle">Tour packages, ferry tickets, and other sellable items · {items.length} items</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', buying_price: '', selling_price: '', shipping_cost: '' }); setEditingId(null); setModalOpen(true) }}>
          <PlusIcon /> Add Item
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input className="form-input search-input" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState icon="📦" title="No items" description="Add tour packages, tickets, and other services to your catalog." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th className="text-right">Buying Price</th>
                  <th className="text-right">Selling Price</th>
                  <th className="text-right">Shipping Cost</th>
                  <th className="text-right">Gross Margin</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const margin = (parseFloat(item.selling_price) || 0) - (parseFloat(item.buying_price) || 0)
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</td>
                      <td className="mono text-right">{money(item.buying_price || 0, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: 'var(--teal)' }}>{money(item.selling_price || 0, currencySymbol)}</td>
                      <td className="mono text-right">{money(item.shipping_cost || 0, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: margin >= 0 ? 'var(--teal)' : 'var(--red)', fontWeight: 600 }}>
                        {money(margin, currencySymbol)}
                      </td>
                      <td>
                        <div className="actions-col">
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(item)}><EditIcon /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(item)}><TrashIcon /></button>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Item' : 'Add Item'} size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}
      >
        <form onSubmit={handleSave}>
          <div className="form-group"><label className="form-label required">Item Name</label><input className="form-input" placeholder="e.g. Karnafuly Express (Ferry Ticket)" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">Buying Price ({currencySymbol})</label><input type="number" step="0.01" className="form-input" value={form.buying_price} onChange={e => set('buying_price', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Selling Price ({currencySymbol})</label><input type="number" step="0.01" className="form-input" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Shipping Cost ({currencySymbol})</label><input type="number" step="0.01" className="form-input" value={form.shipping_cost} onChange={e => set('shipping_cost', e.target.value)} /></div>
          {(form.buying_price || form.selling_price) && (
            <div style={{ background: 'var(--gold-dim)', border: '1px solid rgba(201,162,75,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--gold)' }}>
              Gross Margin per unit: <strong className="mono">{money((parseFloat(form.selling_price)||0) - (parseFloat(form.buying_price)||0), currencySymbol)}</strong>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Item" message={`Delete "${deleteTarget?.name}"? This cannot be undone. Existing invoice lines referencing this item will lose their cost data.`} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
