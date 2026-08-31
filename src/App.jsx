import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ProtectedRoute } from './components/ProtectedRoute'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CustomerList from './pages/customers/CustomerList'
import AgentList from './pages/agents/AgentList'
import EmployeeList from './pages/employees/EmployeeList'
import ItemList from './pages/items/ItemList'
import InvoiceList from './pages/invoices/InvoiceList'
import DueInvoices from './pages/due-invoices/DueInvoices'
import TodaysJourney from './pages/journeys/TodaysJourney'
import ReceiptList from './pages/receipts/ReceiptList'
import VendorPayments from './pages/vendor-payments/VendorPayments'
import ExpenseList from './pages/expenses/ExpenseList'
import Reports from './pages/reports/Reports'
import UserRole from './pages/users/UserRole'
import Settings from './pages/settings/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/dashboard" element={
              <ProtectedRoute module="dashboard" title="Dashboard">
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/customers" element={
              <ProtectedRoute module="customers" title="Customers">
                <CustomerList />
              </ProtectedRoute>
            } />

            <Route path="/agents" element={
              <ProtectedRoute module="agents" title="Agents">
                <AgentList />
              </ProtectedRoute>
            } />

            <Route path="/employees" element={
              <ProtectedRoute module="employees" title="Employees">
                <EmployeeList />
              </ProtectedRoute>
            } />

            <Route path="/items" element={
              <ProtectedRoute module="items" title="Items">
                <ItemList />
              </ProtectedRoute>
            } />

            <Route path="/invoices" element={
              <ProtectedRoute module="invoices" title="Invoices">
                <InvoiceList />
              </ProtectedRoute>
            } />

            <Route path="/due-invoices" element={
              <ProtectedRoute module="due-invoices" title="Due Invoices">
                <DueInvoices />
              </ProtectedRoute>
            } />

            <Route path="/journeys" element={
              <ProtectedRoute module="journeys" title="Today's Journey">
                <TodaysJourney />
              </ProtectedRoute>
            } />

            <Route path="/receipts" element={
              <ProtectedRoute module="receipts" title="Money Receipts">
                <ReceiptList />
              </ProtectedRoute>
            } />

            <Route path="/vendor-payments" element={
              <ProtectedRoute module="vendor-payments" title="Vendor Payments">
                <VendorPayments />
              </ProtectedRoute>
            } />

            <Route path="/expenses" element={
              <ProtectedRoute module="expenses" title="Expenses">
                <ExpenseList />
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute module="reports" title="Reports">
                <Reports />
              </ProtectedRoute>
            } />

            <Route path="/users" element={
              <ProtectedRoute module="users" title="Users & Roles">
                <UserRole />
              </ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute module="settings" title="Settings">
                <Settings />
              </ProtectedRoute>
            } />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
