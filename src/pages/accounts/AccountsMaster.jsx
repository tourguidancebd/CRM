import { useState } from 'react'
import { useAccounts } from '../../contexts/AccountsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { ActivePill } from '../../components/common/StatusPill'
import { money } from '../../utils/money'
import { formatDate, today } from '../../utils/dateHelpers'
import { buildAccountStatementHtml } from '../../services/accountsEngine'
import { printHtml, downloadHtml } from '../../utils/printService'

export default function AccountsMaster() {
  const { accounts, unifiedTransactions, saveAccount, deleteAccount } = useAccounts()
  const { settings, currencySymbol } = useSettings()
  const { success, error: toastError } = useToast()

  const [activeTab, setActiveTab] = useState('all') // 'all' | 'bank' | 'cash' | 'mobile'
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [saving, setSaving] = useState(false)

  // Account Statement Modal
  const [statementAccount, setStatementAccount] = useState(null)

  // Delete Target
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [form, setForm] = useState({
    name: '',
    type: 'bank',
    accountName: '',
    accountNumber: '',
    accountType: 'Current Account',
    branch: '',
    routingNumber: '',
    swiftCode: '',
    provider: 'bKash',
    mobileNumber: '',
    responsiblePerson: '',
    openingBalance: '0',
    status: 'Active',
    notes: ''
  })

  const filteredAccounts = accounts.filter(a => activeTab === 'all' || a.type === activeTab)

  const openCreate = (type = 'bank') => {
    setForm({
      name: '',
      type,
      accountName: '',
      accountNumber: '',
      accountType: 'Current Account',
      branch: '',
      routingNumber: '',
      swiftCode: '',
      provider: 'bKash',
      mobileNumber: '',
      responsiblePerson: '',
      openingBalance: '0',
      status: 'Active',
      notes: ''
    })
    setEditingAccount(null)
    setModalOpen(true)
  }

  const openEdit = (acc) => {
    setForm({
      name: acc.name || '',
      type: acc.type || 'bank',
      accountName: acc.accountName || '',
      accountNumber: acc.accountNumber || '',
      accountType: acc.accountType || 'Current Account',
      branch: acc.branch || '',
      routingNumber: acc.routingNumber || '',
      swiftCode: acc.swiftCode || '',
      provider: acc.provider || 'bKash',
      mobileNumber: acc.mobileNumber || '',
      responsiblePerson: acc.responsiblePerson || '',
      openingBalance: String(acc.openingBalance || 0),
      status: acc.status || 'Active',
      notes: acc.notes || ''
    })
    setEditingAccount(acc)
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toastError('Account Name is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        id: editingAccount ? editingAccount.id : `acc-${Date.now().toString(36)}`,
        openingBalance: parseFloat(form.openingBalance) || 0
      }

      await saveAccount(payload)
      success(editingAccount ? 'Account updated successfully' : 'New account created successfully')
      setModalOpen(false)
    } catch (err) {
      toastError('Failed to save account: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteAccount(deleteTarget.id)
      success('Account deleted')
      setDeleteTarget(null)
    } catch (err) {
      toastError('Failed to delete account: ' + err.message)
    }
  }

  const handlePrintStatement = (acc) => {
    const html = buildAccountStatementHtml(acc, unifiedTransactions, settings, currencySymbol)
    printHtml(html, `Statement-${acc.name}`)
  }

  const handleDownloadStatement = (acc) => {
    const html = buildAccountStatementHtml(acc, unifiedTransactions, settings, currencySymbol)
    downloadHtml(html, `Statement-${acc.name}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header with Type Tabs and New Account button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 18px',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            ['all', 'All Accounts', accounts.length],
            ['bank', '🏛️ Bank Accounts', accounts.filter(a => a.type === 'bank').length],
            ['cash', '💵 Cash Vaults', accounts.filter(a => a.type === 'cash').length],
            ['mobile', '📱 Mobile Banking', accounts.filter(a => a.type === 'mobile').length]
          ].map(([k, label, count]) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${activeTab === k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab(k)}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => openCreate(activeTab === 'all' ? 'bank' : activeTab)}>
            + Add New Account
          </button>
        </div>
      </div>

      {/* Accounts List Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Type</th>
                <th>Account # / Identifier</th>
                <th>Branch / Provider</th>
                <th className="text-right">Opening Balance</th>
                <th className="text-right">Total Money In</th>
                <th className="text-right">Total Money Out</th>
                <th className="text-right">Current Live Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '2.4rem', marginBottom: 10 }}>🏦</div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                      No Accounts Created Yet
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
                      Start fresh by adding your corporate bank accounts, physical cash vaults, or mobile banking wallets (bKash / Nagad).
                    </div>
                    <button className="btn btn-primary" onClick={() => openCreate(activeTab === 'all' ? 'bank' : activeTab)}>
                      + Add New Account
                    </button>
                  </td>
                </tr>
              ) : filteredAccounts.map(acc => (
                <tr key={acc.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{acc.name}</div>
                    {acc.accountName && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{acc.accountName}</div>}
                  </td>
                  <td>
                    <span className={`pill ${acc.type === 'bank' ? 'pill-gold' : acc.type === 'cash' ? 'pill-paid' : 'pill-partial'}`}>
                      {acc.type?.toUpperCase()}
                    </span>
                  </td>
                  <td className="mono" style={{ color: 'var(--teal)', fontWeight: 600 }}>
                    {acc.accountNumber || acc.mobileNumber || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {acc.branch || acc.provider || acc.location || 'Head Office'}
                  </td>
                  <td className="mono text-right" style={{ color: 'var(--text-muted)' }}>
                    {money(acc.openingBalance, currencySymbol)}
                  </td>
                  <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: 600 }}>
                    {money(acc.totalInflow || 0, currencySymbol)}
                  </td>
                  <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: 600 }}>
                    {money(acc.totalOutflow || 0, currencySymbol)}
                  </td>
                  <td className="mono text-right" style={{
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    color: acc.currentBalance >= 0 ? 'var(--gold)' : 'var(--red)'
                  }}>
                    {money(acc.currentBalance, currencySymbol)}
                  </td>
                  <td>
                    <ActivePill active={acc.status === 'Active'} />
                  </td>
                  <td>
                    <div className="actions-col">
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => setStatementAccount(acc)}
                        title="View Account Statement"
                      >
                        📄
                      </button>
                      <button
                        className="btn btn-teal btn-sm btn-icon"
                        onClick={() => handlePrintStatement(acc)}
                        title="Print Statement"
                      >
                        🖨️
                      </button>
                      <button
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => openEdit(acc)}
                        title="Edit Account"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => setDeleteTarget(acc)}
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

      {/* Add / Edit Account Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAccount ? `Edit Account — ${editingAccount.name}` : 'Add New Account'}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingAccount ? 'Update Account' : 'Save Account'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Account Type</label>
              <select
                className="form-select"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                required
              >
                <option value="bank">🏛️ Bank Account</option>
                <option value="cash">💵 Cash Account / Vault</option>
                <option value="mobile">📱 Mobile Banking (bKash/Nagad/Rocket)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Account Name</label>
              <input
                className="form-input"
                placeholder="e.g. Islami Bank Current / Main Office Cash"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
          </div>

          {form.type === 'bank' && (
            <>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Account Holder Name</label>
                  <input
                    className="form-input"
                    placeholder="Tour Guidance BD Ltd"
                    value={form.accountName}
                    onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Bank Account Number</label>
                  <input
                    className="form-input"
                    placeholder="20501122334455"
                    value={form.accountNumber}
                    onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-grid form-grid-3">
                <div className="form-group">
                  <label className="form-label">Branch Name</label>
                  <input
                    className="form-input"
                    placeholder="Gulshan Branch, Dhaka"
                    value={form.branch}
                    onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Routing Number</label>
                  <input
                    className="form-input"
                    placeholder="125271890"
                    value={form.routingNumber}
                    onChange={e => setForm(f => ({ ...f, routingNumber: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SWIFT Code</label>
                  <input
                    className="form-input"
                    placeholder="IBBLBDDH"
                    value={form.swiftCode}
                    onChange={e => setForm(f => ({ ...f, swiftCode: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}

          {form.type === 'mobile' && (
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label required">Mobile Provider</label>
                <select
                  className="form-select"
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Upay">Upay</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Wallet Mobile Number</label>
                <input
                  className="form-input"
                  placeholder="01800000000"
                  value={form.mobileNumber}
                  onChange={e => setForm(f => ({ ...f, mobileNumber: e.target.value }))}
                  required
                />
              </div>
            </div>
          )}

          {form.type === 'cash' && (
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Responsible Person</label>
                <input
                  className="form-input"
                  placeholder="Head of Accounts"
                  value={form.responsiblePerson}
                  onChange={e => setForm(f => ({ ...f, responsiblePerson: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location / Branch</label>
                <input
                  className="form-input"
                  placeholder="Head Office, Dhaka"
                  value={form.branch}
                  onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Opening Balance ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                style={{ fontWeight: 700, color: 'var(--gold)' }}
                value={form.openingBalance}
                onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes & Description</label>
            <textarea
              className="form-textarea"
              placeholder="Internal accounting remarks..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>
        </form>
      </Modal>

      {/* Account Statement Modal */}
      {statementAccount && (
        <Modal
          isOpen={!!statementAccount}
          onClose={() => setStatementAccount(null)}
          title={`Account Statement — ${statementAccount.name}`}
          size="xl"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setStatementAccount(null)}>Close</button>
              <button className="btn btn-teal" onClick={() => handlePrintStatement(statementAccount)}>
                Print Statement
              </button>
              <button className="btn btn-primary" onClick={() => handleDownloadStatement(statementAccount)}>
                Download Statement
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Account Quick Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--card-border)',
              borderRadius: 8,
              padding: '12px 16px'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Opening Balance</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {money(statementAccount.openingBalance, currencySymbol)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Inflows</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--teal)' }}>
                  +{money(statementAccount.totalInflow || 0, currencySymbol)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Balance</div>
                <div className="mono" style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--gold)' }}>
                  {money(statementAccount.currentBalance, currencySymbol)}
                </div>
              </div>
            </div>

            {/* Statement Ledger Table */}
            <div className="table-wrapper" style={{ maxHeight: 400 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th className="text-right">Debit (In)</th>
                    <th className="text-right">Credit (Out)</th>
                  </tr>
                </thead>
                <tbody>
                  {unifiedTransactions.filter(t => t.accountId === statementAccount.id).map(t => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{t.id}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{t.type}</span> — {t.description}
                      </td>
                      <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: t.debit > 0 ? 700 : 400 }}>
                        {t.debit > 0 ? money(t.debit, currencySymbol) : '—'}
                      </td>
                      <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: t.credit > 0 ? 700 : 400 }}>
                        {t.credit > 0 ? money(t.credit, currencySymbol) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Account"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
      />
    </div>
  )
}
