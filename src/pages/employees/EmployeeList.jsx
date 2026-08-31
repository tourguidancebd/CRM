import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'

export default function EmployeeList() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', role: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('employees').select('*').order('name')
    if (error) toastError('Failed to load employees')
    else setEmployees(data || [])
    setLoading(false)
  }, [toastError])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toastError('Name is required'); return }
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('employees').update(form).eq('id', editingId)
        if (error) throw error
        success('Employee updated')
      } else {
        const { error } = await supabase.from('employees').insert(form)
        if (error) throw error
        success('Employee added')
      }
      setModalOpen(false)
      load()
    } catch (err) { toastError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('employees').delete().eq('id', deleteTarget.id)
      if (error) throw error
      success('Employee deleted')
      setDeleteTarget(null)
      load()
    } catch (err) { toastError(err.message) }
    finally { setDeleting(false) }
  }

  const filtered = employees.filter(e => !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.role?.toLowerCase().includes(search.toLowerCase()))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Sales staff who appear in Invoice "Sales By" · {employees.length} employees</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', role: '', phone: '' }); setEditingId(null); setModalOpen(true) }}>
          <PlusIcon /> Add Employee
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input className="form-input search-input" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
          <EmptyState icon="👔" title="No employees" description="Add employees who handle sales." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Role / Designation</th><th>Phone</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{emp.name}</td>
                    <td>{emp.role || '—'}</td>
                    <td className="mono">{emp.phone || '—'}</td>
                    <td>
                      <div className="actions-col">
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setForm({ name: emp.name, role: emp.role || '', phone: emp.phone || '' }); setEditingId(emp.id); setModalOpen(true) }}><EditIcon /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(emp)}><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Employee' : 'Add Employee'} size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}
      >
        <form onSubmit={handleSave}>
          <div className="form-group"><label className="form-label required">Name</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="form-group"><label className="form-label">Role / Designation</label><input className="form-input" placeholder="e.g. Sales Executive, Tour Guide" value={form.role} onChange={e => set('role', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Employee" message={`Delete "${deleteTarget?.name}"? They may be referenced in existing invoices.`} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
