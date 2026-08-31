import { useState } from 'react'
import { useAccounts } from '../../contexts/AccountsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../../components/common/Modal'
import { money } from '../../utils/money'
import { formatDate, today } from '../../utils/dateHelpers'
import { buildPaymentVoucherHtml } from '../../services/accountsEngine'
import { printHtml, downloadHtml } from '../../utils/printService'

export default function TransactionsCenter({ activeModal, onCloseModal, onOpenModal }) {
  const {
    accounts,
    chartOfAccounts,
    unifiedTransactions,
    addTransfer,
    addDeposit,
    addWithdrawal,
    addJournalEntry,
    reloadAccounts
  } = useAccounts()

  const { settings, currencySymbol } = useSettings()
  const { success, error: toastError } = useToast()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [accountFilter, setAccountFilter] = useState('ALL')
  const [saving, setSaving] = useState(false)

  // --- Form States ---

  // 1. Transfer Form
  const [transferForm, setTransferForm] = useState({
    fromAccountId: accounts[0]?.id || '',
    toAccountId: accounts[1]?.id || '',
    amount: '',
    fee: '0',
    date: today(),
    description: '',
    reference: ''
  })

  // 2. Deposit Form
  const [depositForm, setDepositForm] = useState({
    accountId: accounts[0]?.id || '',
    amount: '',
    depositType: 'Capital Deposit',
    source: "Owner's Investment",
    paymentMethod: 'Bank Deposit',
    date: today(),
    reference: '',
    description: ''
  })

  // 3. Withdrawal Form
  const [withdrawalForm, setWithdrawalForm] = useState({
    accountId: accounts[0]?.id || '',
    amount: '',
    withdrawalType: "Owner's Drawing",
    withdrawnBy: 'Director / Partner',
    date: today(),
    reference: '',
    purpose: ''
  })

  // 4. Double-Entry Journal Entry Form
  const [journalForm, setJournalForm] = useState({
    date: today(),
    reference: '',
    description: '',
    lines: [
      { accountId: accounts[0]?.id || '', accountName: 'Cash / Bank', debit: '', credit: '', narration: '' },
      { accountId: accounts[1]?.id || '', accountName: 'Capital / Expense', debit: '', credit: '', narration: '' }
    ]
  })

  // Filtered transactions list
  const filtered = unifiedTransactions.filter(t => {
    if (typeFilter !== 'ALL' && t.type !== typeFilter) return false
    if (accountFilter !== 'ALL' && t.accountId !== accountFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (t.id || '').toLowerCase().includes(s) ||
      (t.description || '').toLowerCase().includes(s) ||
      (t.entityName || '').toLowerCase().includes(s) ||
      (t.category || '').toLowerCase().includes(s)
    )
  })

  // --- Submit Handlers ---
  const handleSaveTransfer = async (e) => {
    e.preventDefault()
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      toastError('From and To accounts must be different')
      return
    }
    const amt = parseFloat(transferForm.amount) || 0
    if (amt <= 0) {
      toastError('Transfer amount must be greater than 0')
      return
    }

    const fromAcc = accounts.find(a => a.id === transferForm.fromAccountId)
    const fee = parseFloat(transferForm.fee) || 0
    if (fromAcc && (amt + fee) > fromAcc.currentBalance) {
      toastError(`Insufficient funds in ${fromAcc.name}. Available balance: ${money(fromAcc.currentBalance, currencySymbol)}`)
      return
    }

    setSaving(true)
    try {
      await addTransfer(transferForm)
      success(`Fund transfer of ${money(amt, currencySymbol)} recorded`)
      onCloseModal()
      reloadAccounts()
    } catch (err) {
      toastError('Transfer failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDeposit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(depositForm.amount) || 0
    if (amt <= 0) {
      toastError('Deposit amount must be greater than 0')
      return
    }

    setSaving(true)
    try {
      await addDeposit(depositForm)
      success(`Deposit of ${money(amt, currencySymbol)} recorded`)
      onCloseModal()
      reloadAccounts()
    } catch (err) {
      toastError('Deposit failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveWithdrawal = async (e) => {
    e.preventDefault()
    const amt = parseFloat(withdrawalForm.amount) || 0
    if (amt <= 0) {
      toastError('Withdrawal amount must be greater than 0')
      return
    }

    const acc = accounts.find(a => a.id === withdrawalForm.accountId)
    if (acc && amt > acc.currentBalance) {
      toastError(`Insufficient funds in ${acc.name}. Available balance: ${money(acc.currentBalance, currencySymbol)}`)
      return
    }

    setSaving(true)
    try {
      await addWithdrawal(withdrawalForm)
      success(`Withdrawal of ${money(amt, currencySymbol)} recorded`)
      onCloseModal()
      reloadAccounts()
    } catch (err) {
      toastError('Withdrawal failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveJournal = async (e) => {
    e.preventDefault()
    const totalDr = journalForm.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
    const totalCr = journalForm.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)

    if (totalDr <= 0 || totalCr <= 0) {
      toastError('Journal entry must have non-zero amounts')
      return
    }

    if (Math.abs(totalDr - totalCr) > 0.01) {
      toastError(`Unbalanced Journal Entry: Total Debit (${money(totalDr, currencySymbol)}) must equal Total Credit (${money(totalCr, currencySymbol)})`)
      return
    }

    setSaving(true)
    try {
      await addJournalEntry(journalForm)
      success(`Double-entry journal voucher of ${money(totalDr, currencySymbol)} posted`)
      onCloseModal()
      reloadAccounts()
    } catch (err) {
      toastError('Journal posting failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const addJournalLine = () => {
    setJournalForm(f => ({
      ...f,
      lines: [...f.lines, { accountId: accounts[0]?.id || '', accountName: '', debit: '', credit: '', narration: '' }]
    }))
  }

  const removeJournalLine = (index) => {
    if (journalForm.lines.length <= 2) {
      toastError('A double-entry journal requires at least 2 lines')
      return
    }
    setJournalForm(f => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== index)
    }))
  }

  const updateJournalLine = (index, field, value) => {
    setJournalForm(f => {
      const newLines = [...f.lines]
      newLines[index] = { ...newLines[index], [field]: value }
      return { ...f, lines: newLines }
    })
  }

  // Journal total calculations for live validator
  const totalJournalDr = journalForm.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalJournalCr = journalForm.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isJournalBalanced = Math.abs(totalJournalDr - totalJournalCr) < 0.01 && totalJournalDr > 0

  const handlePrintVoucher = (tx) => {
    const html = buildPaymentVoucherHtml(tx, settings, currencySymbol)
    printHtml(html, `Voucher-${tx.id}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filter & Action Toolbar */}
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            className="form-select"
            style={{ width: 160 }}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="Income">Income (Money In)</option>
            <option value="Expense">Expense (Money Out)</option>
            <option value="Payment">Vendor Payment</option>
            <option value="Transfer">Fund Transfer</option>
            <option value="Deposit">Deposit</option>
            <option value="Withdrawal">Withdrawal</option>
            <option value="Journal">Journal Entry</option>
          </select>

          <select
            className="form-select"
            style={{ width: 180 }}
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
          >
            <option value="ALL">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onOpenModal('transfer')}>
            ⇄ Transfer
          </button>
          <button className="btn btn-teal btn-sm" onClick={() => onOpenModal('deposit')}>
            📥 Deposit
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onOpenModal('withdrawal')}>
            📤 Withdrawal
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onOpenModal('journal')}>
            ⚖️ Journal Entry
          </button>
        </div>
      </div>

      {/* Unified Transactions Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tx #</th>
                <th>Type</th>
                <th>Category</th>
                <th>Account</th>
                <th>Entity / Payee</th>
                <th>Description</th>
                <th className="text-right">Debit (In)</th>
                <th className="text-right">Credit (Out)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{t.id}</td>
                  <td>
                    <span className={`pill ${t.type === 'Income' || t.type === 'Deposit' ? 'pill-paid' : t.type === 'Expense' || t.type === 'Payment' ? 'pill-due' : 'pill-gold'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.category}</td>
                  <td style={{ fontWeight: 500 }}>{t.accountName}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{t.entityName || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 200 }} className="truncate" title={t.description}>
                    {t.description}
                  </td>
                  <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: t.debit > 0 ? 700 : 400 }}>
                    {t.debit > 0 ? money(t.debit, currencySymbol) : '—'}
                  </td>
                  <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: t.credit > 0 ? 700 : 400 }}>
                    {t.credit > 0 ? money(t.credit, currencySymbol) : '—'}
                  </td>
                  <td>
                    <div className="actions-col">
                      <button className="btn btn-teal btn-sm btn-icon" onClick={() => handlePrintVoucher(t)} title="Print Voucher">
                        🖨️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL 1: FUND TRANSFER --- */}
      <Modal
        isOpen={activeModal === 'transfer'}
        onClose={onCloseModal}
        title="Internal Fund Transfer"
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={onCloseModal} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveTransfer} disabled={saving}>
              {saving ? 'Processing...' : 'Execute Transfer'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveTransfer}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">From Account (Source)</label>
              <select
                className="form-select"
                value={transferForm.fromAccountId}
                onChange={e => setTransferForm(f => ({ ...f, fromAccountId: e.target.value }))}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({money(a.currentBalance, currencySymbol)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">To Account (Destination)</label>
              <select
                className="form-select"
                value={transferForm.toAccountId}
                onChange={e => setTransferForm(f => ({ ...f, toAccountId: e.target.value }))}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({money(a.currentBalance, currencySymbol)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label required">Transfer Amount ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                min="1"
                className="form-input"
                style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '1rem' }}
                value={transferForm.amount}
                onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Transfer Fee ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={transferForm.fee}
                onChange={e => setTransferForm(f => ({ ...f, fee: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Transfer Date</label>
              <input
                type="date"
                className="form-input"
                value={transferForm.date}
                onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Transfer Note & Purpose</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Bank to bKash liquidity top-up for tour booking disbursements"
              value={transferForm.description}
              onChange={e => setTransferForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>
        </form>
      </Modal>

      {/* --- MODAL 2: DEPOSIT ENTRY --- */}
      <Modal
        isOpen={activeModal === 'deposit'}
        onClose={onCloseModal}
        title="Record Deposit / Capital Investment"
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={onCloseModal} disabled={saving}>Cancel</button>
            <button className="btn btn-teal" onClick={handleSaveDeposit} disabled={saving}>
              {saving ? 'Saving...' : 'Record Deposit'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveDeposit}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Destination Account</label>
              <select
                className="form-select"
                value={depositForm.accountId}
                onChange={e => setDepositForm(f => ({ ...f, accountId: e.target.value }))}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Deposit Type</label>
              <select
                className="form-select"
                value={depositForm.depositType}
                onChange={e => setDepositForm(f => ({ ...f, depositType: e.target.value }))}
              >
                <option value="Capital Deposit">Owner's Capital Investment</option>
                <option value="Bank Deposit">Cash to Bank Deposit</option>
                <option value="Customer Deposit">Customer Advance Deposit</option>
                <option value="Security Deposit">Vendor / Security Deposit Refund</option>
                <option value="Other Deposit">Other Inflow</option>
              </select>
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Deposit Amount ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                min="1"
                className="form-input"
                style={{ fontWeight: 700, color: 'var(--teal)', fontSize: '1rem' }}
                value={depositForm.amount}
                onChange={e => setDepositForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Deposit Date</label>
              <input
                type="date"
                className="form-input"
                value={depositForm.date}
                onChange={e => setDepositForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Depositor / Source</label>
            <input
              className="form-input"
              placeholder="Managing Director / Investor Name"
              value={depositForm.source}
              onChange={e => setDepositForm(f => ({ ...f, source: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Remarks</label>
            <textarea
              className="form-textarea"
              placeholder="Internal accounting remarks..."
              value={depositForm.description}
              onChange={e => setDepositForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>
        </form>
      </Modal>

      {/* --- MODAL 3: WITHDRAWAL ENTRY --- */}
      <Modal
        isOpen={activeModal === 'withdrawal'}
        onClose={onCloseModal}
        title="Record Withdrawal / Owner Drawing"
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={onCloseModal} disabled={saving}>Cancel</button>
            <button className="btn btn-danger" onClick={handleSaveWithdrawal} disabled={saving}>
              {saving ? 'Saving...' : 'Record Withdrawal'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveWithdrawal}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Disbursement Account</label>
              <select
                className="form-select"
                value={withdrawalForm.accountId}
                onChange={e => setWithdrawalForm(f => ({ ...f, accountId: e.target.value }))}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({money(a.currentBalance, currencySymbol)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Withdrawal Type</label>
              <select
                className="form-select"
                value={withdrawalForm.withdrawalType}
                onChange={e => setWithdrawalForm(f => ({ ...f, withdrawalType: e.target.value }))}
              >
                <option value="Owner's Drawing">Owner's Drawing / Personal</option>
                <option value="Partner Share">Partner Profit Share</option>
                <option value="Emergency Cash">Emergency Operations Cash</option>
                <option value="Other Withdrawal">Other Drawing</option>
              </select>
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Withdrawal Amount ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                min="1"
                className="form-input"
                style={{ fontWeight: 700, color: 'var(--red)', fontSize: '1rem' }}
                value={withdrawalForm.amount}
                onChange={e => setWithdrawalForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Withdrawal Date</label>
              <input
                type="date"
                className="form-input"
                value={withdrawalForm.date}
                onChange={e => setWithdrawalForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Withdrawn By</label>
            <input
              className="form-input"
              placeholder="Partner / Authorized Officer Name"
              value={withdrawalForm.withdrawnBy}
              onChange={e => setWithdrawalForm(f => ({ ...f, withdrawnBy: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Purpose / Notes</label>
            <textarea
              className="form-textarea"
              placeholder="Disbursement purpose..."
              value={withdrawalForm.purpose}
              onChange={e => setWithdrawalForm(f => ({ ...f, purpose: e.target.value }))}
              rows={2}
            />
          </div>
        </form>
      </Modal>

      {/* --- MODAL 4: DOUBLE-ENTRY JOURNAL ENTRY --- */}
      <Modal
        isOpen={activeModal === 'journal'}
        onClose={onCloseModal}
        title="Post Double-Entry Journal Entry"
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={onCloseModal} disabled={saving}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSaveJournal}
              disabled={saving || !isJournalBalanced}
            >
              {saving ? 'Posting...' : 'Post Journal Voucher'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveJournal}>
          <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label required">Journal Date</label>
              <input
                type="date"
                className="form-input"
                value={journalForm.date}
                onChange={e => setJournalForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Journal Reference / Voucher #</label>
              <input
                className="form-input"
                placeholder="e.g. JV-2026-001"
                value={journalForm.reference}
                onChange={e => setJournalForm(f => ({ ...f, reference: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label required">Narration / Description</label>
            <input
              className="form-input"
              placeholder="Explain transaction purpose..."
              value={journalForm.description}
              onChange={e => setJournalForm(f => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          {/* Multi-line Journal Rows */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Journal Debit & Credit Lines
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.72rem', color: 'var(--gold)' }}
                onClick={addJournalLine}
              >
                + Add Line
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {journalForm.lines.map((line, idx) => (
                <div key={idx} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid var(--card-border)'
                }}>
                  <div>
                    <select
                      className="form-select"
                      value={line.accountId}
                      onChange={e => updateJournalLine(idx, 'accountId', e.target.value)}
                      required
                    >
                      <optgroup label="Chart of Accounts">
                        {chartOfAccounts.map(coa => (
                          <option key={coa.id} value={coa.id}>
                            [{coa.code}] {coa.name} ({coa.type})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="Debit"
                      value={line.debit}
                      onChange={e => {
                        updateJournalLine(idx, 'debit', e.target.value)
                        if (e.target.value) updateJournalLine(idx, 'credit', '')
                      }}
                    />
                  </div>

                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="Credit"
                      value={line.credit}
                      onChange={e => {
                        updateJournalLine(idx, 'credit', e.target.value)
                        if (e.target.value) updateJournalLine(idx, 'debit', '')
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--red)', padding: '4px 8px' }}
                    onClick={() => removeJournalLine(idx)}
                    title="Remove line"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Double Entry Live Validation Box */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            textAlign: 'center',
            padding: '10px 14px',
            background: isJournalBalanced ? 'rgba(47,212,184,0.08)' : 'rgba(239,100,97,0.08)',
            border: isJournalBalanced ? '1px solid rgba(47,212,184,0.35)' : '1px solid rgba(239,100,97,0.35)',
            borderRadius: 8
          }}>
            <div>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Debit</div>
              <div className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>
                {money(totalJournalDr, currencySymbol)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Credit</div>
              <div className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>
                {money(totalJournalCr, currencySymbol)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Balance Status</div>
              <div style={{ fontWeight: 700, color: isJournalBalanced ? 'var(--teal)' : 'var(--red)', fontSize: '0.85rem' }}>
                {isJournalBalanced ? '✓ Balanced (Dr = Cr)' : `⚠️ Difference: ${money(Math.abs(totalJournalDr - totalJournalCr), currencySymbol)}`}
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
