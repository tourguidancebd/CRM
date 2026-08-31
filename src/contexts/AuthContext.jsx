import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (!error && data) {
        setProfile(data)
      } else {
        // If profile doesn't exist yet, create default Admin profile
        const newProf = { id: userId, role: 'Admin' }
        await supabase.from('profiles').upsert(newProf)
        setProfile(newProf)
      }
    } catch (e) {
      console.warn('Profile fetch error, defaulting to Admin:', e)
      setProfile({ id: userId, role: 'Admin' })
    }
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null) }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  const role = profile?.role || 'Admin'

  // Permission map
  const PERMISSIONS = {
    Admin: ['dashboard', 'customers', 'agents', 'employees', 'items', 'invoices',
            'due-invoices', 'journeys', 'receipts', 'vendor-payments', 'expenses',
            'reports', 'users', 'settings'],
    CustomerService: ['dashboard', 'customers', 'invoices', 'due-invoices',
                      'journeys', 'receipts', 'expenses', 'reports'],
    Agent: ['dashboard', 'customers', 'reports'],
  }

  const can = (module) => {
    if (!role || role === 'Admin') return true
    return (PERMISSIONS[role] || []).includes(module)
  }

  const isAdmin = role === 'Admin'
  const isAgent = role === 'Agent'
  const isCustomerService = role === 'CustomerService'

  return (
    <AuthContext.Provider value={{
      user, profile, role, loading,
      signIn, signOut, updatePassword,
      can, isAdmin, isAgent, isCustomerService,
      refreshProfile: () => fetchProfile(user?.id)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
