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

// Default categories exactly as defined in §5.11
const DEFAULT_CATEGORY_GROUPS = [
  {
    group: 'A. Office & Administration',
    items: ['Office Rent', 'Electricity', 'Water', 'Internet', 'Telephone', 'Stationery', 'Printing & Photocopy', 'Office Supplies', 'Cleaning & Hygiene', 'Office Maintenance', 'Software & Subscription']
  },
  {
    group: 'B. Staff & Employee',
    items: ['Salary & Wages', 'Staff Allowance', 'Overtime', 'Staff Meals', 'Staff Transportation', 'Training & Development']
  },
  {
    group: 'C. Transportation',
    items: ['Local Transportation', 'Fuel', 'Parking & Toll', 'Vehicle Repair & Maintenance', 'Bus Operational Expense']
  },
  {
    group: 'D. Tour Operation',
    items: ['Hotel & Accommodation', 'Tour Guide', 'Local Transport', 'Food & Catering', 'Ship/Boat Operational Expense', 'Tour Staff Expense']
  },
  {
    group: 'E. Sales & Marketing',
    items: ['Facebook Advertising', 'Google Advertising', 'Promotional Materials', 'Client Meeting Expense', 'Client Entertainment', 'Business Development']
  },
  {
    group: 'F. Financial & Legal',
    items: ['Bank Charges', 'Mobile Banking Charges', 'Government Fees & Licenses', 'Legal & Professional Fees', 'Accounting & Audit', 'Taxes & VAT']
  },
  {
    group: 'G. Customer Related',
    items: ['Customer Refund', 'Customer Compensation', 'Customer Service Expense']
  },
  {
    group: 'H. General',
    items: ['Petty Cash', 'Emergency Expense', 'Miscellaneous Expense', 'Other Operating Expense']
  }
]

