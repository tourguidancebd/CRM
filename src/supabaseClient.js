import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://echzosjqavlydfswqnuy.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_JEmbxRUG47S4PBv1j1Zfhg_bi6iVrpj'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
