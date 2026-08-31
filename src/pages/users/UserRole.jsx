import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/common/Toast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { EmptyState } from '../../components/common/EmptyState'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate } from '../../utils/dateHelpers'

export default function UserRole() {
  const { user: currentUser, profile: currentProfile } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'CustomerService',
    employee_id: ''
  })
  const [saving, setSaving] = useState(false)

  // Delete target
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const { toasts, success, error: toastError, dismiss } = useToast()

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const [profRes, empRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name').order('name')
    ])

    if (profRes.error) {
      toastError('Failed to load user profiles: ' + profRes.error.message)
    } else {
      setProfiles(profRes.data || [])
    }

    if (empRes.data) setEmployees(empRes.data)
    setLoading(false)
  }, [toastError])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const openCreate = () => {
    setForm({
      email: '',
      password: '',
      full_name: '',
      role: 'CustomerService',
      employee_id: ''
    })
    setEditingProfile(null)
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setForm({
      email: p.email || '',
      password: '', // Leave blank unless updating
      full_name: p.full_name || '',
      role: p.role || 'CustomerService',
      employee_id: p.employee_id || ''
    })
    setEditingProfile(p)
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (editingProfile) {
        // Update existing profile role & details
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name,
            role: form.role,
            employee_id: form.employee_id || null
          })
          .eq('id', editingProfile.id)

        if (error) throw error
        success(`User role updated to ${form.role}`)
      } else {
        // Create new user using Supabase Auth SignUp
        if (!form.email || !form.password) {
          toastError('Email and Password are required for new accounts')
          setSaving(false)
          return
        }

        if (form.password.length < 8) {
          toastError('Password must be at least 8 characters')
          setSaving(false)
          return
        }

        // Sign up new user via Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              full_name: form.full_name,
              role: form.role
            }
          }
        })

        if (authError) throw authError

        // Ensure profiles row has the assigned role
        if (authData?.user) {
          await supabase.from('profiles').upsert({
            id: authData.user.id,
            email: form.email.trim(),
            full_name: form.full_name,
            role: form.role,
            employee_id: form.employee_id || null
          })
        }

        success(`User account for ${form.email} created with ${form.role} role`)
      }

      setModalOpen(false)
      loadUsers()
    } catch (err) {
      toastError('Operation failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    // Safety checks
    if (deleteTarget.id === currentUser?.id) {
      toastError('You cannot delete your own account.')
      setDeleteTarget(null)
      return
    }

    const adminCount = profiles.filter(p => p.role === 'Admin').length
    if (deleteTarget.role === 'Admin' && adminCount <= 1) {
      toastError('Cannot delete the last remaining Administrator.')
      setDeleteTarget(null)
      return
    }

    setDeleting(true)
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id)
      if (error) throw error
      success('User profile removed')
      setDeleteTarget(null)
      loadUsers()
    } catch (err) {
      toastError('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = profiles.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (p.email || '').toLowerCase().includes(s) ||
      (p.full_name || '').toLowerCase().includes(s) ||
      (p.role || '').toLowerCase().includes(s)
    )
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users & Access Control</h1>
          <p className="page-subtitle">Manage administrative privileges, customer service reps, and sales agent access</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="new-user-btn">
          <PlusIcon /> Add New User
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input
              className="form-input search-input"
              placeholder="Search users by name, email, or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading user directory..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No users found"
            description="Create system accounts to grant access to staff."
            action={<button className="btn btn-primary" onClick={openCreate}>Add User</button>}
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User / Name</th>
                  <th>Email</th>
                  <th>System Role</th>
                  <th>Linked Sales Employee</th>
                  <th>Registered Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isSelf = p.id === currentUser?.id
                  const empName = employees.find(e => e.id === p.employee_id)?.name

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="sidebar-user-avatar" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>
                            {(p.full_name || p.email || 'U')[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {p.full_name || 'Staff User'}
                            {isSelf && <span style={{ color: 'var(--gold)', fontSize: '0.72rem', marginLeft: 6 }}>(You)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="mono">{p.email || '—'}</td>
                      <td>
                        <span className={`pill ${
                          p.role === 'Admin' ? 'pill-gold' :
                          p.role === 'CustomerService' ? 'pill-paid' : 'pill-partial'
                        }`}>
                          {p.role}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {empName ? `${empName}` : '—'}
                      </td>
                      <td>{formatDate(p.created_at)}</td>
                      <td>
                        <div className="actions-col">
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(p)} title="Edit Role">
                            <EditIcon />
                          </button>
                          {!isSelf && (
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(p)} title="Delete User">
                              <TrashIcon />
                            </button>
                          )}
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

      {/* User Form Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProfile ? `Edit User — ${editingProfile.email || editingProfile.full_name}` : 'Create New User Account'}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-user-btn">
              {saving ? 'Saving...' : editingProfile ? 'Save Changes' : 'Create Account'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label required">Full Name</label>
            <input
              className="form-input"
              placeholder="e.g. Tanvir Ahmed"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>

          {!editingProfile && (
            <>
              <div className="form-group">
                <label className="form-label required">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="staff@tourguidebd.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Initial Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label required">Role & Permission Level</label>
            <select
              className="form-select"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              <option value="Admin">Admin (Full System Access & Settings)</option>
              <option value="CustomerService">Customer Service (Sales, Invoices, Receipts, Expenses)</option>
              <option value="Agent">Agent (View Customers, My Sales Performance Only)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Link to Employee Record (For Sales Tracking)</label>
            <select
              className="form-select"
              value={form.employee_id}
              onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
            >
              <option value="">None (Unlinked)</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <div className="form-hint">Enables automatic filtering for "My Sales" when logged in as Agent.</div>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove User Profile"
        message={`Are you sure you want to revoke system access for "${deleteTarget?.full_name || deleteTarget?.email}" (${deleteTarget?.role})?`}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
