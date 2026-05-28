/**
 * GET /api/notify/operativos-dia
 * Informe diario matutino para ADMIN con actividad del día anterior por operativo:
 *   - Cuántas cotizaciones ingresó
 *   - Cuántas ventas cerró
 *   - Monto vendido (total de ventas cerradas)
 *   - Ingreso CTB = comisión + utilidad (aporte a su meta)
 *
 * Cron: todos los días a las 7:13am Ecuador (12:13 UTC) → 13 12 * * *
 * Protegido por CRON_SECRET header.
 */
export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { notifyAdmin, formatMoney, escapeHtml, getEcuadorTime, ecToUTC } from '@/lib/telegram'

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
    
    // Inicio de ayer en Ecuador (00:00:00)
    const ecYesterdayStart = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate() - 1, 0, 0, 0, 0))
    const ayerInicioUTC = ecToUTC(ecYesterdayStart)
    
    // Fin de ayer en Ecuador (23:59:59.999)
    const ecYesterdayEnd = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate() - 1, 23, 59, 59, 999))
    const ayerFinUTC = ecToUTC(ecYesterdayEnd)

    const diaAyer = now.toLocaleDateString('es-EC', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Guayaquil'
    })

    // --- Todos los operativos ---
    const { data: allOps, error: errorAllOps } = await supabase
      .from('profiles')
      .select('id, nombre, ciudad, meta_mensual')
      .eq('rol', 'operativo')

    if (errorAllOps) throw new Error(`Error al obtener operativos: ${errorAllOps.message}`)
    if (!allOps || allOps.length === 0) {
      return Response.json({ ok: true, message: 'No hay operativos registrados' })
    }

    // --- Cotizaciones creadas ayer ---
    const { data: cotsAyer, error: errorCotsAyer } = await supabase
      .from('cotizaciones')
      .select('operativo_id')
      .gte('created_at', ayerInicioUTC.toISOString())
      .lt('created_at', ayerFinUTC.toISOString())

    if (errorCotsAyer) throw new Error(`Error al obtener cotizaciones de ayer: ${errorCotsAyer.message}`)

    // --- Ventas cerradas ayer ---
    const { data: ventasAyer, error: errorVentasAyer } = await supabase
      .from('ventas')
      .select('total, comision, utilidad, operativo_id')
      .eq('estado', 'activa')
      .gte('created_at', ayerInicioUTC.toISOString())
      .lt('created_at', ayerFinUTC.toISOString())

    if (errorVentasAyer) throw new Error(`Error al obtener ventas de ayer: ${errorVentasAyer.message}`)

    // --- Construir mapa por operativo ---
    const statsMap = {}
    for (const op of allOps) {
      statsMap[op.id] = {
        nombre: op.nombre,
        ciudad: op.ciudad || '',
        meta: Number(op.meta_mensual || 5000),
        cotizaciones: 0,
        ventas: 0,
        montoVendido: 0,
        ingresoCTB: 0, // comision + utilidad
      }
    }

    for (const c of (cotsAyer || [])) {
      if (statsMap[c.operativo_id]) {
        statsMap[c.operativo_id].cotizaciones++
      }
    }

    for (const v of (ventasAyer || [])) {
      if (statsMap[v.operativo_id]) {
        statsMap[v.operativo_id].ventas++
        statsMap[v.operativo_id].montoVendido += Number(v.total || 0)
        statsMap[v.operativo_id].ingresoCTB += Number(v.comision || 0) + Number(v.utilidad || 0)
      }
    }

    // --- Agrupar por ciudad ---
    const porCiudad = {}
    for (const op of allOps) {
      const ciudad = (op.ciudad || 'sin ciudad').toLowerCase()
      if (!porCiudad[ciudad]) porCiudad[ciudad] = []
      porCiudad[ciudad].push(statsMap[op.id])
    }

    // --- Totales globales ---
    const allStats = Object.values(statsMap)
    const totalCots = allStats.reduce((a, o) => a + o.cotizaciones, 0)
    const totalVentas = allStats.reduce((a, o) => a + o.ventas, 0)
    const totalMonto = allStats.reduce((a, o) => a + o.montoVendido, 0)
    const totalIngreso = allStats.reduce((a, o) => a + o.ingresoCTB, 0)

    const sinActividadAyer = allStats.filter(o => o.cotizaciones === 0 && o.ventas === 0)
    const sinVentaAyer = allStats.filter(o => o.ventas === 0 && o.cotizaciones > 0)

    // --- Construir mensaje ---
    const lines = [
      `🌅 <b>INFORME DIARIO DE OPERATIVOS — CTB</b>`,
      `<i>${diaAyer}</i>`,
      ``,
    ]

    for (const [ciudad, ops] of Object.entries(porCiudad)) {
      // Ordenar: primero los que más vendieron
      const sorted = ops.sort((a, b) => b.montoVendido - a.montoVendido || b.cotizaciones - a.cotizaciones)

      const cityMonto = ops.reduce((a, o) => a + o.montoVendido, 0)
      const cityIngreso = ops.reduce((a, o) => a + o.ingresoCTB, 0)

      lines.push(`🏙 <b>${escapeHtml(ciudad.toUpperCase())}</b>`)

      for (const op of sorted) {
        const hasCots = op.cotizaciones > 0
        const hasVentas = op.ventas > 0
        const actividadEmoji = hasVentas ? '✅' : hasCots ? '📋' : '💤'

        lines.push(``)
        lines.push(`${actividadEmoji} <b>${escapeHtml(op.nombre)}</b>`)
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

    // --- Resumen global ---
    lines.push(`─────────────────────`)
    lines.push(`📊 <b>RESUMEN GLOBAL DEL DÍA</b>`)
    lines.push(`   📋 Cotizaciones totales: <b>${totalCots}</b>`)
    lines.push(`   💼 Ventas cerradas: <b>${totalVentas}</b>`)
    lines.push(`   💵 Monto total vendido: <b>${formatMoney(totalMonto)}</b>`)
    lines.push(`   📈 Ingreso total CTB: <b>${formatMoney(totalIngreso)}</b>`)

    if (sinActividadAyer.length > 0) {
      lines.push(``)
      lines.push(`💤 <b>Sin actividad ayer (${sinActividadAyer.length}):</b>`)
      sinActividadAyer.forEach(o => lines.push(`   · ${escapeHtml(o.nombre)}${o.ciudad ? ` (${escapeHtml(o.ciudad)})` : ''}`))
    }

    if (sinVentaAyer.length > 0) {
      lines.push(``)
      lines.push(`📋 <b>Cotizaron pero no cerraron venta (${sinVentaAyer.length}):</b>`)
      sinVentaAyer.forEach(o =>
        lines.push(`   · ${escapeHtml(o.nombre)} — ${o.cotizaciones} cot${o.cotizaciones > 1 ? 's' : ''}`)
      )
    }

    const telRes = await notifyAdmin(lines.join('\n'))
    if (!telRes || !telRes.ok) {
      throw new Error(`Telegram error: ${JSON.stringify(telRes)}`)
    }

    return Response.json({
      ok: true,
      operativos: allOps.length,
      cotizaciones: totalCots,
      ventas: totalVentas,
      montoVendido: totalMonto,
      ingresoCTB: totalIngreso,
    })
  } catch (err) {
    console.error('notify/operativos-dia error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
