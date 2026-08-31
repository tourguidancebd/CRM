import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { DEFAULT_ID_CONFIGS } from '../utils/idGenerator'

const SettingsContext = createContext(null)

const DEFAULT_SETTINGS = {
  company: {
    name: 'Tour Guidance BD',
    logo: '',
    address: '',
    phone: '',
    email: '',
    tradeLicense: '',
    website: '',
    facebook: '',
    whatsapp: '',
    footer: '',
    authoritySignature: '',
  },
  crmName: 'TGBD CRM',
  primaryBank: { bankName: '', accountName: '', accountNumber: '', branchName: '', routingNumber: '', otherInfo: '' },
  secondaryBank: { bankName: '', accountName: '', accountNumber: '', branchName: '', routingNumber: '', otherInfo: '' },
  idSettings: { ...DEFAULT_ID_CONFIGS },
  system: {
    currencySymbol: '৳',
    seasonalTarget: 0,
    targetStartDate: '',
    targetEndDate: '',
    fixedBudget: 0,
    birthdayWishEnabled: true,
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 1)
        .single()

      if (!error && data?.data) {
        setSettings(prev => deepMerge(prev, data.data))
      }
    } catch (err) {
      console.error('Settings load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  const saveSettings = async (newSettings) => {
    const merged = deepMerge(settings, newSettings)
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 1, data: merged })
    if (error) throw error
    setSettings(merged)
    return merged
  }

  const currencySymbol = settings.system?.currencySymbol || '৳'
  const crmName = settings.crmName || 'TGBD CRM'

  return (
    <SettingsContext.Provider value={{
      settings, loading, saveSettings, reload: loadSettings,
      currencySymbol, crmName,
      company: settings.company,
      idSettings: settings.idSettings,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}

/** Deep merge two objects (non-destructive) */
function deepMerge(target, source) {
  if (!source) return target
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}
