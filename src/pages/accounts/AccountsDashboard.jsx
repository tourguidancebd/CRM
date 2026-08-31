import { useState, useMemo } from 'react'
import { useAccounts } from '../../contexts/AccountsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { money } from '../../utils/money'
import { formatDate, today } from '../../utils/dateHelpers'

export default function AccountsDashboard({ onNavigateTab, onOpenModal }) {
  const {
    accounts,
    unifiedTransactions,
    customerReceivables,
    vendorPayables,
    profitAndLoss,
    totalCashBalance,
    totalBankBalance,
    totalMobileBalance,
    totalAvailableBalance,
    totalReceivables,
    totalPayables
  } = useAccounts()

  const { currencySymbol } = useSettings()
  const [period, setPeriod] = useState('thisMonth')

  // Filter transactions by selected period
  const filteredTransactions = useMemo(() => {
    const now = new Date()
    const todayStr = today()

    return unifiedTransactions.filter(t => {
      const d = t.date || ''
      if (period === 'today') return d === todayStr
      if (period === 'thisMonth') {
        const monthPrefix = todayStr.slice(0, 7) // 'YYYY-MM'
        return d.startsWith(monthPrefix)
      }
      if (period === 'thisYear') {
        const yearPrefix = todayStr.slice(0, 4) // 'YYYY'
        return d.startsWith(yearPrefix)
      }
      return true
    })
  }, [unifiedTransactions, period])

  const periodIncome = filteredTransactions.filter(t => t.type === 'Income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const periodExpense = filteredTransactions.filter(t => t.type === 'Expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const periodNet = periodIncome - periodExpense

  // Group transactions by days for visual mini-chart
  const dailyTrends = useMemo(() => {
    const map = {}
    filteredTransactions.slice(0, 30).forEach(t => {
      const day = t.date
      if (!map[day]) map[day] = { date: day, income: 0, expense: 0 }
      if (t.type === 'Income') map[day].income += parseFloat(t.amount) || 0
      if (t.type === 'Expense') map[day].expense += parseFloat(t.amount) || 0
    })
    return Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [filteredTransactions])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Period Filter Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Reporting Period:
          </span>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 3, borderRadius: 6 }}>
            {[
              ['today', 'Today'],
              ['thisMonth', 'This Month'],
              ['thisYear', 'This Year'],
              ['all', 'All Time']
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`btn btn-sm ${period === k ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                onClick={() => setPeriod(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-teal btn-sm" onClick={() => onOpenModal('income')}>
            + Money In
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onOpenModal('expense')}>
            - Money Out
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onOpenModal('transfer')}>
            ⇄ Fund Transfer
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onOpenModal('journal')}>
            + Journal Entry
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (4 Pillars) */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="kpi-card gold">
          <div className="kpi-label">Total Available Liquidity</div>
          <div className="kpi-value gold">{money(totalAvailableBalance, currencySymbol)}</div>
          <div className="kpi-sub" style={{ color: 'var(--text-muted)' }}>
            Cash + Bank + Mobile Banking
          </div>
        </div>

        <div className="kpi-card teal">
          <div className="kpi-label">Period Collections / Inflow</div>
          <div className="kpi-value teal">{money(periodIncome, currencySymbol)}</div>
          <div className="kpi-sub" style={{ color: 'var(--teal)' }}>
            {filteredTransactions.filter(t => t.type === 'Income').length} receipts logged
          </div>
        </div>

        <div className="kpi-card red">
          <div className="kpi-label">Period Expenses / Outflow</div>
          <div className="kpi-value red">{money(periodExpense, currencySymbol)}</div>
          <div className="kpi-sub" style={{ color: 'var(--red)' }}>
            {filteredTransactions.filter(t => t.type === 'Expense').length} vouchers paid
          </div>
        </div>

        <div className={`kpi-card ${periodNet >= 0 ? 'teal' : 'red'}`}>
          <div className="kpi-label">Period Net Cash Surplus</div>
          <div className={`kpi-value ${periodNet >= 0 ? 'teal' : 'red'}`}>
            {money(periodNet, currencySymbol)}
          </div>
          <div className="kpi-sub" style={{ color: 'var(--text-muted)' }}>
            Cash In minus Cash Out
          </div>
        </div>
      </div>

      {/* Account Balances Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* 1. Account Balances Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              🏦 Liquidity Accounts Breakdown
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('masters')} style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>
              Manage Accounts →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Cash in Hand */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid var(--card-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.2rem' }}>💵</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Total Cash Vault</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {accounts.filter(a => a.type === 'cash').length} Cash registers
                  </div>
                </div>
              </div>
              <div className="mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--teal)' }}>
                {money(totalCashBalance, currencySymbol)}
              </div>
            </div>

            {/* Bank Accounts */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid var(--card-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.2rem' }}>🏛️</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Corporate Bank Accounts</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {accounts.filter(a => a.type === 'bank').length} Active bank accounts
                  </div>
                </div>
              </div>
              <div className="mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gold)' }}>
                {money(totalBankBalance, currencySymbol)}
              </div>
            </div>

            {/* Mobile Banking */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid var(--card-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.2rem' }}>📱</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Mobile Banking Wallets</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>bKash / Nagad / Rocket</div>
                </div>
              </div>
              <div className="mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--teal)' }}>
                {money(totalMobileBalance, currencySymbol)}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Receivables vs Payables Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              ⚖️ Receivables vs Payables
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('receivables')} style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>
              View Ledgers →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              padding: '12px 14px',
              background: 'rgba(239,100,97,0.06)',
              border: '1px solid rgba(239,100,97,0.25)',
              borderRadius: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Customer Receivables (Pending Dues)
                </span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--red)', fontSize: '0.95rem' }}>
                  {money(totalReceivables, currencySymbol)}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {customerReceivables.filter(c => c.totalDue > 0).length} customer(s) with outstanding trip balances
              </div>
            </div>

            <div style={{
              padding: '12px 14px',
              background: 'rgba(232,169,59,0.06)',
              border: '1px solid rgba(232,169,59,0.25)',
              borderRadius: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Vendor & Hotel Payables (Due Bills)
                </span>
                <span className="mono" style={{ fontWeight: 700, color: '#E8A93B', fontSize: '0.95rem' }}>
                  {money(totalPayables, currencySymbol)}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {vendorPayables.filter(v => v.totalDue > 0).length} supplier(s) with pending disbursements
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 6
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Net Working Capital (Receivables − Payables):</span>
              <span className="mono" style={{ fontWeight: 700, color: (totalReceivables - totalPayables) >= 0 ? 'var(--teal)' : 'var(--red)' }}>
                {money(totalReceivables - totalPayables, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            ⚡ Recent Accounting Transactions
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('transactions')} style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>
            Full Transaction Center →
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tx ID</th>
                <th>Type</th>
                <th>Account</th>
                <th>Entity / Payee</th>
                <th>Description</th>
                <th className="text-right">Debit (In)</th>
                <th className="text-right">Credit (Out)</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.slice(0, 8).map(t => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{t.id}</td>
                  <td>
                    <span className={`pill ${t.type === 'Income' || t.type === 'Deposit' ? 'pill-paid' : t.type === 'Expense' || t.type === 'Payment' ? 'pill-due' : 'pill-gold'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{t.accountName}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{t.entityName || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 220 }} className="truncate">{t.description}</td>
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
    </div>
  )
}
