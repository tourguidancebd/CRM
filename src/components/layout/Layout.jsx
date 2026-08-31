import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useInactivityLogout } from '../../hooks/useInactivityLogout'
import { useNavigate } from 'react-router-dom'

export function Layout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  useInactivityLogout(() => {
    navigate('/login', { state: { message: 'Session expired due to inactivity.' } })
  })

  return (
    <div id="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopBar onMenuClick={() => setSidebarOpen(true)} title={title} />
      <main className="main-content" id="main-content">
        {children}
      </main>
    </div>
  )
}
