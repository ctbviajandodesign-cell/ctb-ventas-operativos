import { createClient } from '@supabase/supabase-js'

const res = await fetch('https://ctb-ventas-operativos.vercel.app/api/admin/anular-cotizacion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cotizacionId: 'invalid-id', anularVentas: true })
})
const data = await res.json()
console.log(data)
