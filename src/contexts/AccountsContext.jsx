import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../hooks/useToast'
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CHART_OF_ACCOUNTS,
  buildUnifiedTransactions,
  calculateAccountBalances,
  calculateCustomerReceivables,
  calculateVendorPayables,
  generateProfitAndLossReport,
  generateBalanceSheet,
  generateGeneralLedger,
  generateTrialBalance,
  generateCashFlowStatement
} from '../services/accountsEngine'

const AccountsContext = createContext(null)

export function AccountsProvider({ children }) {
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS)
  const [chartOfAccounts, setChartOfAccounts] = useState(DEFAULT_CHART_OF_ACCOUNTS)
  const [transfers, setTransfers] = useState([])
  const [deposits, setDeposits] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [journalEntries, setJournalEntries] = useState([])
  const [bankReconciliations, setBankReconciliations] = useState([])
  const [cashClosings, setCashClosings] = useState([])
  const [fiscalYear, setFiscalYear] = useState({ name: 'FY 2026-2027', startDate: '2026-01-01', endDate: '2026-12-31', status: 'Open' })

  // CRM Data
  const [invoices, setInvoices] = useState([])
  const [receipts, setReceipts] = useState([])
  const [expenses, setExpenses] = useState([])
  const [vendors, setVendors] = useState([])
  const [vendorPayments, setVendorPayments] = useState([])
  const [customers, setCustomers] = useState([])

  const [loading, setLoading] = useState(true)
  const { error: toastError } = useToast()

  // Load Accounts & CRM state
  const loadAccountsData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        settingsRes,
        invRes,
        rcptRes,
        expRes,
        vendRes,
        vendPayRes,
        custRes
      ] = await Promise.all([
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('invoices').select('*, customers(name, mobile)').order('created_at', { ascending: false }),
        supabase.from('receipts').select('*, customers(name, mobile)').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('vendors').select('*').order('name'),
        supabase.from('vendor_payments').select('*, vendors(name)').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('name')
      ])

      const accountsStorage = settingsRes.data?.data?.accountsData || {}

      if (accountsStorage.accounts && accountsStorage.accounts.length > 0) {
        setAccounts(accountsStorage.accounts)
      } else {
        setAccounts(DEFAULT_ACCOUNTS)
      }

      if (accountsStorage.chartOfAccounts && accountsStorage.chartOfAccounts.length > 0) {
        setChartOfAccounts(accountsStorage.chartOfAccounts)
      }

      if (accountsStorage.transfers) setTransfers(accountsStorage.transfers)
      if (accountsStorage.deposits) setDeposits(accountsStorage.deposits)
      if (accountsStorage.withdrawals) setWithdrawals(accountsStorage.withdrawals)
      if (accountsStorage.journalEntries) setJournalEntries(accountsStorage.journalEntries)
      if (accountsStorage.bankReconciliations) setBankReconciliations(accountsStorage.bankReconciliations)
      if (accountsStorage.cashClosings) setCashClosings(accountsStorage.cashClosings)
      if (accountsStorage.fiscalYear) setFiscalYear(accountsStorage.fiscalYear)

      if (invRes.data) setInvoices(invRes.data)
      if (rcptRes.data) setReceipts(rcptRes.data)
      if (expRes.data) setExpenses(expRes.data)
      if (vendRes.data) setVendors(vendRes.data)
      if (vendPayRes.data) setVendorPayments(vendPayRes.data)
      if (custRes.data) setCustomers(custRes.data)
    } catch (err) {
      console.warn('Error loading accounts data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAccountsData()
  }, [loadAccountsData])

  // Helper to persist accountsData directly to Supabase settings row id=1
  const persistAccountsData = async (updates) => {
    try {
      const { data: currentSettings } = await supabase.from('settings').select('*').eq('id', 1).single()
      const existingData = currentSettings?.data || {}
      const existingAccountsData = existingData.accountsData || {}

      const updatedAccountsData = {
        ...existingAccountsData,
        ...updates
      }

      const mergedData = {
        ...existingData,
        accountsData: updatedAccountsData
      }

      await supabase.from('settings').upsert({ id: 1, data: mergedData })
    } catch (err) {
      console.error('Failed to persist accounts data:', err)
    }
  }

  // --- Actions ---
  const saveAccount = async (acc) => {
    let updatedList
    if (acc.id && accounts.some(a => a.id === acc.id)) {
      updatedList = accounts.map(a => a.id === acc.id ? acc : a)
    } else {
      const newAcc = { ...acc, id: acc.id || `acc-${Date.now().toString(36)}` }
      updatedList = [newAcc, ...accounts]
    }
    setAccounts(updatedList)
    await persistAccountsData({ accounts: updatedList })
    return updatedList
  }

  const deleteAccount = async (accId) => {
    const updatedList = accounts.filter(a => a.id !== accId)
    setAccounts(updatedList)
    await persistAccountsData({ accounts: updatedList })
  }

  const addTransfer = async (transfer) => {
    const newTr = {
      ...transfer,
      id: transfer.id || `TR-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString()
    }
    const updatedList = [newTr, ...transfers]
    setTransfers(updatedList)
    await persistAccountsData({ transfers: updatedList })
    return newTr
  }

  const addDeposit = async (deposit) => {
    const newDep = {
      ...deposit,
      id: deposit.id || `DEP-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString()
    }
    const updatedList = [newDep, ...deposits]
    setDeposits(updatedList)
    await persistAccountsData({ deposits: updatedList })
    return newDep
  }

  const addWithdrawal = async (withdrawal) => {
    const newW = {
      ...withdrawal,
      id: withdrawal.id || `WTH-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString()
    }
    const updatedList = [newW, ...withdrawals]
    setWithdrawals(updatedList)
    await persistAccountsData({ withdrawals: updatedList })
    return newW
  }

  const addJournalEntry = async (entry) => {
    const newJ = {
      ...entry,
      id: entry.id || `JV-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString()
    }
    const updatedList = [newJ, ...journalEntries]
    setJournalEntries(updatedList)
    await persistAccountsData({ journalEntries: updatedList })
    return newJ
  }

  const addCashClosing = async (closing) => {
    const newC = {
      ...closing,
      id: closing.id || `CC-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString()
    }
    const updatedList = [newC, ...cashClosings]
    setCashClosings(updatedList)
    await persistAccountsData({ cashClosings: updatedList })
    return newC
  }

  const saveBankReconciliation = async (rec) => {
    const newRec = {
      ...rec,
      id: rec.id || `REC-${Date.now().toString(36).toUpperCase()}`,
      reconciledAt: new Date().toISOString()
    }
    const updatedList = [newRec, ...bankReconciliations.filter(r => r.id !== rec.id)]
    setBankReconciliations(updatedList)
    await persistAccountsData({ bankReconciliations: updatedList })
    return newRec
  }

  const updateChartOfAccounts = async (newList) => {
    setChartOfAccounts(newList)
    await persistAccountsData({ chartOfAccounts: newList })
  }

  const updateFiscalYear = async (fy) => {
    setFiscalYear(fy)
    await persistAccountsData({ fiscalYear: fy })
  }

  const clearAllAccountsData = async () => {
    setAccounts([])
    setTransfers([])
    setDeposits([])
    setWithdrawals([])
    setJournalEntries([])
    setBankReconciliations([])
    setCashClosings([])
    await persistAccountsData({
      accounts: [],
      transfers: [],
      deposits: [],
      withdrawals: [],
      journalEntries: [],
      bankReconciliations: [],
      cashClosings: []
    })
  }

  // --- Dynamic Live Derived Accounting State ---
  const unifiedTransactions = buildUnifiedTransactions({
    accounts,
    receipts,
    expenses,
    vendorPayments,
    invoices,
    transfers,
    deposits,
    withdrawals,
    journalEntries
  })

  const calculatedAccounts = calculateAccountBalances(accounts, unifiedTransactions)

  const customerReceivables = calculateCustomerReceivables(invoices, receipts)
  const vendorPayables = calculateVendorPayables(vendors, vendorPayments, expenses)

  const profitAndLoss = generateProfitAndLossReport({
    invoices,
    expenses
  })

  const balanceSheet = generateBalanceSheet({
    calculatedAccounts,
    customerReceivables,
    vendorPayables,
    profitAndLoss
  })

  const trialBalance = generateTrialBalance({
    chartOfAccounts,
    transactions: unifiedTransactions
  })

  const cashFlow = generateCashFlowStatement({
    receipts,
    expenses,
    vendorPayments,
    deposits,
    withdrawals
  })

  // Summary Totals
  const totalCashBalance = calculatedAccounts.filter(a => a.type === 'cash').reduce((s, a) => s + a.currentBalance, 0)
  const totalBankBalance = calculatedAccounts.filter(a => a.type === 'bank').reduce((s, a) => s + a.currentBalance, 0)
  const totalMobileBalance = calculatedAccounts.filter(a => a.type === 'mobile').reduce((s, a) => s + a.currentBalance, 0)
  const totalAvailableBalance = totalCashBalance + totalBankBalance + totalMobileBalance

  const totalReceivables = customerReceivables.reduce((s, c) => s + c.totalDue, 0)
  const totalPayables = vendorPayables.reduce((s, v) => s + v.totalDue, 0)

  return (
    <AccountsContext.Provider value={{
      loading,
      accounts: calculatedAccounts,
      rawAccounts: accounts,
      chartOfAccounts,
      transfers,
      deposits,
      withdrawals,
      journalEntries,
      bankReconciliations,
      cashClosings,
      fiscalYear,
      unifiedTransactions,
      customerReceivables,
      vendorPayables,
      profitAndLoss,
      balanceSheet,
      trialBalance,
      cashFlow,
      // Totals
      totalCashBalance,
      totalBankBalance,
      totalMobileBalance,
      totalAvailableBalance,
      totalReceivables,
      totalPayables,
      // Actions
      saveAccount,
      deleteAccount,
      addTransfer,
      addDeposit,
      addWithdrawal,
      addJournalEntry,
      addCashClosing,
      saveBankReconciliation,
      updateChartOfAccounts,
      updateFiscalYear,
      clearAllAccountsData,
      reloadAccounts: loadAccountsData
    }}>
      {children}
    </AccountsContext.Provider>
  )
}

export function useAccounts() {
  const context = useContext(AccountsContext)
  if (!context) {
    throw new Error('useAccounts must be used within an AccountsProvider')
  }
  return context
}
