import { useState } from 'react'
import { AccountsProvider, useAccounts } from '../../contexts/AccountsContext'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import AccountsDashboard from './AccountsDashboard'
import AccountsMaster from './AccountsMaster'
import TransactionsCenter from './TransactionsCenter'
import ReceivablesPayables from './ReceivablesPayables'
import FinancialReports from './FinancialReports'
import AccountsSettings from './AccountsSettings'

function AccountsHubInner() {
  const { loading } = useAccounts()
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'masters' | 'transactions' | 'receivables' | 'reports' | 'settings'
  const [activeModal, setActiveModal] = useState(null) // 'transfer' | 'deposit' | 'withdrawal' | 'journal' | 'income' | 'expense'

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading Banking & Accounting Ledgers..." />
      </div>
    )
  }

  const TABS = [
    { id: 'dashboard', label: '📊 Accounts Dashboard' },
    { id: 'masters', label: '🏛️ Bank & Cash Accounts' },
    { id: 'transactions', label: '⚡ Transactions & Transfers' },
    { id: 'receivables', label: '👥 Receivables & Payables' },
    { id: 'reports', label: '📑 Financial Statements' },
    { id: 'settings', label: '⚙️ COA & Settings' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Banking & Accounts Management</h1>
          <p className="page-subtitle">
            Corporate banking, multi-account liquidity, double-entry general ledger, and financial statements
          </p>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div style={{
        display: 'flex',
        gap: 6,
        borderBottom: '1px solid var(--card-border)',
        paddingBottom: 10,
        overflowX: 'auto'
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600, padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main View Area */}
      {activeTab === 'dashboard' && (
        <AccountsDashboard
          onNavigateTab={setActiveTab}
          onOpenModal={setActiveModal}
        />
      )}

      {activeTab === 'masters' && (
        <AccountsMaster />
      )}

      {activeTab === 'transactions' && (
        <TransactionsCenter
          activeModal={activeModal}
          onOpenModal={setActiveModal}
          onCloseModal={() => setActiveModal(null)}
        />
      )}

      {activeTab === 'receivables' && (
        <ReceivablesPayables />
      )}

      {activeTab === 'reports' && (
        <FinancialReports />
      )}

      {activeTab === 'settings' && (
        <AccountsSettings />
      )}

      {/* Global Modals Triggered from Dashboard */}
      {activeTab !== 'transactions' && activeModal && (
        <TransactionsCenter
          activeModal={activeModal}
          onOpenModal={setActiveModal}
          onCloseModal={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}

export default function AccountsHub() {
  return (
    <AccountsProvider>
      <AccountsHubInner />
    </AccountsProvider>
  )
}
