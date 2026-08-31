import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { uid } from '../../utils/idGenerator'

export default function AgentList() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewAgent, setViewAgent] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', commission_type: 'percent', commission_value: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('agents').select('*').order('name')
    if (error) toastError('Failed to load agents')
    else setAgents(data || [])
    setLoading(false)
  }, [toastError])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toastError('Name is required'); return }
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('agents').update(form).eq('id', editingId)
        if (error) throw error
        success('Agent updated')
      } else {
        const { error } = await supabase.from('agents').insert({ ...form, id: uid() })
        if (error) throw error
        success('Agent created')
      }
      setModalOpen(false)
      load()
    } catch (err) { toastError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('agents').delete().eq('id', deleteTarget.id)
      if (error) throw error
      success('Agent deleted')
      setDeleteTarget(null)
      load()
    } catch (err) { toastError(err.message) }
    finally { setDeleting(false) }
  }

  const filtered = agents.filter(a => !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.phone?.includes(search))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="page-subtitle">Legacy referral partner tracking · {agents.length} agents</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', phone: '', commission_type: 'percent', commission_value: '' }); setEditingId(null); setModalOpen(true) }}>
          <PlusIcon /> Add Agent
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input className="form-input search-input" placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState icon="🤝" title="No agents" description="Add referral/agent partners here." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Commission Type</th><th>Commission Value</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</td>
                    <td className="mono">{a.phone || '—'}</td>
                    <td><span className="pill pill-gold">{a.commission_type === 'percent' ? 'Percentage' : 'Fixed'}</span></td>
                    <td className="mono">{a.commission_value || 0} {a.commission_type === 'percent' ? '%' : ''}</td>
                    <td>
                      <div className="actions-col">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewAgent(a)} title="View Details">
                          <EyeIcon />
                        </button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setForm({ name: a.name, phone: a.phone || '', commission_type: a.commission_type || 'percent', commission_value: a.commission_value || '' }); setEditingId(a.id); setModalOpen(true) }} title="Edit"><EditIcon /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(a)} title="Delete"><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Agent Modal */}
      <Modal isOpen={!!viewAgent} onClose={() => setViewAgent(null)} title={`Agent Details — ${viewAgent?.name}`} size="md">
        {viewAgent && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 16 }}>
              <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Name</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>{viewAgent.name}</div>
              </div>
              <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Phone</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{viewAgent.phone || '—'}</div>
              </div>
              <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Commission Type</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{viewAgent.commission_type === 'percent' ? 'Percentage' : 'Fixed Amount'}</div>
              </div>
              <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Commission Rate</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--gold)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{viewAgent.commission_value || 0} {viewAgent.commission_type === 'percent' ? '%' : ''}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 6 }}>
              ℹ Note: Agents are legacy tracking for outside referral partners. Active sales staff are managed in the Employees module.
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Agent' : 'Add Agent'} size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}
      >
        <form onSubmit={handleSave}>
          <div className="form-group"><label className="form-label required">Name</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Commission Type</label>
              <select className="form-select" value={form.commission_type} onChange={e => set('commission_type', e.target.value)}>
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Value</label>
              <input type="number" step="0.01" className="form-input" value={form.commission_value} onChange={e => set('commission_value', e.target.value)} />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Agent" message={`Delete agent "${deleteTarget?.name}"? This cannot be undone.`} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
function EyeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
