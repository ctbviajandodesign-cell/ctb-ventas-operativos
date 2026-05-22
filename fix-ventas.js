import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    let val = match[2].trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    env[match[1].trim()] = val
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { data: ventas } = await supabase.from('ventas').select('id, cotizacion_id, estado')
  
  let fixed = 0
  for (const v of ventas) {
    if (v.estado === 'anulada') continue;
    const { data: cot } = await supabase.from('cotizaciones').select('id, estado').eq('id', v.cotizacion_id).single()
    
    if (!cot) {
      console.log(`Orphaned Venta found: ${v.id}. Annulling...`)
      await supabase.from('ventas').update({ estado: 'anulada' }).eq('id', v.id)
      await supabase.from('vouchers').update({ estado: 'inactivo' }).eq('venta_id', v.id)
      fixed++
    } else if (cot.estado === 'perdida' || cot.estado === 'anulada') {
      console.log(`Venta whose quote is cancelled: ${v.id}. Annulling...`)
      await supabase.from('ventas').update({ estado: 'anulada' }).eq('id', v.id)
      await supabase.from('vouchers').update({ estado: 'inactivo' }).eq('venta_id', v.id)
      fixed++
    }
  }
  console.log(`Fixed ${fixed} orphaned ventas.`)
}
main()
