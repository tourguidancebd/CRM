import { useState } from 'react'
import { useAccounts } from '../../contexts/AccountsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'

export default function AccountsSettings() {
  const {
    chartOfAccounts,
    fiscalYear,
    updateChartOfAccounts,
    updateFiscalYear,
    clearAllAccountsData
  } = useAccounts()

  const { success, error: toastError } = useToast()

  const [coaSearch, setCoaSearch] = useState('')
  const [coaTypeFilter, setCoaTypeFilter] = useState('ALL')
  const [coaModalOpen, setCoaModalOpen] = useState(false)
  const [editingCoa, setEditingCoa] = useState(null)
  const [deleteCoaTarget, setDeleteCoaTarget] = useState(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newCoa, setNewCoa] = useState({
    code: '',
    name: '',
    type: 'Expense',
    category: 'Operational',
    normalBalance: 'Debit'
  })

  const [fyForm, setFyForm] = useState(fiscalYear || {
    name: 'FY 2026-2027',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'Open'
  })

  const filteredCoa = chartOfAccounts.filter(c => {
    if (coaTypeFilter !== 'ALL' && c.type !== coaTypeFilter) return false
    if (!coaSearch) return true
    const s = coaSearch.toLowerCase()
    return c.name.toLowerCase().includes(s) || c.code.includes(s) || c.category.toLowerCase().includes(s)
  })

  const openCreateCoa = () => {
    setEditingCoa(null)
    setNewCoa({
      code: '',
      name: '',
      type: 'Expense',
      category: 'Operational',
      normalBalance: 'Debit'
    })
    setCoaModalOpen(true)
  }

  const openEditCoa = (c) => {
    setEditingCoa(c)
    setNewCoa({
      code: c.code || '',
      name: c.name || '',
      type: c.type || 'Expense',
      category: c.category || 'Operational',
      normalBalance: c.normalBalance || 'Debit'
    })
    setCoaModalOpen(true)
  }

  const handleSaveCoa = async (e) => {
    e.preventDefault()
    if (!newCoa.code.trim() || !newCoa.name.trim()) {
      toastError('Account code and name are required')
      return
    }

    if (!editingCoa && chartOfAccounts.some(c => c.code === newCoa.code)) {
      toastError(`Account Code ${newCoa.code} already exists in Chart of Accounts`)
      return
    }

    setSaving(true)
    try {
      let updated
      if (editingCoa) {
        updated = chartOfAccounts.map(c => (c.id === editingCoa.id || c.code === editingCoa.code) ? {
          ...c,
          ...newCoa,
          id: newCoa.code
        } : c)
        success(`Account [${newCoa.code}] updated successfully`)
      } else {
        updated = [
          ...chartOfAccounts,
          {
            ...newCoa,
            id: newCoa.code,
            isSystem: false
          }
        ]
        success(`Account [${newCoa.code}] ${newCoa.name} added to Chart of Accounts`)
      }
      await updateChartOfAccounts(updated)
      setCoaModalOpen(false)
    } catch (err) {
      toastError('Failed to save account: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCoa = async () => {
    if (!deleteCoaTarget) return
    try {
      const updated = chartOfAccounts.filter(c => c.id !== deleteCoaTarget.id && c.code !== deleteCoaTarget.code)
      await updateChartOfAccounts(updated)
      success(`Account [${deleteCoaTarget.code}] ${deleteCoaTarget.name} deleted`)
      setDeleteCoaTarget(null)
    } catch (err) {
      toastError('Failed to delete account: ' + err.message)
    }
  }

  const handleSaveFiscalYear = async (e) => {
    e.preventDefault()
    try {
      await updateFiscalYear(fyForm)
      success('Fiscal year settings updated')
    } catch (err) {
      toastError('Failed to update fiscal year: ' + err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Fiscal Year Configuration Card */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 14px 0', color: 'var(--text-primary)' }}>
          📅 Financial & Fiscal Year Management
        </h3>

        <form onSubmit={handleSaveFiscalYear} className="form-grid form-grid-4" style={{ alignItems: 'flex-end' }}>
          <div className="form-group">
            <label className="form-label required">Fiscal Year Title</label>
            <input
              className="form-input"
              value={fyForm.name}
              onChange={e => setFyForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label required">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={fyForm.startDate}
              onChange={e => setFyForm(f => ({ ...f, startDate: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label required">End Date</label>
            <input
              type="date"
              className="form-input"
              value={fyForm.endDate}
              onChange={e => setFyForm(f => ({ ...f, endDate: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Update Fiscal Year
            </button>
          </div>
        </form>
      </div>

      {/* Chart of Accounts (COA) Master */}
      <div className="card">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              📑 Chart of Accounts (COA)
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Standard 5-category double-entry accounting ledger accounts
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ width: 180 }}
              placeholder="Search account code/name..."
              value={coaSearch}
              onChange={e => setCoaSearch(e.target.value)}
            />

            <select
              className="form-select"
              style={{ width: 150 }}
              value={coaTypeFilter}
              onChange={e => setCoaTypeFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="Asset">Assets</option>
              <option value="Liability">Liabilities</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expense">Expenses</option>
            </select>

            <button className="btn btn-primary btn-sm" onClick={openCreateCoa}>
              + Add Account Code
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Title</th>
                <th>Category / Type</th>
                <th>Sub-Category</th>
                <th>Normal Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoa.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                    No accounts found matching your search.
                  </td>
                </tr>
              ) : filteredCoa.map(c => (
                <tr key={c.id || c.code}>
                  <td className="mono" style={{ color: 'var(--gold)', fontWeight: 700 }}>{c.code}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                  <td>
                    <span className={`pill ${c.type === 'Asset' || c.type === 'Revenue' ? 'pill-paid' : c.type === 'Expense' ? 'pill-due' : 'pill-gold'}`}>
                      {c.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.category}</td>
                  <td className="mono" style={{ fontSize: '0.8rem' }}>{c.normalBalance}</td>
                  <td>
                    <div className="actions-col">
                      <button
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => openEditCoa(c)}
                        title="Edit Account Code & Title"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => setDeleteCoaTarget(c)}
                        title="Delete Account"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit COA Modal */}
      <Modal
        isOpen={coaModalOpen}
        onClose={() => setCoaModalOpen(false)}
        title={editingCoa ? `Edit Account — [${editingCoa.code}] ${editingCoa.name}` : 'Add Account to Chart of Accounts'}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCoaModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveCoa} disabled={saving}>
              {saving ? 'Saving...' : editingCoa ? 'Update Account' : 'Add Account'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveCoa}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Account Code</label>
              <input
                className="form-input"
                placeholder="e.g. 5810"
                value={newCoa.code}
                onChange={e => setNewCoa(f => ({ ...f, code: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Account Type</label>
              <select
                className="form-select"
                value={newCoa.type}
                onChange={e => {
                  const t = e.target.value
                  const norm = (t === 'Asset' || t === 'Expense') ? 'Debit' : 'Credit'
                  setNewCoa(f => ({ ...f, type: t, normalBalance: norm }))
                }}
              >
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Account Title / Name</label>
            <input
              className="form-input"
              placeholder="e.g. Tour Guide Equipment Maintenance"
              value={newCoa.name}
              onChange={e => setNewCoa(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Sub-Category</label>
            <input
              className="form-input"
              placeholder="e.g. Tour Cost / Administration"
              value={newCoa.category}
              onChange={e => setNewCoa(f => ({ ...f, category: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      {/* Delete COA Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteCoaTarget}
        onClose={() => setDeleteCoaTarget(null)}
        onConfirm={handleDeleteCoa}
        title="Delete Account from Chart of Accounts"
        message={`Are you sure you want to delete [${deleteCoaTarget?.code}] ${deleteCoaTarget?.name}?`}
      />

      {/* Danger Zone: Clear & Reset Accounts */}
      <div className="card" style={{ border: '1px solid rgba(239,100,97,0.3)', background: 'rgba(239,100,97,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ color: 'var(--red)', margin: '0 0 4px 0', fontSize: '0.95rem' }}>
              ⚠️ Danger Zone: Clear & Reset Accounts
            </h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Reset all bank accounts, cash vaults, mobile wallets, transfers, deposits, and journal entries to start completely fresh.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setResetConfirmOpen(true)}
          >
            🗑️ Clear & Reset All Accounts
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={async () => {
          await clearAllAccountsData()
          success('All accounts data has been wiped and reset to a clean, fresh state!')
          setResetConfirmOpen(false)
        }}
        title="Wipe & Reset All Accounts Data"
        message="Are you sure you want to delete all accounts, transfers, deposits, withdrawals, and journal entries? This will give you a completely fresh, empty accounting ledger."
      />
    </div>
  )
}
