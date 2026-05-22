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

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

async function fetchSupabase(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }
  if (body) options.body = JSON.stringify(body)
  const res = await fetch(`${url}/rest/v1/${path}`, options)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase error: ${res.status} ${err}`)
  }
  return res.json()
}

async function main() {
  const ventas = await fetchSupabase('ventas?select=id,cotizacion_id,estado')
  const cotizaciones = await fetchSupabase('cotizaciones?select=id,estado')
  
  const cotMap = {}
  cotizaciones.forEach(c => cotMap[c.id] = c.estado)
  
  let fixed = 0
  for (const v of ventas) {
    if (v.estado === 'anulada') continue;
    const cotEstado = cotMap[v.cotizacion_id]
    
    if (!cotEstado) {
      console.log(`Orphaned Venta found: ${v.id}. Annulling...`)
      await fetchSupabase(`ventas?id=eq.${v.id}`, 'PATCH', { estado: 'anulada' })
      await fetchSupabase(`vouchers?venta_id=eq.${v.id}`, 'PATCH', { estado: 'inactivo' })
      fixed++
    } else if (cotEstado === 'perdida' || cotEstado === 'anulada') {
      console.log(`Venta whose quote is cancelled: ${v.id}. Annulling...`)
      await fetchSupabase(`ventas?id=eq.${v.id}`, 'PATCH', { estado: 'anulada' })
      await fetchSupabase(`vouchers?venta_id=eq.${v.id}`, 'PATCH', { estado: 'inactivo' })
      fixed++
    }
  }
  console.log(`Fixed ${fixed} orphaned ventas.`)
}
main()
