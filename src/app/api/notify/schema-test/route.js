export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const { data: quote } = await supabase.from('cotizaciones').select('id, estado').eq('estado', 'ganada').limit(1).single()
  if (!quote) return Response.json({ ok: false, msg: 'No ganada quotes found' })
  
  // Try to update it using ANON key to simulate client
  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { error } = await supabaseAnon.from('cotizaciones').update({ estado: 'anulada' }).eq('id', quote.id)
  
  // revert
  await supabase.from('cotizaciones').update({ estado: 'ganada' }).eq('id', quote.id)
  
  return Response.json({ ok: true, quote_id: quote.id, error })
}
