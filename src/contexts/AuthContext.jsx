import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

const SUPER_ADMINS = ['supporttgbd@gmail.com', 'admin@tourguidebd.com']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId, userEmail) => {
    if (!userId) { setProfile(null); return }
    try {
      const isSuper = (userEmail && SUPER_ADMINS.includes(userEmail.toLowerCase())) || userId === '56e160e9-f5f3-45cd-9c48-bc0deefb08ae'
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (!error && data) {
        if (isSuper && data.role !== 'Admin') {
          await supabase.from('profiles').update({ role: 'Admin' }).eq('id', userId)
          setProfile({ ...data, role: 'Admin' })
        } else {
          setProfile(data)
        }
      } else {
        // If profile doesn't exist yet, create default profile
        const newProf = {
          id: userId,
          username: userEmail ? userEmail.split('@')[0] : 'admin',
          role: 'Admin'
        }
        await supabase.from('profiles').upsert(newProf)
        setProfile(newProf)
      }
    } catch (e) {
      console.warn('Profile fetch error, defaulting to Admin:', e)
      setProfile({ id: userId, username: userEmail || 'admin', role: 'Admin' })
    }
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id, u.email).finally(() => setLoading(false))
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id, u.email)
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

  const updateProfileName = async (newName) => {
    if (!newName || !newName.trim()) return
    const trimmed = newName.trim()
    if (user?.id) {
      try {
        await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id)
      } catch (err) {
        console.warn('Profile update failed:', err)
      }
      try {
        await supabase.auth.updateUser({ data: { display_name: trimmed, full_name: trimmed } })
      } catch (err) {
        console.warn('User metadata update failed:', err)
      }
      setProfile(p => ({ ...p, username: trimmed, full_name: trimmed }))
    }
  }

  const role = profile?.role || 'Admin'

  // Permission map
  const PERMISSIONS = {
    Admin: ['dashboard', 'accounts', 'customers', 'agents', 'employees', 'items', 'invoices',
            'due-invoices', 'journeys', 'receipts', 'vendor-payments', 'expenses',
            'reports', 'users', 'settings'],
    CustomerService: ['dashboard', 'accounts', 'customers', 'invoices', 'due-invoices',
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
      signIn, signOut, updatePassword, updateProfileName,
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
