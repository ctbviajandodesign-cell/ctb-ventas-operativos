/**
 * GET /api/notify/monthly
 * Resumen mensual de ventas por operativo.
 * Cron: 05:00 UTC Día 1 del mes (00:00 AM Ecuador, medianoche exacta del último día del mes)
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
    
    // Este CRON corre a las 00:00 AM del día 1 del nuevo mes.
    // Para obtener el mes que acabamos de cerrar, retrocedemos 1 hora (23:00 PM del último día).
    const ecLastDayOfMonth = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), ecNow.getUTCDate(), ecNow.getUTCHours() - 1, 0, 0, 0))
    
    // Inicio del mes cerrado
    const ecStart = new Date(Date.UTC(ecLastDayOfMonth.getUTCFullYear(), ecLastDayOfMonth.getUTCMonth(), 1, 0, 0, 0, 0))
    // Fin del mes cerrado
    const ecEnd = new Date(Date.UTC(ecLastDayOfMonth.getUTCFullYear(), ecLastDayOfMonth.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    
    const monthStartUTC = ecToUTC(ecStart)
    const monthEndUTC = ecToUTC(ecEnd)

    const mesNombre = ecLastDayOfMonth.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }).toUpperCase()

    // --- 1. Todos los operativos ---
    const { data: allOps, error: errorAllOps } = await supabase
      .from('profiles')
      .select('id, nombre, ciudad, meta_mensual')
      .eq('rol', 'operativo')
      .order('ciudad')

    if (errorAllOps) throw new Error(`Error operativos: ${errorAllOps.message}`)

    // --- 2. Cotizaciones del Mes ---
    const { data: cotizaciones, error: errorCotiz } = await supabase
      .from('cotizaciones')
      .select('operativo_id')
      .gte('created_at', monthStartUTC.toISOString())
      .lte('created_at', monthEndUTC.toISOString())

    if (errorCotiz) throw new Error(`Error cotizaciones: ${errorCotiz.message}`)

    // --- 3. Ventas del Mes ---
    const { data: ventasMes, error: errorVentas } = await supabase
      .from('ventas')
      .select('comision, utilidad, operativo_id')
      .eq('estado', 'activa')
      .gte('created_at', monthStartUTC.toISOString())
      .lte('created_at', monthEndUTC.toISOString())

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
        aporteMes: 0
      }
    }

    for (const c of (cotizaciones || [])) {
      if (datosOperativos[c.operativo_id]) datosOperativos[c.operativo_id].cots += 1
    }

    let gananciaGlobal = 0
    for (const v of (ventasMes || [])) {
      if (datosOperativos[v.operativo_id]) {
        datosOperativos[v.operativo_id].ventasCount += 1
        const ganancia = Number(v.comision || 0) + Number(v.utilidad || 0)
        datosOperativos[v.operativo_id].ganancia += ganancia
        datosOperativos[v.operativo_id].aporteMes += ganancia
        gananciaGlobal += ganancia
      }
    }

    const adminLines = [
      `🏆 <b>CIERRE DE MES CTB</b>`,
      `<i>Mes de ${mesNombre}</i>`,
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
        adminLines.push(`💼 Ganancia CTB Total: <code>${formatMoney(op.ganancia)}</code>`)
        adminLines.push(``)
      }
    }

    adminLines.push(`🌎 <b>GANANCIA GLOBAL DEL MES:</b> <code>${formatMoney(gananciaGlobal)}</code>`)
    adminLines.push(`🎉 ¡Gran trabajo equipo! Comienza un nuevo mes.`)

    const telRes = await notifyAdmin(adminLines.join('\n'))
    if (!telRes || !telRes.ok) throw new Error(`Telegram error: ${JSON.stringify(telRes)}`)

    return Response.json({ ok: true, gananciaGlobal })
  } catch (err) {
    console.error('notify/monthly error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
