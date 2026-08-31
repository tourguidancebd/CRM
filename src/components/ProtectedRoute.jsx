import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './common/LoadingSpinner'
import { Layout } from './layout/Layout'

/**
 * ProtectedRoute: gates a page behind authentication AND role permission.
 * - Unauthenticated → redirect to /login
 * - Authenticated but role not allowed → show Access Denied
 * - Authenticated + allowed → render inside Layout
 */
export function ProtectedRoute({ children, module, title }) {
  const { user, loading, can } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Authenticating..." />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (module && !can(module)) {
    return (
      <Layout title="Access Denied">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Access Denied
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            You don't have permission to access this module.<br />
            Contact your administrator if you believe this is an error.
          </p>
        </div>
      </Layout>
    )
  }

  return <Layout title={title}>{children}</Layout>
}
