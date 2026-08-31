import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { InlineSpinner } from '../components/common/LoadingSpinner'

export default function Login() {
  const { signIn, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sessionMsg] = useState(location.state?.message || '')

  const [isSignUp, setIsSignUp] = useState(false)
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [user, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setError('Please enter your full name')
          setSubmitting(false)
          return
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters')
          setSubmitting(false)
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim(), role: 'Admin' }
          }
        })
        if (error) throw error
        
        if (data.session) {
          navigate('/dashboard', { replace: true })
        } else {
          setError('Account registered! If confirmation is required in your Supabase project, check your email or confirm the user in your Supabase Auth dashboard.')
        }
      } else {
        await signIn(email.trim(), password)
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / Brand */}
        <div style={styles.brandSection}>
          <div style={styles.logoCircle}>
            <span style={styles.logoText}>TG</span>
          </div>
          <h1 style={styles.brandName}>TGBD CRM</h1>
          <p style={styles.brandSub}>Tour Guidance BD — Sales & CRM System</p>
        </div>

        {sessionMsg && (
          <div style={styles.sessionMsg}>{sessionMsg}</div>
        )}

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label" htmlFor="login-fullname">Full Name</label>
              <input
                id="login-fullname"
                type="text"
                className="form-input"
                placeholder="e.g. Tanvir Ahmed (Super Admin)"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="admin@tourguidebd.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder={isSignUp ? "Create a secure password (min 8 chars)" : "Enter your password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              disabled={submitting}
            />
          </div>

          {error && (
            <div style={styles.errorBox}>{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.9rem', marginTop: 4 }}
            disabled={submitting || !email || !password}
          >
            {submitting ? (
              <><InlineSpinner /> &nbsp;{isSignUp ? 'Creating Account...' : 'Signing in...'}</>
            ) : (
              isSignUp ? 'Create Super Admin Account' : 'Sign In'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--gold)', fontSize: '0.8rem' }}
            onClick={() => { setIsSignUp(!isSignUp); setError('') }}
          >
            {isSignUp ? '← Already have an account? Sign In' : 'First time setup? Create Admin Account →'}
          </button>
        </div>

        <div style={styles.footer}>
          Secure login via Supabase Auth · Session persists across devices
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'var(--bg-base)',
    backgroundImage: 'radial-gradient(ellipse 80% 60% at 30% 20%, var(--bg-glow) 0%, var(--bg-base) 70%)',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '36px 32px',
    boxShadow: 'var(--shadow-lg), 0 0 60px rgba(201,162,75,0.07)',
  },
  brandSection: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #C9A24B, #8b6f2e)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 14px',
    boxShadow: '0 4px 20px rgba(201,162,75,0.35)',
  },
  logoText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '22px',
    fontWeight: 700,
    color: '#0A0F1C',
    letterSpacing: '-0.5px',
  },
  brandName: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  brandSub: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  errorBox: {
    background: 'var(--red-dim)',
    border: '1px solid rgba(239,100,97,0.35)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    color: 'var(--red)',
    fontSize: '0.82rem',
    marginBottom: '8px',
  },
  sessionMsg: {
    background: 'var(--orange-dim)',
    border: '1px solid rgba(245,158,11,0.35)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    color: 'var(--orange)',
    fontSize: '0.82rem',
    marginBottom: '16px',
    textAlign: 'center',
  },
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
    lineHeight: 1.5,
  },
}
