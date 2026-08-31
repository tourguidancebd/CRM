import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: DashIcon, module: 'dashboard' },
  { to: '/accounts', label: 'Accounts & Banking', icon: AccountsIcon, module: 'accounts' },
  { to: '/customers', label: 'Customer', icon: CustomersIcon, module: 'customers' },
  { to: '/agents', label: 'Agent', icon: AgentsIcon, module: 'agents' },
  { to: '/employees', label: 'Employees', icon: EmployeesIcon, module: 'employees' },
  { to: '/items', label: 'Items', icon: ItemsIcon, module: 'items' },
  { to: '/invoices', label: 'Invoice', icon: InvoiceIcon, module: 'invoices' },
  { to: '/due-invoices', label: 'Due Invoices', icon: DueIcon, module: 'due-invoices' },
  { to: '/journeys', label: "Today's Journey", icon: JourneyIcon, module: 'journeys' },
  { to: '/receipts', label: 'Money Receipt', icon: ReceiptIcon, module: 'receipts' },
  { to: '/vendor-payments', label: 'Vendor Payment', icon: VendorIcon, module: 'vendor-payments' },
  { to: '/expenses', label: 'Expense', icon: ExpenseIcon, module: 'expenses' },
  { to: '/reports', label: 'Reports', icon: ReportIcon, module: 'reports' },
  { to: '/users', label: 'User & Role', icon: UsersIcon, module: 'users' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, module: 'settings' },
]

export function Sidebar({ isOpen, onClose }) {
  const { can, role, user, profile, signOut } = useAuth()
  const { crmName, company } = useSettings()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const userName = profile?.username || profile?.full_name || settings?.adminName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Super Admin'
  const userInitial = (userName || 'A')[0].toUpperCase()

  const visibleItems = NAV_ITEMS.filter(item => can(item.module))

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          {company?.logo
            ? <img src={company.logo} alt="Logo" className="sidebar-logo" />
            : <div className="sidebar-logo-placeholder">{(crmName || 'T')[0]}</div>
          }
          <div>
            <div className="sidebar-brand-text">{crmName || 'TGBD CRM'}</div>
            <div className="sidebar-brand-sub">Tour Guidance BD</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {visibleItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <item.icon className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{userInitial}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{userName}</div>
            <div className="sidebar-user-role">{role}</div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleSignOut} title="Sign out">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  )
}

/* ---- SVG Icons (matched to prototype) ---- */
function DashIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
}
function CustomersIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6"/></svg>
}
function AgentsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20c1-3.4 3.4-5.2 6-5.2s5 1.8 6 5.2"/><path d="M16 4.2a3 3 0 010 5.8M21 20c-.6-2.4-1.8-4-3.6-4.8"/></svg>
}
function EmployeesIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="7" r="4"/><path d="M4 21c1.4-4.4 4.6-6.8 8-6.8s6.6 2.4 8 6.8"/></svg>
}
function ItemsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>
}
function InvoiceIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
}
function DueIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/></svg>
}
function JourneyIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12h18M3 12l5-5M3 12l5 5"/><circle cx="18" cy="12" r="2"/></svg>
}
function ReceiptIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>
}
function VendorIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h18M3 12h18M3 17h12"/></svg>
}
function ExpenseIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1 3 2.2c0 2.8-6 1.5-6 4.3 0 1.3 1.3 2.3 3 2.3s3-1 3-2.3"/></svg>
}
function ReportIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20V10M11 20V4M18 20v-7"/></svg>
}
function UsersIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="3"/><path d="M2 20c.8-3.4 3-5.2 6-5.2s5.2 1.8 6 5.2"/><path d="M17 9l1.5 1.5L22 7"/></svg>
}
function SettingsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
}
function AccountsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="6" cy="15" r="1.5"/><circle cx="18" cy="15" r="1.5"/></svg>
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
