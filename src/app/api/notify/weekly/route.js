/**
 * GET /api/notify/weekly
 * Resumen semanal (lunes a domingo actual).
 * Cron: viernes a las 8pm Ecuador (01:00 UTC sábado)
 * Protegido por CRON_SECRET header.
 */
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin, notifyCity, formatMoney } from '@/lib/telegram'

export async function GET(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Lunes de esta semana
    const now = new Date()
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dayOfWeek - 1))
    monday.setHours(0, 0, 0, 0)

    const { data: ventas } = await supabase
      .from('ventas')
      .select('total, comision, utilidad, operativo_id, profiles!inner(nombre, ciudad, meta_mensual)')
      .eq('estado', 'activa')
      .gte('created_at', monday.toISOString())

    if (!ventas || ventas.length === 0) {
      await notifyAdmin(`📋 <b>Resumen Semanal CTB</b>\n\nSin ventas registradas esta semana aún.`)
      return Response.json({ ok: true, ventas: 0 })
    }

    // Agrupar por ciudad y operativo
    const porCiudad = {}
    let globalVentas = 0, globalAporte = 0

    for (const v of ventas) {
      const ciudad = (v.profiles?.ciudad || 'otra').toLowerCase()
      const nombre = v.profiles?.nombre || 'N/A'
      const total = Number(v.total || 0)
      const aporte = (Number(v.comision || 0) + Number(v.utilidad || 0))

      if (!porCiudad[ciudad]) porCiudad[ciudad] = { ops: {}, total: 0, aporte: 0 }
      if (!porCiudad[ciudad].ops[nombre]) porCiudad[ciudad].ops[nombre] = { total: 0, aporte: 0, count: 0 }

      porCiudad[ciudad].ops[nombre].total += total
      porCiudad[ciudad].ops[nombre].aporte += aporte
      porCiudad[ciudad].ops[nombre].count += 1
      porCiudad[ciudad].total += total
      porCiudad[ciudad].aporte += aporte
      globalVentas += total
      globalAporte += aporte
    }

    const semana = `${monday.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} – ${now.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}`

    // Resumen semanal → solo admin (los grupos solo reciben venta inmediata y morning)

    // Resumen admin global
    const adminLines = [
      `🗓 <b>RESUMEN SEMANAL GLOBAL CTB</b>`,
      `<i>Semana del ${semana}</i>`,
      ``
    ]
    for (const [ciudad, data] of Object.entries(porCiudad)) {
      const topOp = Object.entries(data.ops).sort((a, b) => b[1].total - a[1].total)[0]
      adminLines.push(`🏙 <b>${ciudad.toUpperCase()}</b>: ${formatMoney(data.total)}`)
      if (topOp) adminLines.push(`   👑 Mejor: ${topOp[0]} · ${formatMoney(topOp[1].total)}`)
    }
    adminLines.push(``)
    adminLines.push(`💼 <b>Total global: ${formatMoney(globalVentas)}</b>  |  Aporte CTB: ${formatMoney(globalAporte)}`)
    adminLines.push(`📁 Ventas totales: ${ventas.length}`)

    await notifyAdmin(adminLines.join('\n'))

    return Response.json({ ok: true, ventas: ventas.length })
  } catch (err) {
    console.error('notify/weekly error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
