const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

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
  const { data, error } = await supabase.from('ventas').select('id, total, faltante, abono_1, abono_2, abono_tarjeta, estado').eq('estado', 'activa')
  if (error) {
    console.error(error)
    return
  }
  
  let manualDebt = 0
  let dbDebt = 0
  
  data.forEach(v => {
    let dbFaltante = Number(v.faltante) || 0
    let manualFaltante = (Number(v.total) || 0) - ((Number(v.abono_1) || 0) + (Number(v.abono_2) || 0) + (Number(v.abono_tarjeta) || 0))
    
    if (manualFaltante > 0) manualDebt += manualFaltante
    if (dbFaltante > 0) dbDebt += dbFaltante
    
    if (manualFaltante > 0 && dbFaltante <= 0) {
      console.log(`Mismatch on ID ${v.id}: DB=${v.faltante}, Manual=${manualFaltante}`)
    }
  })
  
  console.log(`Total Sales Activas: ${data.length}`)
  console.log(`Debt computed by DB (sum): ${dbDebt}`)
  console.log(`Debt computed manually (sum): ${manualDebt}`)
}

main()
