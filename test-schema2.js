import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://tngttnuxlmtckpwyjzzu.supabase.co', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy' // Can't actually test constraints easily via REST API unless we try to insert
)
