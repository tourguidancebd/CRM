export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="loading-wrap">
      <div className="spinner" />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{message}</span>
    </div>
  )
}

export function InlineSpinner() {
  return (
    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', verticalAlign: 'middle' }} />
  )
}
