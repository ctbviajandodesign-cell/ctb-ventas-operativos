/**
 * GET /api/notify/daily
 * Resumen diario de ventas por operativo.
 * Cron: todos los días a las 9pm Ecuador (02:00 UTC)
 * Protegido por CRON_SECRET header.
 * Mejoras: operativos con 0 ventas hoy, alerta inactividad 3 días,
 *           desglose total ventas + comisiones/utilidades.
 */
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin, notifyCity, formatMoney, progressBar, escapeHtml, getEcuadorTime, ecToUTC } from '@/lib/telegram'

export async function GET(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const secret = req.headers.get('x-cron-secret')
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isCustomCron = cronSecret && secret === cronSecret

  if (!isVercelCron && !isCustomCron) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const ecNow = getEcuadorTime(now)
    
    // Inicio de hoy en Ecuador (00:00:00)
    const ecTodayStart = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate(), 0, 0, 0, 0))
    const todayUTC = ecToUTC(ecTodayStart)
    
    // Hace 3 días en Ecuador (inicio del día)
    const ecThreeDaysAgoStart = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate() - 3, 0, 0, 0, 0))
    const threeDaysAgoUTC = ecToUTC(ecThreeDaysAgoStart)
    
    // Inicio del mes en Ecuador (00:00:00)
    const ecMonthStart = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), 1, 0, 0, 0, 0))
    const startOfMonthUTC = ecToUTC(ecMonthStart)

    const diaHoy = now.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guayaquil' })

    // --- Ventas de hoy ---
    const { data: ventasHoy, error: errorVentasHoy } = await supabase
      .from('ventas')
      .select('total, comision, utilidad, operativo_id, profiles!inner(nombre, ciudad, meta_mensual)')
      .eq('estado', 'activa')
      .gte('created_at', todayUTC.toISOString())

    if (errorVentasHoy) throw new Error(`Error al obtener ventas de hoy: ${errorVentasHoy.message}`)

    // --- Ventas últimos 3 días (para detectar inactividad) ---
    const { data: ventas3dias, error: errorVentas3dias } = await supabase
      .from('ventas')
      .select('operativo_id')
      .eq('estado', 'activa')
      .gte('created_at', threeDaysAgoUTC.toISOString())

    if (errorVentas3dias) throw new Error(`Error al obtener ventas de los últimos 3 días: ${errorVentas3dias.message}`)

    // --- Ventas del mes (para calcular % meta) ---
    const { data: ventasMes, error: errorVentasMes } = await supabase
      .from('ventas')
      .select('total, comision, utilidad, operativo_id')
      .eq('estado', 'activa')
      .gte('created_at', startOfMonthUTC.toISOString())

    if (errorVentasMes) throw new Error(`Error al obtener ventas del mes: ${errorVentasMes.message}`)

    // --- Todos los operativos ---
    const { data: allOps, error: errorAllOps } = await supabase
      .from('profiles')
      .select('id, nombre, ciudad, meta_mensual')
      .eq('rol', 'operativo')

    if (errorAllOps) throw new Error(`Error al obtener operativos: ${errorAllOps.message}`)

    // Mapa de operativos activos últimos 3 días
    const opsActivos3dias = new Set((ventas3dias || []).map(v => v.operativo_id))

    // Mapa de aporte del mes por operativo
    const aporteMap = {}
    for (const v of (ventasMes || [])) {
      if (!aporteMap[v.operativo_id]) aporteMap[v.operativo_id] = 0
      aporteMap[v.operativo_id] += Number(v.comision || 0) + Number(v.utilidad || 0)
    }

    if (!ventasHoy || ventasHoy.length === 0) {
      // Sin ventas en ninguna ciudad → aviso silencioso solo a admin
      const telRes = await notifyAdmin(`🌙 <b>Resumen Diario CTB</b>\n<i>${diaHoy}</i>\n\n❌ Sin ventas registradas hoy en ninguna ciudad.\n\n💪 ¡Mañana será mejor!`)
      if (!telRes || !telRes.ok) {
        throw new Error(`Telegram error: ${JSON.stringify(telRes)}`)
      }
      return Response.json({ ok: true, ventas: 0 })
    }

    // Agrupar ventas de hoy por ciudad y operativo
    const porCiudad = {}
    let globalHoyVentas = 0, globalHoyComision = 0, globalHoyUtilidad = 0

    for (const v of ventasHoy) {
      const ciudad = (v.profiles?.ciudad || 'otra').toLowerCase()
      const nombre = v.profiles?.nombre || 'N/A'
      const total = Number(v.total || 0)
      const comision = Number(v.comision || 0)
      const utilidad = Number(v.utilidad || 0)
      const aporte = comision + utilidad

      if (!porCiudad[ciudad]) porCiudad[ciudad] = { ops: {}, totalVentas: 0, totalComision: 0, totalUtilidad: 0 }
      if (!porCiudad[ciudad].ops[nombre]) porCiudad[ciudad].ops[nombre] = { ventas: 0, aporte: 0, count: 0, id: v.operativo_id }

      porCiudad[ciudad].ops[nombre].ventas += total
      porCiudad[ciudad].ops[nombre].aporte += aporte
      porCiudad[ciudad].ops[nombre].count += 1
      porCiudad[ciudad].totalVentas += total
      porCiudad[ciudad].totalComision += comision
      porCiudad[ciudad].totalUtilidad += utilidad
      globalHoyVentas += total
      globalHoyComision += comision
      globalHoyUtilidad += utilidad
    }

    // Resumen diario detallado → solo admin

    // Detectar operativos sin ventas en los últimos 3 días
    const inactivos = (allOps || []).filter(op => !opsActivos3dias.has(op.id))

    // Detectar operativos sin ventas hoy
    const opsConVentasHoy = new Set(ventasHoy.map(v => v.operativo_id))
    const sinVentasHoy = (allOps || []).filter(op => !opsConVentasHoy.has(op.id))

    // Mensaje admin global
    const adminLines = [
      `📊 <b>RESUMEN DIARIO GLOBAL CTB</b>`,
      `<i>${diaHoy}</i>`,
      ``
    ]

    for (const [ciudad, data] of Object.entries(porCiudad)) {
      const topOp = Object.entries(data.ops).sort((a, b) => b[1].ventas - a[1].ventas)[0]
      adminLines.push(`🏙 <b>${escapeHtml(ciudad.toUpperCase())}</b>: ${formatMoney(data.totalVentas)} (${Object.keys(data.ops).length} asesor${Object.keys(data.ops).length > 1 ? 'es' : ''})`)
      if (topOp) adminLines.push(`   👑 Líder: ${escapeHtml(topOp[0])} · ${formatMoney(topOp[1].ventas)}`)
    }

    adminLines.push(``)
    adminLines.push(`💼 <b>Total del día: ${formatMoney(globalHoyVentas)}</b>`)
    adminLines.push(`💰 Comisiones: ${formatMoney(globalHoyComision)}  |  Utilidades: ${formatMoney(globalHoyUtilidad)}`)
    adminLines.push(`📈 Aporte total CTB hoy: <b>${formatMoney(globalHoyComision + globalHoyUtilidad)}</b>`)
    adminLines.push(`📁 Ventas registradas: ${ventasHoy.length}`)

    // Operativos sin ventas hoy
    if (sinVentasHoy.length > 0) {
      const byCiudad = {}
      sinVentasHoy.forEach(op => {
        const c = op.ciudad || 'Sin ciudad'
        if (!byCiudad[c]) byCiudad[c] = []
        byCiudad[c].push(op.nombre)
      })
      adminLines.push(``)
      adminLines.push(`😶 <b>Sin ventas hoy (${sinVentasHoy.length}):</b>`)
      for (const [c, names] of Object.entries(byCiudad)) {
        adminLines.push(`   ${escapeHtml(c)}: ${names.map(escapeHtml).join(', ')}`)
      }
    }

    // Alerta inactividad 3 días
    if (inactivos.length > 0) {
      const byCiudad = {}
      inactivos.forEach(op => {
        const c = op.ciudad || 'Sin ciudad'
        if (!byCiudad[c]) byCiudad[c] = []
        byCiudad[c].push(op.nombre)
      })
      adminLines.push(``)
      adminLines.push(`🔴 <b>ALERTA — Sin ventas hace +3 días (${inactivos.length}):</b>`)
      for (const [c, names] of Object.entries(byCiudad)) {
        adminLines.push(`   ${escapeHtml(c)}: ${names.map(escapeHtml).join(', ')}`)
      }
    }

    const telRes = await notifyAdmin(adminLines.join('\n'))
    if (!telRes || !telRes.ok) {
      throw new Error(`Telegram error: ${JSON.stringify(telRes)}`)
    }

    return Response.json({ ok: true, ventas: ventasHoy.length, inactivos: inactivos.length })
  } catch (err) {
    console.error('notify/daily error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}

