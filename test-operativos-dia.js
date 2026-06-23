/**
 * TEST: Simula el informe diario de operativos y lo envía a Telegram Admin.
 * Usa datos REALES de Supabase del día anterior.
 * Ejecutar: node test-operativos-dia.js
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')

// Leer .env.local manualmente
const fs = require('fs')
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=')
  if (key && val.length) {
    process.env[key.trim()] = val.join('=').replace(/^"|"$/g, '').trim()
  }
})

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ADMIN = process.env.TELEGRAM_CHAT_ADMIN

function formatMoney(n) {
  return `$${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 0 })}`
}

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ADMIN,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
  return res.json()
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Rango: ayer en Ecuador (UTC-5)
  const now = new Date()
  const offsetMs = 5 * 60 * 60 * 1000 // UTC-5
  const nowEC = new Date(now.getTime() - offsetMs)

  const ayerInicioEC = new Date(nowEC)
  ayerInicioEC.setDate(ayerInicioEC.getDate() - 1)
  ayerInicioEC.setHours(0, 0, 0, 0)

  const ayerFinEC = new Date(ayerInicioEC)
  ayerFinEC.setHours(23, 59, 59, 999)

  // Convertir de vuelta a UTC para Supabase
  const ayerInicioUTC = new Date(ayerInicioEC.getTime() + offsetMs)
  const ayerFinUTC = new Date(ayerFinEC.getTime() + offsetMs)

  const diaAyer = ayerInicioEC.toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  console.log(`\n📅 Consultando datos de: ${diaAyer}`)
  console.log(`   UTC desde: ${ayerInicioUTC.toISOString()}`)
  console.log(`   UTC hasta: ${ayerFinUTC.toISOString()}\n`)

  // Todos los operativos
  const { data: allOps, error: errOps } = await supabase
    .from('profiles')
    .select('id, nombre, ciudad, meta_mensual')
    .eq('rol', 'operativo')

  if (errOps) { console.error('Error profiles:', errOps); process.exit(1) }
  if (!allOps || allOps.length === 0) { console.log('No hay operativos'); process.exit(0) }

  console.log(`✅ Operativos encontrados: ${allOps.length}`)

  // Cotizaciones de ayer
  const { data: cotsAyer, error: errCots } = await supabase
    .from('cotizaciones')
    .select('operativo_id')
    .gte('created_at', ayerInicioUTC.toISOString())
    .lt('created_at', ayerFinUTC.toISOString())

  if (errCots) console.warn('Advertencia cotizaciones:', errCots)
  console.log(`📋 Cotizaciones de ayer: ${(cotsAyer || []).length}`)

  // Ventas de ayer
  const { data: ventasAyer, error: errVentas } = await supabase
    .from('ventas')
    .select('total, comision, utilidad, operativo_id')
    .eq('estado', 'activa')
    .gte('created_at', ayerInicioUTC.toISOString())
    .lt('created_at', ayerFinUTC.toISOString())

  if (errVentas) console.warn('Advertencia ventas:', errVentas)
  console.log(`💼 Ventas cerradas ayer: ${(ventasAyer || []).length}\n`)

  // Construir statsMap
  const statsMap = {}
  for (const op of allOps) {
    statsMap[op.id] = {
      nombre: op.nombre,
      ciudad: op.ciudad || '',
      meta: Number(op.meta_mensual || 5000),
      cotizaciones: 0,
      ventas: 0,
      montoVendido: 0,
      ingresoCTB: 0,
    }
  }

  for (const c of (cotsAyer || [])) {
    if (statsMap[c.operativo_id]) statsMap[c.operativo_id].cotizaciones++
  }

  for (const v of (ventasAyer || [])) {
    if (statsMap[v.operativo_id]) {
      statsMap[v.operativo_id].ventas++
      statsMap[v.operativo_id].montoVendido += Number(v.total || 0)
      statsMap[v.operativo_id].ingresoCTB += Number(v.comision || 0) + Number(v.utilidad || 0)
    }
  }

  // Agrupar por ciudad
  const porCiudad = {}
  for (const op of allOps) {
    const ciudad = (op.ciudad || 'sin ciudad').toLowerCase()
    if (!porCiudad[ciudad]) porCiudad[ciudad] = []
    porCiudad[ciudad].push(statsMap[op.id])
  }

  // Totales globales
  const allStats = Object.values(statsMap)
  const totalCots = allStats.reduce((a, o) => a + o.cotizaciones, 0)
  const totalVentas = allStats.reduce((a, o) => a + o.ventas, 0)
  const totalMonto = allStats.reduce((a, o) => a + o.montoVendido, 0)
  const totalIngreso = allStats.reduce((a, o) => a + o.ingresoCTB, 0)

  const sinActividad = allStats.filter(o => o.cotizaciones === 0 && o.ventas === 0)
  const sinVenta = allStats.filter(o => o.ventas === 0 && o.cotizaciones > 0)

  // Construir mensaje
  const lines = [
    `🌅 <b>INFORME DIARIO DE OPERATIVOS — CTB</b>`,
    `<i>${diaAyer}</i>`,
    ``,
  ]

  for (const [ciudad, ops] of Object.entries(porCiudad)) {
    const sorted = ops.sort((a, b) => b.montoVendido - a.montoVendido || b.cotizaciones - a.cotizaciones)
    const cityMonto = ops.reduce((a, o) => a + o.montoVendido, 0)
    const cityIngreso = ops.reduce((a, o) => a + o.ingresoCTB, 0)

    lines.push(`🏙 <b>${ciudad.toUpperCase()}</b>`)

    for (const op of sorted) {
      const hasCots = op.cotizaciones > 0
      const hasVentas = op.ventas > 0
      const actividadEmoji = hasVentas ? '✅' : hasCots ? '📋' : '💤'

      lines.push(``)
      lines.push(`${actividadEmoji} <b>${op.nombre}</b>`)
      lines.push(`   📋 Cotizaciones: <b>${op.cotizaciones}</b>`)
      lines.push(`   💼 Ventas cerradas: <b>${op.ventas}</b>`)

      if (hasVentas) {
        lines.push(`   💵 Monto vendido: <b>${formatMoney(op.montoVendido)}</b>`)
        lines.push(`   📈 Ingreso CTB (com+util): <b>${formatMoney(op.ingresoCTB)}</b>`)
      } else {
        lines.push(`   💵 Sin ventas cerradas ayer`)
      }
    }

    lines.push(``)
    lines.push(`   ↳ Ciudad: ${formatMoney(cityMonto)} vendido · Ingreso CTB: ${formatMoney(cityIngreso)}`)
    lines.push(``)
  }

  lines.push(`─────────────────────`)
  lines.push(`📊 <b>RESUMEN GLOBAL DEL DÍA</b>`)
  lines.push(`   📋 Cotizaciones totales: <b>${totalCots}</b>`)
  lines.push(`   💼 Ventas cerradas: <b>${totalVentas}</b>`)
  lines.push(`   💵 Monto total vendido: <b>${formatMoney(totalMonto)}</b>`)
  lines.push(`   📈 Ingreso total CTB: <b>${formatMoney(totalIngreso)}</b>`)

  if (sinActividad.length > 0) {
    lines.push(``)
    lines.push(`💤 <b>Sin actividad ayer (${sinActividad.length}):</b>`)
    sinActividad.forEach(o => lines.push(`   · ${o.nombre}${o.ciudad ? ` (${o.ciudad})` : ''}`))
  }

  if (sinVenta.length > 0) {
    lines.push(``)
    lines.push(`📋 <b>Cotizaron pero no cerraron venta (${sinVenta.length}):</b>`)
    sinVenta.forEach(o =>
      lines.push(`   · ${o.nombre} — ${o.cotizaciones} cot${o.cotizaciones > 1 ? 's' : ''}`)
    )
  }

  const mensaje = lines.join('\n')
  console.log('─── MENSAJE A ENVIAR ───────────────────────────')
  console.log(mensaje)
  console.log('────────────────────────────────────────────────\n')

  console.log('📤 Enviando a Telegram admin...')
  const result = await sendTelegram(mensaje)
  if (result.ok) {
    console.log('✅ Mensaje enviado correctamente a Telegram!')
  } else {
    console.error('❌ Error al enviar:', result)
  }
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
