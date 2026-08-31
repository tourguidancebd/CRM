import { useSettings } from '../../contexts/SettingsContext'

export function TopBar({ onMenuClick, title }) {
  const { crmName } = useSettings()

  return (
    <header className="topbar" id="topbar">
      <button className="topbar-hamburger" onClick={onMenuClick} aria-label="Open navigation menu" id="sidebar-toggle">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div className="topbar-title">{title || crmName || 'TGBD CRM'}</div>
    </header>
  )
}
