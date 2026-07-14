/**
 * GET /api/notify/daily
 * Resumen diario de ventas por operativo (Briefing Matutino).
 * Cron: 12:00 UTC (07:00 AM Ecuador)
 */
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin, notifyCity, formatMoney, progressBar, escapeHtml, getEcuadorTime, ecToUTC } from '@/lib/telegram'

export async function GET(req) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
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
    
    // Este CRON corre a las 7AM, así que "Ayer" es hace 1 día
    const ecYesterday = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate() - 1, 0, 0, 0, 0))
    const ecYesterdayEnd = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate() - 1, 23, 59, 59, 999))
    
    const yesterdayStartUTC = ecToUTC(ecYesterday)
    const yesterdayEndUTC = ecToUTC(ecYesterdayEnd)
    
    // Inicio de mes (del mes de "ayer", por si es día 1 del mes y estamos evaluando el 31 del anterior)
    const ecMonthStart = new Date(Date.UTC(ecYesterday.getUTCFullYear(), ecYesterday.getUTCMonth(), 1, 0, 0, 0, 0))
    const startOfMonthUTC = ecToUTC(ecMonthStart)

    const diaAyer = ecYesterday.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guayaquil' })

    // --- Ejecutar las 4 consultas pesadas en paralelo ---
    const [
      { data: allOps, error: errorAllOps },
      { data: ventasMes, error: errorVentasMes },
      { data: cotizacionesAyer, error: errorCotiz },
      { data: ventasAyer, error: errorVentas }
    ] = await Promise.all([
      supabase.from('profiles').select('id, nombre, ciudad, meta_mensual').eq('rol', 'operativo').order('ciudad'),
      supabase.from('ventas').select('comision, utilidad, operativo_id').eq('estado', 'activa').gte('created_at', startOfMonthUTC.toISOString()).lte('created_at', yesterdayEndUTC.toISOString()),
      supabase.from('cotizaciones').select('operativo_id').gte('created_at', yesterdayStartUTC.toISOString()).lte('created_at', yesterdayEndUTC.toISOString()),
      supabase.from('ventas').select('comision, utilidad, operativo_id').eq('estado', 'activa').gte('created_at', yesterdayStartUTC.toISOString()).lte('created_at', yesterdayEndUTC.toISOString())
    ])

    if (errorAllOps) throw new Error(`Error operativos: ${errorAllOps.message}`)
    if (errorVentasMes) throw new Error(`Error ventas mes: ${errorVentasMes.message}`)
    if (errorCotiz) throw new Error(`Error cotizaciones: ${errorCotiz.message}`)
    if (errorVentas) throw new Error(`Error ventas: ${errorVentas.message}`)

    // Mapa de progreso de meta por operativo
    const progresoMes = {}
    for (const op of allOps) {
      progresoMes[op.id] = 0
    }
    for (const v of (ventasMes || [])) {
      if (progresoMes[v.operativo_id] !== undefined) {
        progresoMes[v.operativo_id] += Number(v.comision || 0) + Number(v.utilidad || 0)
      }
    }

    // --- Agrupar datos por operativo ---
    const datosOperativos = {}
    for (const op of allOps) {
      datosOperativos[op.id] = {
        nombre: op.nombre,
        ciudad: (op.ciudad || 'Otra').toUpperCase(),
        meta: Number(op.meta_mensual || 5000),
        cotsAyer: 0,
        ventasAyerCount: 0,
        gananciaAyer: 0,
        aporteMes: progresoMes[op.id]
      }
    }

    for (const c of (cotizacionesAyer || [])) {
      if (datosOperativos[c.operativo_id]) datosOperativos[c.operativo_id].cotsAyer += 1
    }

    let gananciaGlobalAyer = 0
    for (const v of (ventasAyer || [])) {
      if (datosOperativos[v.operativo_id]) {
        datosOperativos[v.operativo_id].ventasAyerCount += 1
        const ganancia = Number(v.comision || 0) + Number(v.utilidad || 0)
        datosOperativos[v.operativo_id].gananciaAyer += ganancia
        gananciaGlobalAyer += ganancia
      }
    }

    // --- Construir Mensaje de Telegram ---
    const adminLines = [
      `🌅 <b>BRIEFING MATUTINO CTB</b>`,
      `📅 <i>Resumen de ayer: ${diaAyer}</i>`,
      ``
    ]

    // Agrupar por ciudad para orden
    const porCiudad = {}
    for (const op of allOps) {
      const d = datosOperativos[op.id]
      if (!porCiudad[d.ciudad]) porCiudad[d.ciudad] = []
      porCiudad[d.ciudad].push(d)
    }

    for (const [ciudad, ops] of Object.entries(porCiudad)) {
      adminLines.push(`🏙 <b>${escapeHtml(ciudad)}</b>`)
      for (const op of ops) {
        const pct = op.meta > 0 ? (op.aporteMes / op.meta) * 100 : 0
        adminLines.push(`👤 <b>Asesor:</b> ${escapeHtml(op.nombre)}`)
        adminLines.push(`📝 Cotizaciones hechas: <code>${op.cotsAyer}</code>`)
        adminLines.push(`✅ Ventas cerradas: <code>${op.ventasAyerCount}</code>`)
        adminLines.push(`📊 Progreso Mes: <code>${pct.toFixed(1)}% ${progressBar(pct)}</code>`)
        adminLines.push(`💼 Utilidad de CTB ayer: <code>${formatMoney(op.gananciaAyer)}</code>`)
        adminLines.push(``)
      }
    }

    adminLines.push(`🌍 <b>UTILIDAD GLOBAL AYER:</b> <code>${formatMoney(gananciaGlobalAyer)}</code>`)

    const telRes = await notifyAdmin(adminLines.join('\n'))
    if (!telRes || !telRes.ok) {
      throw new Error(`Telegram error: ${JSON.stringify(telRes)}`)
    }

    return Response.json({ ok: true, gananciaGlobalAyer })
  } catch (err) {
    console.error('notify/daily error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
