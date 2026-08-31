import { useState } from 'react'
import { useAccounts } from '../../contexts/AccountsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../../components/common/Modal'

export default function AccountsSettings() {
  const {
    chartOfAccounts,
    fiscalYear,
    updateChartOfAccounts,
    updateFiscalYear
  } = useAccounts()

  const { success, error: toastError } = useToast()

  const [coaSearch, setCoaSearch] = useState('')
  const [coaTypeFilter, setCoaTypeFilter] = useState('ALL')
  const [coaModalOpen, setCoaModalOpen] = useState(false)
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

  const handleSaveCoa = async (e) => {
    e.preventDefault()
    if (!newCoa.code || !newCoa.name) {
      toastError('Account code and name are required')
      return
    }

    if (chartOfAccounts.some(c => c.code === newCoa.code)) {
      toastError(`Account Code ${newCoa.code} already exists in Chart of Accounts`)
      return
    }

    setSaving(true)
    try {
      const updated = [
        ...chartOfAccounts,
        {
          ...newCoa,
          id: newCoa.code,
          isSystem: false
        }
      ]
      await updateChartOfAccounts(updated)
      success(`Account [${newCoa.code}] ${newCoa.name} added to Chart of Accounts`)
      setCoaModalOpen(false)
    } catch (err) {
      toastError('Failed to save account: ' + err.message)
    } finally {
      setSaving(false)
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

            <button className="btn btn-primary btn-sm" onClick={() => setCoaModalOpen(true)}>
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
                <th>System Account</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoa.map(c => (
                <tr key={c.id}>
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
                    <span style={{ fontSize: '0.72rem', color: c.isSystem ? 'var(--text-muted)' : 'var(--teal)' }}>
                      {c.isSystem ? '🔒 System Core' : 'Custom'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Custom COA Modal */}
      <Modal
        isOpen={coaModalOpen}
        onClose={() => setCoaModalOpen(false)}
        title="Add Account to Chart of Accounts"
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCoaModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveCoa} disabled={saving}>
              {saving ? 'Saving...' : 'Add Account'}
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
    </div>
  )
}
