import { useState } from 'react'
import { useAccounts } from '../../contexts/AccountsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useToast } from '../../hooks/useToast'
import { money } from '../../utils/money'
import { formatDate, today } from '../../utils/dateHelpers'
import { generateGeneralLedger } from '../../services/accountsEngine'
import { printHtml, downloadHtml, buildLetterheadDoc, escapeHtml } from '../../utils/printService'
import { Modal } from '../../components/common/Modal'

export default function FinancialReports() {
  const {
    accounts,
    unifiedTransactions,
    profitAndLoss,
    balanceSheet,
    trialBalance,
    cashFlow,
    cashClosings,
    bankReconciliations,
    addCashClosing,
    saveBankReconciliation
  } = useAccounts()

  const { settings, currencySymbol } = useSettings()
  const { success, error: toastError } = useToast()

  const [activeReport, setActiveReport] = useState('pl') // 'pl' | 'bs' | 'tb' | 'gl' | 'cf' | 'cash_report' | 'reconciliation'

  // GL Filters
  const [glAccount, setGlAccount] = useState(accounts[0]?.id || '')
  const [glStartDate, setGlStartDate] = useState('')
  const [glEndDate, setGlEndDate] = useState('')

  // Daily Cash Closing Modal
  const [closingModalOpen, setClosingModalOpen] = useState(false)
  const [cashClosingForm, setCashClosingForm] = useState({
    date: today(),
    actualCash: '',
    note: ''
  })

  // Bank Reconciliation Modal
  const [recModalOpen, setRecModalOpen] = useState(false)
  const [recForm, setRecForm] = useState({
    bankAccountId: accounts.find(a => a.type === 'bank')?.id || accounts[0]?.id || '',
    statementDate: today(),
    statementBalance: '',
    notes: ''
  })

  // Compute General Ledger for selected account
  const glData = generateGeneralLedger({
    transactions: unifiedTransactions,
    accountId: glAccount || null,
    startDate: glStartDate || null,
    endDate: glEndDate || null
  })

  const selectedAccountObj = accounts.find(a => a.id === glAccount) || accounts[0]

  // Daily Cash Calculations
  const todayStr = today()
  const todayTransactions = unifiedTransactions.filter(t => t.date === todayStr)
  const todayCashReceived = todayTransactions.filter(t => t.type === 'Income' || t.type === 'Deposit').reduce((s, t) => s + (parseFloat(t.debit) || 0), 0)
  const todayCashPaid = todayTransactions.filter(t => t.type === 'Expense' || t.type === 'Payment' || t.type === 'Withdrawal').reduce((s, t) => s + (parseFloat(t.credit) || 0), 0)
  const openingDailyCash = 25000
  const expectedDailyCash = openingDailyCash + todayCashReceived - todayCashPaid

  const handleSaveCashClosing = async (e) => {
    e.preventDefault()
    const actual = parseFloat(cashClosingForm.actualCash) || 0
    const diff = actual - expectedDailyCash

    try {
      await addCashClosing({
        ...cashClosingForm,
        openingCash: openingDailyCash,
        cashReceived: todayCashReceived,
        cashPaid: todayCashPaid,
        expectedCash: expectedDailyCash,
        actualCash: actual,
        difference: diff,
        closedAt: new Date().toISOString()
      })
      success('Daily cash closing recorded successfully')
      setClosingModalOpen(false)
    } catch (err) {
      toastError('Cash closing failed: ' + err.message)
    }
  }

  const handleSaveReconciliation = async (e) => {
    e.preventDefault()
    const stmtBal = parseFloat(recForm.statementBalance) || 0
    const targetAcc = accounts.find(a => a.id === recForm.bankAccountId)
    const sysBal = targetAcc?.currentBalance || 0
    const diff = stmtBal - sysBal

    try {
      await saveBankReconciliation({
        ...recForm,
        systemBalance: sysBal,
        difference: diff,
        status: Math.abs(diff) < 1 ? 'Reconciled' : 'Discrepancy'
      })
      success('Bank reconciliation recorded')
      setRecModalOpen(false)
    } catch (err) {
      toastError('Reconciliation failed: ' + err.message)
    }
  }

  const handlePrintCurrentReport = () => {
    let title = 'Financial Report'
    let body = ''

    if (activeReport === 'pl') {
      title = 'Profit & Loss Statement (Income Statement)'
      body = `
        <div class="doc-title" style="font-size: 20px; font-weight: 800; text-align: center; color: #0A0F1C; margin-top: 10px;">PROFIT & LOSS STATEMENT</div>
        <div style="text-align: center; color: #777; font-size: 11px; margin-bottom: 18px;">Comprehensive Income Statement</div>

        <table class="doc-table">
          <thead><tr><th>Revenue Categories</th><th style="text-align: right;">Amount</th></tr></thead>
          <tbody>
            ${Object.entries(profitAndLoss.revenueCategories).map(([cat, val]) => `
              <tr><td>${escapeHtml(cat)}</td><td style="text-align: right; font-family: monospace;">${money(val, currencySymbol)}</td></tr>
            `).join('')}
            <tr style="background: #f2f9f6; font-weight: 700;"><td>Gross Sales Revenue</td><td style="text-align: right; color: #166534; font-family: monospace;">${money(profitAndLoss.grossRevenue, currencySymbol)}</td></tr>
            <tr><td>Less: Sales Discounts & Reductions</td><td style="text-align: right; color: #991b1b; font-family: monospace;">-${money(profitAndLoss.totalSalesDiscount, currencySymbol)}</td></tr>
            <tr style="background: #faf8f3; font-weight: 800;"><td>NET OPERATING REVENUE</td><td style="text-align: right; font-family: monospace; font-size: 15px;">${money(profitAndLoss.netRevenue, currencySymbol)}</td></tr>
          </tbody>
        </table>

        <div style="margin-top: 20px; font-weight: 700; font-size: 14px;">Operating & Direct Expenses</div>
        <table class="doc-table" style="margin-top: 8px;">
          <thead><tr><th>Expense Category</th><th style="text-align: right;">Amount</th></tr></thead>
          <tbody>
            ${Object.entries(profitAndLoss.expenseCategories).map(([cat, val]) => `
              <tr><td>${escapeHtml(cat)}</td><td style="text-align: right; font-family: monospace; color: #991b1b;">${money(val, currencySymbol)}</td></tr>
            `).join('')}
            <tr style="background: #fff8f8; font-weight: 800;"><td>TOTAL EXPENSES</td><td style="text-align: right; font-family: monospace; color: #991b1b; font-size: 15px;">${money(profitAndLoss.totalExpenses, currencySymbol)}</td></tr>
          </tbody>
        </table>

        <div style="margin-top: 24px; padding: 16px; background: #fdfaf2; border: 2px solid #C9A24B; border-radius: 8px; text-align: center;">
          <div style="font-size: 12px; text-transform: uppercase; color: #666;">NET OPERATING PROFIT</div>
          <div style="font-size: 26px; font-weight: 800; font-family: monospace; color: ${profitAndLoss.netProfit >= 0 ? '#166534' : '#991b1b'};">
            ${money(profitAndLoss.netProfit, currencySymbol)} (${profitAndLoss.netProfitMargin}% Margin)
          </div>
        </div>
      `
    } else if (activeReport === 'bs') {
      title = 'Balance Sheet Statement'
      body = `
        <div class="doc-title" style="font-size: 20px; font-weight: 800; text-align: center; color: #0A0F1C; margin-top: 10px;">BALANCE SHEET</div>
        <div style="text-align: center; color: #777; font-size: 11px; margin-bottom: 18px;">Statement of Financial Position (Assets = Liabilities + Equity)</div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px; color: #166534;">ASSETS</div>
            <table class="doc-table">
              <tr><td>Cash in Hand</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.assets.totalCash, currencySymbol)}</td></tr>
              <tr><td>Bank Accounts</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.assets.totalBank, currencySymbol)}</td></tr>
              <tr><td>Mobile Banking Wallets</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.assets.totalMobile, currencySymbol)}</td></tr>
              <tr><td>Accounts Receivable</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.assets.totalReceivables, currencySymbol)}</td></tr>
              <tr><td>Fixed Assets & Equipment</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.assets.otherAssets, currencySymbol)}</td></tr>
              <tr style="background: #f2f9f6; font-weight: 800;"><td>TOTAL ASSETS</td><td style="text-align: right; font-family: monospace; color: #166534; font-size: 15px;">${money(balanceSheet.assets.totalAssets, currencySymbol)}</td></tr>
            </table>
          </div>

          <div>
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px; color: #991b1b;">LIABILITIES & EQUITY</div>
            <table class="doc-table">
              <tr><td>Accounts Payable</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.liabilities.totalPayables, currencySymbol)}</td></tr>
              <tr><td>Customer Advances</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.liabilities.customerAdvances, currencySymbol)}</td></tr>
              <tr><td>Tax & VAT Payable</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.liabilities.taxPayable, currencySymbol)}</td></tr>
              <tr style="background: #fff8f8; font-weight: 700;"><td>Total Liabilities</td><td style="text-align: right; font-family: monospace; color: #991b1b;">${money(balanceSheet.liabilities.totalLiabilities, currencySymbol)}</td></tr>
              <tr><td>Owner's Capital</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.equity.ownerCapital, currencySymbol)}</td></tr>
              <tr><td>Retained Earnings</td><td style="text-align: right; font-family: monospace;">${money(balanceSheet.equity.retainedEarnings, currencySymbol)}</td></tr>
              <tr style="background: #faf8f3; font-weight: 800;"><td>TOTAL LIABILITIES & EQUITY</td><td style="text-align: right; font-family: monospace; color: #0A0F1C; font-size: 15px;">${money(balanceSheet.totalLiabilitiesAndEquity, currencySymbol)}</td></tr>
            </table>
          </div>
        </div>
      `
    } else {
      title = 'Trial Balance Report'
      body = `
        <div class="doc-title" style="font-size: 20px; font-weight: 800; text-align: center; color: #0A0F1C; margin-top: 10px;">TRIAL BALANCE</div>
        <div style="text-align: center; color: #777; font-size: 11px; margin-bottom: 18px;">Debit & Credit Ledger Balance Verification</div>

        <table class="doc-table">
          <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th style="text-align: right;">Debit</th><th style="text-align: right;">Credit</th></tr></thead>
          <tbody>
            ${trialBalance.lines.map(l => `
              <tr>
                <td style="font-family: monospace;">${l.code}</td>
                <td><b>${escapeHtml(l.name)}</b></td>
                <td>${l.type}</td>
                <td style="text-align: right; font-family: monospace; color: #166534;">${l.debit > 0 ? money(l.debit, currencySymbol) : '—'}</td>
                <td style="text-align: right; font-family: monospace; color: #991b1b;">${l.credit > 0 ? money(l.credit, currencySymbol) : '—'}</td>
              </tr>
            `).join('')}
            <tr style="background: #faf8f3; font-weight: 800; font-size: 15px;">
              <td colspan="3" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right; font-family: monospace; color: #166534;">${money(trialBalance.totalDebit, currencySymbol)}</td>
              <td style="text-align: right; font-family: monospace; color: #991b1b;">${money(trialBalance.totalCredit, currencySymbol)}</td>
            </tr>
          </tbody>
        </table>
      `
    }

    const html = buildLetterheadDoc({
      title,
      content: body,
      company: settings?.company
    })
    printHtml(html, title.replace(/[^a-zA-Z0-9]/g, '-'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Navigation Sub-Tabs Bar */}
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
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            ['pl', '📊 Profit & Loss'],
            ['bs', '⚖️ Balance Sheet'],
            ['tb', '📑 Trial Balance'],
            ['gl', '📖 General Ledger'],
            ['cf', '🌊 Cash Flow'],
            ['cash_report', '💵 Daily Cash Report'],
            ['reconciliation', '🏦 Bank Reconciliation']
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${activeReport === k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveReport(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <button className="btn btn-teal btn-sm" onClick={handlePrintCurrentReport}>
          🖨️ Print Report
        </button>
      </div>

      {/* REPORT 1: PROFIT & LOSS */}
      {activeReport === 'pl' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Profit & Loss Statement (Income Statement)
            </h3>
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600 }}>
              Fiscal Year: 2026-2027
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {/* Revenue Section */}
            <div style={{
              background: 'rgba(47,212,184,0.03)',
              border: '1px solid rgba(47,212,184,0.2)',
              borderRadius: 8,
              padding: 16
            }}>
              <h4 style={{ color: 'var(--teal)', fontSize: '0.88rem', textTransform: 'uppercase', marginBottom: 12 }}>
                1. Operating Revenue & Ticket Sales
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(profitAndLoss.revenueCategories).map(([cat, val]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {money(val, currencySymbol)}
                    </span>
                  </div>
                ))}
                <div style={{ height: 1, background: 'var(--card-border)', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', fontWeight: 700 }}>
                  <span style={{ color: 'var(--teal)' }}>Net Operating Revenue</span>
                  <span className="mono" style={{ color: 'var(--teal)' }}>
                    {money(profitAndLoss.netRevenue, currencySymbol)}
                  </span>
                </div>
              </div>
            </div>

            {/* Operating Expenses Section */}
            <div style={{
              background: 'rgba(239,100,97,0.03)',
              border: '1px solid rgba(239,100,97,0.2)',
              borderRadius: 8,
              padding: 16
            }}>
              <h4 style={{ color: 'var(--red)', fontSize: '0.88rem', textTransform: 'uppercase', marginBottom: 12 }}>
                2. Direct & Operating Expenses
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(profitAndLoss.expenseCategories).map(([cat, val]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--red)' }}>
                      {money(val, currencySymbol)}
                    </span>
                  </div>
                ))}
                <div style={{ height: 1, background: 'var(--card-border)', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', fontWeight: 700 }}>
                  <span style={{ color: 'var(--red)' }}>Total Expenses</span>
                  <span className="mono" style={{ color: 'var(--red)' }}>
                    {money(profitAndLoss.totalExpenses, currencySymbol)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Profit Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(201,162,75,0.08)',
            border: '2px solid rgba(201,162,75,0.3)',
            borderRadius: 8,
            padding: '16px 24px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                Net Operating Profit (Before Tax)
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Net Profit Margin: <b>{profitAndLoss.netProfitMargin}%</b>
              </div>
            </div>
            <div className="mono" style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: profitAndLoss.netProfit >= 0 ? 'var(--teal)' : 'var(--red)'
            }}>
              {money(profitAndLoss.netProfit, currencySymbol)}
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: BALANCE SHEET */}
      {activeReport === 'bs' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Balance Sheet (Statement of Financial Position)
            </h3>
            <span style={{
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: '0.75rem',
              fontWeight: 700,
              background: balanceSheet.isBalanced ? 'rgba(47,212,184,0.18)' : 'rgba(239,100,97,0.18)',
              color: balanceSheet.isBalanced ? 'var(--teal)' : 'var(--red)'
            }}>
              {balanceSheet.isBalanced ? '✓ Equation Balanced (Assets = Liab + Eq)' : '⚠️ Unbalanced'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            {/* Assets */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <h4 style={{ color: 'var(--teal)', fontSize: '0.9rem', marginBottom: 12 }}>1. TOTAL ASSETS</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash in Hand (Vault)</span>
                  <span className="mono">{money(balanceSheet.assets.totalCash, currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bank Accounts</span>
                  <span className="mono">{money(balanceSheet.assets.totalBank, currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mobile Banking Wallets</span>
                  <span className="mono">{money(balanceSheet.assets.totalMobile, currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Accounts Receivable (Customer Dues)</span>
                  <span className="mono">{money(balanceSheet.assets.totalReceivables, currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Equipment & Fixed Assets</span>
                  <span className="mono">{money(balanceSheet.assets.otherAssets, currencySymbol)}</span>
                </div>
                <div style={{ height: 1, background: 'var(--card-border)', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--teal)' }}>
                  <span>TOTAL ASSETS</span>
                  <span className="mono">{money(balanceSheet.assets.totalAssets, currencySymbol)}</span>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <h4 style={{ color: 'var(--gold)', fontSize: '0.9rem', marginBottom: 12 }}>2. LIABILITIES & EQUITY</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Accounts Payable (Vendor Bills)</span>
                  <span className="mono">{money(balanceSheet.liabilities.totalPayables, currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Customer Advances & Deposits</span>
                  <span className="mono">{money(balanceSheet.liabilities.customerAdvances, currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tax & VAT Payable</span>
                  <span className="mono">{money(balanceSheet.liabilities.taxPayable, currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--red)' }}>
                  <span>Total Liabilities</span>
                  <span className="mono">{money(balanceSheet.liabilities.totalLiabilities, currencySymbol)}</span>
                </div>
                <div style={{ height: 1, background: 'var(--card-border)', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Owner's Capital</span>
                  <span className="mono">{money(balanceSheet.equity.ownerCapital, currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Retained Earnings</span>
                  <span className="mono">{money(balanceSheet.equity.retainedEarnings, currencySymbol)}</span>
                </div>
                <div style={{ height: 1, background: 'var(--card-border)', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--gold)' }}>
                  <span>TOTAL LIAB. & EQUITY</span>
                  <span className="mono">{money(balanceSheet.totalLiabilitiesAndEquity, currencySymbol)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 3: TRIAL BALANCE */}
      {activeReport === 'tb' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Trial Balance (Debit = Credit Verification)
            </h3>
            <span className="mono" style={{ color: 'var(--teal)', fontWeight: 700 }}>
              Status: {trialBalance.isBalanced ? '✓ Balanced' : '⚠️ Discrepancy'}
            </span>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th className="text-right">Debit Balance</th>
                  <th className="text-right">Credit Balance</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.lines.map(l => (
                  <tr key={l.id}>
                    <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{l.code}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.name}</td>
                    <td><span className="pill pill-gold">{l.type}</span></td>
                    <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: l.debit > 0 ? 700 : 400 }}>
                      {l.debit > 0 ? money(l.debit, currencySymbol) : '—'}
                    </td>
                    <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: l.credit > 0 ? 700 : 400 }}>
                      {l.credit > 0 ? money(l.credit, currencySymbol) : '—'}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(201,162,75,0.08)', fontWeight: 800 }}>
                  <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.95rem' }}>TOTAL EQUALITY:</td>
                  <td className="mono text-right" style={{ color: 'var(--teal)', fontSize: '1rem' }}>
                    {money(trialBalance.totalDebit, currencySymbol)}
                  </td>
                  <td className="mono text-right" style={{ color: 'var(--red)', fontSize: '1rem' }}>
                    {money(trialBalance.totalCredit, currencySymbol)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: GENERAL LEDGER */}
      {activeReport === 'gl' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              General Ledger Account Statement
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ width: 220 }}
                value={glAccount}
                onChange={e => setGlAccount(e.target.value)}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tx #</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {glData.entries.map(e => (
                  <tr key={e.id}>
                    <td>{formatDate(e.date)}</td>
                    <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{e.id}</td>
                    <td><span className="pill pill-gold">{e.type}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{e.description}</td>
                    <td className="mono text-right" style={{ color: 'var(--teal)', fontWeight: e.debit > 0 ? 700 : 400 }}>
                      {e.debit > 0 ? money(e.debit, currencySymbol) : '—'}
                    </td>
                    <td className="mono text-right" style={{ color: 'var(--red)', fontWeight: e.credit > 0 ? 700 : 400 }}>
                      {e.credit > 0 ? money(e.credit, currencySymbol) : '—'}
                    </td>
                    <td className="mono text-right" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {money(e.runningBalance, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 5: CASH FLOW STATEMENT */}
      {activeReport === 'cf' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Cash Flow Statement (Operating, Investing, Financing)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <div style={{ fontWeight: 700, color: 'var(--teal)', marginBottom: 8 }}>1. Cash Flows from Operating Activities</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                <span>Customer Collections & Ticket Sales</span>
                <span className="mono">+{money(cashFlow.operating.customerCollections, currencySymbol)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                <span>Supplier & Hotel Disbursements</span>
                <span className="mono" style={{ color: 'var(--red)' }}>-{money(cashFlow.operating.supplierDisbursements, currencySymbol)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                <span>Operational & Administrative Expenses</span>
                <span className="mono" style={{ color: 'var(--red)' }}>-{money(cashFlow.operating.operationalExpenses, currencySymbol)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6, borderTop: '1px solid var(--card-border)', paddingTop: 6 }}>
                <span>Net Cash from Operations</span>
                <span className="mono" style={{ color: 'var(--teal)' }}>{money(cashFlow.operating.netOperatingCash, currencySymbol)}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>2. Cash Flows from Financing Activities</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                <span>Owner Capital Injections</span>
                <span className="mono">+{money(cashFlow.financing.ownerInvestments, currencySymbol)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                <span>Owner Drawings & Withdrawals</span>
                <span className="mono" style={{ color: 'var(--red)' }}>-{money(cashFlow.financing.ownerDrawings, currencySymbol)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6, borderTop: '1px solid var(--card-border)', paddingTop: 6 }}>
                <span>Net Cash from Financing</span>
                <span className="mono" style={{ color: 'var(--gold)' }}>{money(cashFlow.financing.netFinancingCash, currencySymbol)}</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              background: 'rgba(201,162,75,0.08)',
              border: '1px solid rgba(201,162,75,0.3)',
              borderRadius: 8
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Net Net Increase in Cash & Liquid Equities</span>
              <span className="mono" style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--teal)' }}>
                {money(cashFlow.netCashChange, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 6: DAILY CASH REPORT & CLOSING */}
      {activeReport === 'cash_report' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Daily Cash Reconciliation & Vault Closing
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Date: {today()}</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setClosingModalOpen(true)}>
              🔒 Perform Daily Cash Closing
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            textAlign: 'center'
          }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Opening Vault Cash</div>
              <div className="mono" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{money(openingDailyCash, currencySymbol)}</div>
            </div>

            <div style={{ background: 'rgba(47,212,184,0.04)', padding: 12, borderRadius: 8, border: '1px solid rgba(47,212,184,0.25)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--teal)', textTransform: 'uppercase' }}>Today's Cash Received</div>
              <div className="mono" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--teal)' }}>+{money(todayCashReceived, currencySymbol)}</div>
            </div>

            <div style={{ background: 'rgba(239,100,97,0.04)', padding: 12, borderRadius: 8, border: '1px solid rgba(239,100,97,0.25)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--red)', textTransform: 'uppercase' }}>Today's Cash Paid</div>
              <div className="mono" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--red)' }}>-{money(todayCashPaid, currencySymbol)}</div>
            </div>

            <div style={{ background: 'rgba(201,162,75,0.06)', padding: 12, borderRadius: 8, border: '1px solid rgba(201,162,75,0.3)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--gold)', textTransform: 'uppercase' }}>Expected Closing Cash</div>
              <div className="mono" style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--gold)' }}>{money(expectedDailyCash, currencySymbol)}</div>
            </div>
          </div>

          {/* Past Closings Log */}
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 10 }}>Recent Daily Cash Closings History</h4>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Expected Cash</th>
                    <th>Actual Cash</th>
                    <th>Discrepancy / Diff</th>
                    <th>Notes</th>
                    <th>Closed At</th>
                  </tr>
                </thead>
                <tbody>
                  {cashClosings.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No cash closings recorded yet.</td></tr>
                  ) : cashClosings.map(c => (
                    <tr key={c.id}>
                      <td>{formatDate(c.date)}</td>
                      <td className="mono">{money(c.expectedCash, currencySymbol)}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{money(c.actualCash, currencySymbol)}</td>
                      <td className="mono" style={{ color: Math.abs(c.difference) < 1 ? 'var(--teal)' : 'var(--red)', fontWeight: 700 }}>
                        {money(c.difference, currencySymbol)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.note || '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.closedAt?.slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 7: BANK RECONCILIATION */}
      {activeReport === 'reconciliation' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Bank Reconciliation Statements
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Match external bank statement balances against system ledger records
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setRecModalOpen(true)}>
              + Reconcile Account
            </button>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bank Account</th>
                  <th>Statement Date</th>
                  <th className="text-right">Statement Balance</th>
                  <th className="text-right">System Balance</th>
                  <th className="text-right">Difference</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {bankReconciliations.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No reconciliations recorded yet.</td></tr>
                ) : bankReconciliations.map(r => {
                  const bAcc = accounts.find(a => a.id === r.bankAccountId)
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{bAcc?.name || r.bankAccountId}</td>
                      <td>{formatDate(r.statementDate)}</td>
                      <td className="mono text-right">{money(r.statementBalance, currencySymbol)}</td>
                      <td className="mono text-right">{money(r.systemBalance, currencySymbol)}</td>
                      <td className="mono text-right" style={{ color: Math.abs(r.difference) < 1 ? 'var(--teal)' : 'var(--red)', fontWeight: 700 }}>
                        {money(r.difference, currencySymbol)}
                      </td>
                      <td>
                        <span className={`pill ${r.status === 'Reconciled' ? 'pill-paid' : 'pill-due'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Closing Modal */}
      <Modal
        isOpen={closingModalOpen}
        onClose={() => setClosingModalOpen(false)}
        title="Daily Vault Cash Closing"
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setClosingModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveCashClosing}>Confirm & Lock Closing</button>
          </>
        }
      >
        <form onSubmit={handleSaveCashClosing}>
          <div style={{ marginBottom: 14, padding: 12, background: 'rgba(201,162,75,0.06)', borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span>Expected System Cash:</span>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--gold)' }}>{money(expectedDailyCash, currencySymbol)}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Actual Counted Cash in Vault ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--teal)' }}
              value={cashClosingForm.actualCash}
              onChange={e => setCashClosingForm(f => ({ ...f, actualCash: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Closing Remarks & Discrepancy Reason</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Exact match with physical vault count..."
              value={cashClosingForm.note}
              onChange={e => setCashClosingForm(f => ({ ...f, note: e.target.value }))}
              rows={2}
            />
          </div>
        </form>
      </Modal>

      {/* Bank Reconciliation Modal */}
      <Modal
        isOpen={recModalOpen}
        onClose={() => setRecModalOpen(false)}
        title="Perform Bank Account Reconciliation"
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setRecModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveReconciliation}>Save Reconciliation</button>
          </>
        }
      >
        <form onSubmit={handleSaveReconciliation}>
          <div className="form-group">
            <label className="form-label required">Select Bank Account</label>
            <select
              className="form-select"
              value={recForm.bankAccountId}
              onChange={e => setRecForm(f => ({ ...f, bankAccountId: e.target.value }))}
            >
              {accounts.filter(a => a.type === 'bank').map(a => (
                <option key={a.id} value={a.id}>{a.name} ({money(a.currentBalance, currencySymbol)})</option>
              ))}
            </select>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Bank Statement Balance</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={recForm.statementBalance}
                onChange={e => setRecForm(f => ({ ...f, statementBalance: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Statement Date</label>
              <input
                type="date"
                className="form-input"
                value={recForm.statementDate}
                onChange={e => setRecForm(f => ({ ...f, statementDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reconciliation Notes</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Matched with official e-statement..."
              value={recForm.notes}
              onChange={e => setRecForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