export default function ExpenseList() {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // Expense modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    category: 'Office Rent',
    date: today(),
    description: '',
    vendor: '',
    payment_method: 'Cash',
    amount: ''
  })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Custom Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatGroup, setNewCatGroup] = useState('H. General')
  const [savingCat, setSavingCat] = useState(false)

  const { toasts, success, error: toastError, dismiss } = useToast()
  const { settings, currencySymbol, idSettings } = useSettings()

  // Seed default categories into Supabase if empty
  const ensureCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('group_name')
      if (error) throw error

      if (!data || data.length === 0) {
        // Seed
        const seedData = []
        for (const g of DEFAULT_CATEGORY_GROUPS) {
          for (const item of g.items) {
            seedData.push({ id: uid(), name: item, group_name: g.group })
          }
        }
        const { data: inserted, error: seedError } = await supabase.from('categories').insert(seedData).select()
        if (!seedError && inserted) {
          setCategories(inserted)
          return
        }
      }
      setCategories(data || [])
    } catch (err) {
      console.warn('Category fetch/seed warning:', err)
      const fallbackList = []
      for (const g of DEFAULT_CATEGORY_GROUPS) {
        for (const item of g.items) {
          fallbackList.push({ name: item, group_name: g.group })
        }
      }
      setCategories(fallbackList)
    }
  }, [])

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    await ensureCategories()
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })

    if (error) toastError('Failed to load expenses: ' + error.message)
    else setExpenses(data || [])

    setLoading(false)
  }, [ensureCategories, toastError])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const openCreate = () => {
    setForm({
      category: categories[0]?.name || 'Office Rent',
      date: today(),
      description: '',
      vendor: '',
      payment_method: 'Cash',
      amount: ''
    })
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (exp) => {
    setForm({
      category: exp.category || '',
      date: exp.date || today(),
      description: exp.note || exp.description || '',
      vendor: exp.paid_to || exp.vendor || '',
      payment_method: exp.payment_method || 'Cash',
      amount: exp.amount || ''
    })
    setEditingId(exp.id)
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.category) {
      toastError('Please select a category')
      return
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toastError('Please enter a valid expense amount')
      return
    }

    setSaving(true)
    try {
      const payload = {
        category: form.category,
        date: form.date,
        note: form.description || null,
        paid_to: form.vendor || null,
        payment_method: form.payment_method,
        amount: parseFloat(form.amount)
      }

      if (editingId) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingId)
        if (error) throw error
        success(`Expense ${editingId} updated`)
      } else {
        const idConfig = settings?.idSettings?.expense || idSettings?.expense
        const newId = await generateId('expense', 'expenses', idConfig)
        const { error } = await supabase.from('expenses').insert({ ...payload, id: newId })
        if (error) throw error
        success(`Expense voucher ${newId} recorded`)
      }

      setModalOpen(false)
      loadExpenses()
    } catch (err) {
      toastError('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', deleteTarget.id)
      if (error) throw error
      success('Expense deleted')
      setDeleteTarget(null)
      loadExpenses()
    } catch (err) {
      toastError('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleAddCustomCategory = async (e) => {
    e.preventDefault()
    if (!newCatName.trim()) return

    setSavingCat(true)
    try {
      const { data, error } = await supabase.from('categories').insert({
        id: uid(),
        name: newCatName.trim(),
        group_name: newCatGroup
      }).select().single()

      if (error) throw error
      setCategories(prev => [...prev, data])
      setForm(f => ({ ...f, category: data.name }))
      success(`Category "${data.name}" added`)
      setNewCatName('')
      setCatModalOpen(false)
    } catch (err) {
      toastError('Could not add category: ' + err.message)
    } finally {
      setSavingCat(false)
    }
  }

  const handlePrintSingle = (exp) => {
    const html = buildSingleExpenseVoucherHtml(exp, settings, currencySymbol)
    printHtml(html, `Expense-Voucher-${exp.id}`)
  }

  const handlePrintFullReport = () => {
    const html = buildFullExpenseReportHtml(filtered, settings, currencySymbol)
    printHtml(html, `Full-Expense-Report`)
  }

  const handleDownloadFullReport = () => {
    const html = buildFullExpenseReportHtml(filtered, settings, currencySymbol)
    downloadHtml(html, `Full-Expense-Report-${today()}`)
  }

  // Group categories for rendering grouped select
  const groupedCategories = (() => {
    const acc = {}
    DEFAULT_CATEGORY_GROUPS.forEach(g => {
      acc[g.group] = [...g.items]
    })
    categories.forEach(cat => {
      const grp = cat.group_name || 'H. General'
      if (!acc[grp]) acc[grp] = []
      if (!acc[grp].includes(cat.name)) acc[grp].push(cat.name)
    })
    return acc
  })()

  const totalExpense = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

  const filtered = expenses.filter(exp => {
    if (filterCategory && exp.category !== filterCategory) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (exp.id || '').toLowerCase().includes(s) ||
      (exp.category || '').toLowerCase().includes(s) ||
      (exp.note || exp.description || '').toLowerCase().includes(s) ||
      (exp.paid_to || exp.vendor || '').toLowerCase().includes(s) ||
      (exp.payment_method || '').toLowerCase().includes(s)
    )
  })

  const filteredTotal = filtered.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track operational costs, office bills, tour staff and marketing outlays</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-teal" onClick={handlePrintFullReport} disabled={filtered.length === 0}>
            <PrintIcon /> Print Expense Report
          </button>
          <button className="btn btn-secondary" onClick={handleDownloadFullReport} disabled={filtered.length === 0}>
            <DownloadIcon /> Download Report
          </button>
          <button className="btn btn-primary" onClick={openCreate} id="new-expense-btn">
            <PlusIcon /> Add Expense
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input
              className="form-input search-input"
              placeholder="Search expenses by category, note, vendor, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 180 }}
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {Object.entries(groupedCategories).map(([grp, items]) => (
              <optgroup key={grp} label={grp}>
                {items.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filtered Total:</span>
            <span className="mono" style={{ color: 'var(--red)', fontWeight: 700, fontSize: '1rem' }}>
              {money(filteredTotal, currencySymbol)}
            </span>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading expenses..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="💸"
            title="No expense records"
            description="Record office bills, transportation costs, guide charges, or marketing expenses."
            action={<button className="btn btn-primary" onClick={openCreate}>Record First Expense</button>}
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description / Purpose</th>
                  <th>Paid To / Vendor</th>
                  <th>Payment Method</th>
                  <th className="text-right">Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id}>
                    <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{exp.id}</td>
                    <td>{formatDate(exp.date)}</td>
                    <td>
                      <span className="pill pill-gold">{exp.category}</span>
                    </td>
                    <td style={{ color: 'var(--text-primary)', maxWidth: 220 }} className="truncate" title={exp.note || exp.description || ''}>
                      {exp.note || exp.description || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{exp.paid_to || exp.vendor || '—'}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
                        {exp.payment_method || 'Cash'}
                      </span>
                    </td>
                    <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: 600 }}>
                      {money(exp.amount, currencySymbol)}
                    </td>
                    <td>
                      <div className="actions-col">
                        <button className="btn btn-teal btn-sm btn-icon" onClick={() => handlePrintSingle(exp)} title="Print Voucher">
                          <PrintIcon />
                        </button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(exp)} title="Edit">
                          <EditIcon />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(exp)} title="Delete">
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="table-grand-total">
                  <td colSpan="6">GRAND TOTAL ({filtered.length} Entries)</td>
                  <td className="mono text-right" style={{ color: 'var(--red)' }}>{money(filteredTotal, currencySymbol)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expense Form Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit Expense Voucher — ${editingId}` : 'New Expense Voucher'}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-expense-btn">
              {saving ? 'Saving...' : editingId ? 'Update Voucher' : 'Record Expense'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label required" style={{ margin: 0 }}>Category</label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.72rem', color: 'var(--gold)', padding: '2px 6px' }}
                onClick={() => setCatModalOpen(true)}
              >
                + New Category
              </button>
            </div>
            <select
              className="form-select"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              required
            >
              <option value="">Select Category...</option>
              {Object.entries(groupedCategories).map(([grp, items]) => (
                <optgroup key={grp} label={grp}>
                  {items.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Expense Date</label>
              <input
                type="date"
                className="form-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Payment Method</label>
              <select
                className="form-select"
                value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
              >
                <option>Cash</option>
                <option>Bank</option>
                <option>Mobile Banking</option>
                <option>Card</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Amount ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--red)' }}
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Paid To / Recipient / Vendor</label>
              <input
                className="form-input"
                placeholder="e.g. Electric Company, Landlord, Guide Name"
                value={form.vendor}
                onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Expense Description / Particulars</label>
            <textarea
              className="form-textarea"
              placeholder="Detailed description of the expense..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Add Custom Expense Category"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCatModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddCustomCategory} disabled={savingCat}>
              {savingCat ? 'Adding...' : 'Add Category'}
            </button>
          </>
        }
      >
        <form onSubmit={handleAddCustomCategory}>
          <div className="form-group">
            <label className="form-label required">Category Group</label>
            <select
              className="form-select"
              value={newCatGroup}
              onChange={e => setNewCatGroup(e.target.value)}
            >
              {DEFAULT_CATEGORY_GROUPS.map(g => (
                <option key={g.group} value={g.group}>{g.group}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required">Category Name</label>
            <input
              className="form-input"
              placeholder="e.g. Airport Transfer, Visa Assistance Fee"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Delete Expense Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Expense Voucher"
        message={`Delete expense voucher ${deleteTarget?.id} (${deleteTarget?.category} - ${money(deleteTarget?.amount || 0, currencySymbol)})? This action cannot be undone.`}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function buildSingleExpenseVoucherHtml(exp, settings, currencySymbol) {
  const content = `
    <div class="doc-title">EXPENSE DEBIT VOUCHER</div>
    <div style="text-align: center; color: #666; font-size: 11px; margin-bottom: 16px;">Office & Tour Operational Expenditure</div>

    <div class="doc-meta">
      <div class="doc-meta-row"><span class="doc-meta-label">Voucher No:</span><span class="doc-meta-value">${escapeHtml(exp.id)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Voucher Date:</span><span class="doc-meta-value">${formatDate(exp.date)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Category:</span><span class="doc-meta-value">${escapeHtml(exp.category)}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Payment Method:</span><span class="doc-meta-value">${escapeHtml(exp.payment_method || 'Cash')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Paid To / Recipient:</span><span class="doc-meta-value">${escapeHtml(exp.vendor || '—')}</span></div>
      <div class="doc-meta-row"><span class="doc-meta-label">Description:</span><span class="doc-meta-value">${escapeHtml(exp.description || '—')}</span></div>
    </div>

    <div style="margin: 24px 0; padding: 20px; background: #fff5f5; border: 2px solid #EF6461; border-radius: 8px; text-align: center;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 4px;">Total Debit Amount</div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; color: #EF6461;">
        ${money(exp.amount, currencySymbol)}
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-top: 50px;">
      <div style="text-align: center; width: 140px;">
        <div style="border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555;">Prepared By</div>
      </div>
      <div style="text-align: center; width: 140px;">
        <div style="border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555;">Recipient's Signature</div>
      </div>
      <div style="text-align: center; width: 140px;">
        <div style="border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555;">Authorized Manager</div>
      </div>
    </div>
  `

  return buildLetterheadDoc({
    title: `Expense-Voucher-${exp.id}`,
    content,
    company: settings?.company
  })
}

function buildFullExpenseReportHtml(expenses, settings, currencySymbol) {
  const total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

  const content = `
    <div class="doc-title">EXPENSE & DISBURSEMENT STATEMENT</div>
    <div style="text-align: center; color: #666; font-size: 11px; margin-bottom: 16px;">Comprehensive Operational Expenditure Summary</div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Voucher #</th>
          <th>Category</th>
          <th>Particulars / Description</th>
          <th>Paid To</th>
          <th>Method</th>
          <th class="amount-col">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.map((e, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${formatDate(e.date)}</td>
            <td class="mono">${escapeHtml(e.id)}</td>
            <td><b>${escapeHtml(e.category)}</b></td>
            <td>${escapeHtml(e.description || '—')}</td>
            <td>${escapeHtml(e.vendor || '—')}</td>
            <td>${escapeHtml(e.payment_method || 'Cash')}</td>
            <td class="amount-col">${money(e.amount, currencySymbol)}</td>
          </tr>
        `).join('')}
        <tr class="grand-total-row">
          <td colspan="7">GRAND TOTAL EXPENDITURES</td>
          <td class="amount-col">${money(total, currencySymbol)}</td>
        </tr>
      </tbody>
    </table>

    <div style="display: flex; justify-content: flex-end; margin-top: 30px;">
      <div style="text-align: center; width: 180px;">
        <div style="border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555;">Audit & Accounts</div>
      </div>
    </div>
  `

  return buildLetterheadDoc({
    title: `Full-Expense-Report`,
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
