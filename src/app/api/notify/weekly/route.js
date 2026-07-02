/**
 * GET /api/notify/weekly
 * Resumen semanal de ventas por operativo.
 * Cron: 12:00 UTC Sábado (07:00 AM Ecuador)
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
    
    // El cron corre el Sábado en la mañana. Evaluamos los últimos 7 días (Sábado pasado a Viernes ayer).
    // Fin de la semana evaluada = Ayer a las 23:59:59
    const ecEnd = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate() - 1, 23, 59, 59, 999))
    // Inicio = Hace 7 días a las 00:00:00 (O sea, 6 días antes de ayer, total 7 días con ayer incluido)
    const ecStart = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate() - 7, 0, 0, 0, 0))
    
    const weekStartUTC = ecToUTC(ecStart)
    const weekEndUTC = ecToUTC(ecEnd)
    
    // Inicio de mes para la meta
    const ecMonthStart = new Date(Date.UTC(ecEnd.getUTCFullYear(), ecEnd.getUTCMonth(), 1, 0, 0, 0, 0))
    const startOfMonthUTC = ecToUTC(ecMonthStart)

    const labelInicio = ecStart.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
    const labelFin = ecEnd.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })

    // --- 1. Todos los operativos ---
    const { data: allOps, error: errorAllOps } = await supabase
      .from('profiles')
      .select('id, nombre, ciudad, meta_mensual')
      .eq('rol', 'operativo')
      .order('ciudad')

    if (errorAllOps) throw new Error(`Error operativos: ${errorAllOps.message}`)

    // --- 2. Ventas del mes (para % meta) ---
    const { data: ventasMes, error: errorVentasMes } = await supabase
      .from('ventas')
      .select('comision, utilidad, operativo_id')
      .eq('estado', 'activa')
      .gte('created_at', startOfMonthUTC.toISOString())
      .lte('created_at', weekEndUTC.toISOString())

    if (errorVentasMes) throw new Error(`Error ventas mes: ${errorVentasMes.message}`)

    const progresoMes = {}
    for (const op of allOps) progresoMes[op.id] = 0
    for (const v of (ventasMes || [])) {
      if (progresoMes[v.operativo_id] !== undefined) {
        progresoMes[v.operativo_id] += Number(v.comision || 0) + Number(v.utilidad || 0)
      }
    }

    // --- 3. Cotizaciones Semana ---
    const { data: cotizaciones, error: errorCotiz } = await supabase
      .from('cotizaciones')
      .select('operativo_id')
      .gte('created_at', weekStartUTC.toISOString())
      .lte('created_at', weekEndUTC.toISOString())

    if (errorCotiz) throw new Error(`Error cotizaciones: ${errorCotiz.message}`)

    // --- 4. Ventas Semana ---
    const { data: ventasSemana, error: errorVentas } = await supabase
      .from('ventas')
      .select('comision, utilidad, operativo_id')
      .eq('estado', 'activa')
      .gte('created_at', weekStartUTC.toISOString())
      .lte('created_at', weekEndUTC.toISOString())

    if (errorVentas) throw new Error(`Error ventas: ${errorVentas.message}`)

    const datosOperativos = {}
    for (const op of allOps) {
      datosOperativos[op.id] = {
        nombre: op.nombre,
        ciudad: (op.ciudad || 'Otra').toUpperCase(),
        meta: Number(op.meta_mensual || 5000),
        cots: 0,
        ventasCount: 0,
        ganancia: 0,
        aporteMes: progresoMes[op.id]
      }
    }

    for (const c of (cotizaciones || [])) {
      if (datosOperativos[c.operativo_id]) datosOperativos[c.operativo_id].cots += 1
    }

    let gananciaGlobal = 0
    for (const v of (ventasSemana || [])) {
      if (datosOperativos[v.operativo_id]) {
        datosOperativos[v.operativo_id].ventasCount += 1
        const ganancia = Number(v.comision || 0) + Number(v.utilidad || 0)
        datosOperativos[v.operativo_id].ganancia += ganancia
        gananciaGlobal += ganancia
      }
    }

    const adminLines = [
      `📅 <b>RESUMEN SEMANAL CTB</b>`,
      `<i>Del ${labelInicio} al ${labelFin}</i>`,
      ``
    ]

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
        adminLines.push(`📝 Cotizaciones: <code>${op.cots}</code>`)
        adminLines.push(`✅ Ventas cerradas: <code>${op.ventasCount}</code>`)
        adminLines.push(`📊 Progreso Mes: <code>${pct.toFixed(1)}% ${progressBar(pct)}</code>`)
        adminLines.push(`💼 Utilidad de CTB Semanal: <code>${formatMoney(op.ganancia)}</code>`)
        adminLines.push(``)
      }
    }

    adminLines.push(`🌍 <b>UTILIDAD GLOBAL SEMANA:</b> <code>${formatMoney(gananciaGlobal)}</code>`)

    const telRes = await notifyAdmin(adminLines.join('\n'))
    if (!telRes || !telRes.ok) throw new Error(`Telegram error: ${JSON.stringify(telRes)}`)

    return Response.json({ ok: true, gananciaGlobal })
  } catch (err) {
    console.error('notify/weekly error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
