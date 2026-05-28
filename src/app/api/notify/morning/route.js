/**
 * GET /api/notify/morning
 * Motivacional de arranque del día con ranking del mes hasta hoy.
 * Cron: lunes–viernes 8am Ecuador (13:00 UTC)
 * Si es día 15, envía alerta especial de mitad de mes.
 * Protegido por CRON_SECRET header.
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
    const dayOfMonth = ecNow.getUTCDate()
    const isMidMonth = dayOfMonth === 15
    const isMonday = ecNow.getUTCDay() === 1

    if (!isMonday && !isMidMonth) {
      return Response.json({ ok: true, message: 'Skipped morning report: only runs on Mondays or mid-month (day 15)' })
    }

    // Inicio del mes en hora Ecuador → convertir a UTC para Supabase
    const ecMonthStart = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth(), 1, 0, 0, 0, 0))
    const startOfMonthUTC = ecToUTC(ecMonthStart)

    const mesNombre = now.toLocaleDateString('es-EC', { month: 'long', year: 'numeric', timeZone: 'America/Guayaquil' })
    const diaHoy = now.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guayaquil' })

    // Todos los operativos con su meta
    const { data: allOps, error: errorAllOps } = await supabase
      .from('profiles')
      .select('id, nombre, ciudad, meta_mensual')
      .eq('rol', 'operativo')

    if (errorAllOps) throw new Error(`Error al obtener operativos: ${errorAllOps.message}`)
    if (!allOps || allOps.length === 0) {
      return Response.json({ ok: true, message: 'No operatives found' })
    }

    // Ventas del mes hasta hoy (aporte = comisión + utilidad)
    const { data: ventasMes, error: errorVentasMes } = await supabase
      .from('ventas')
      .select('total, comision, utilidad, operativo_id')
      .eq('estado', 'activa')
      .gte('created_at', startOfMonthUTC.toISOString())

    if (errorVentasMes) throw new Error(`Error al obtener ventas del mes: ${errorVentasMes.message}`)

    // Calcular aporte por operativo
    const aporteMap = {}
    for (const v of (ventasMes || [])) {
      const id = v.operativo_id
      if (!aporteMap[id]) aporteMap[id] = { total: 0, aporte: 0, count: 0 }
      aporteMap[id].total += Number(v.total || 0)
      aporteMap[id].aporte += Number(v.comision || 0) + Number(v.utilidad || 0)
      aporteMap[id].count += 1
    }

    // Agrupar por ciudad y construir ranking
    const porCiudad = {}
    for (const op of allOps) {
      const ciudad = (op.ciudad || 'otra').toLowerCase()
      if (!porCiudad[ciudad]) porCiudad[ciudad] = []
      const stats = aporteMap[op.id] || { total: 0, aporte: 0, count: 0 }
      const meta = Number(op.meta_mensual || 5000)
      const pct = meta > 0 ? (stats.aporte / meta) * 100 : 0
      porCiudad[ciudad].push({
        nombre: op.nombre,
        meta,
        aporte: stats.aporte,
        total: stats.total,
        count: stats.count,
        pct
      })
    }

    const diasRestantes = new Date(Date.UTC(ecNow.getUTCFullYear(), ecNow.getUTCMonth() + 1, 0)).getUTCDate() - dayOfMonth
    const motivacional = isMidMonth
      ? `⚠️ <b>¡MITAD DE MES!</b> Quedan ${diasRestantes} días para cerrar ${mesNombre.toUpperCase()}.`
      : `☀️ <b>¡Buenos días equipo CTB!</b> A cerrar ${mesNombre.toUpperCase()} con todo. 💪`

    // Mensaje por ciudad
    for (const [ciudad, ops] of Object.entries(porCiudad)) {
      const sorted = ops.sort((a, b) => b.pct - a.pct)
      const lines = [
        motivacional,
        `<i>${diaHoy} — Ranking ${escapeHtml(ciudad.toUpperCase())}</i>`,
        ``
      ]

      for (const [i, op] of sorted.entries()) {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
        const emoji = op.pct >= 100 ? '🏆' : op.pct >= 75 ? '🔥' : op.pct >= 50 ? '📈' : op.pct > 0 ? '📊' : '💤'
        lines.push(`${medal} <b>${escapeHtml(op.nombre)}</b> ${emoji}`)
        lines.push(`   <code>${progressBar(op.pct)}</code> ${op.pct.toFixed(1)}%`)
        if (op.count > 0) lines.push(`   ${op.count} venta${op.count > 1 ? 's' : ''} · Meta: ${formatMoney(op.meta)}`)
        else lines.push(`   Sin ventas registradas este mes`)
      }

      if (isMidMonth) {
        const opsSinMeta = sorted.filter(o => o.pct < 50)
        if (opsSinMeta.length > 0) {
          lines.push(``)
          lines.push(`🎯 Con menos del 50% de meta: ${opsSinMeta.map(o => escapeHtml(o.nombre)).join(', ')}`)
          lines.push(`¡Es hora de acelerar! Quedan ${diasRestantes} días 🚀`)
        }
      }

      await notifyCity(ciudad, lines.join('\n'))
    }

    // Resumen admin global
    const todosOps = Object.values(porCiudad).flat()
    const globalSorted = todosOps.sort((a, b) => b.pct - a.pct)
    const globalTotal = todosOps.reduce((a, o) => a + o.total, 0)
    const globalAporte = todosOps.reduce((a, o) => a + o.aporte, 0)
    const sinVentas = todosOps.filter(o => o.count === 0)

    const adminLines = [
      `☀️ <b>RESUMEN MATUTINO ADMIN — CTB</b>`,
      `<i>${diaHoy} · ${mesNombre}</i>`,
      ``,
      `📊 <b>Ventas acumuladas mes:</b> ${formatMoney(globalTotal)}`,
      `💰 <b>Aporte total (com+util):</b> ${formatMoney(globalAporte)}`,
      ``
    ]

    for (const [ciudad, ops] of Object.entries(porCiudad)) {
      const top = ops.sort((a, b) => b.pct - a.pct)[0]
      const cityAporte = ops.reduce((a, o) => a + o.aporte, 0)
      adminLines.push(`🏙 <b>${escapeHtml(ciudad.toUpperCase())}</b>: ${formatMoney(cityAporte)} | Líder: ${escapeHtml(top.nombre)} (${top.pct.toFixed(0)}%)`)
    }

    if (sinVentas.length > 0) {
      adminLines.push(``)
      adminLines.push(`💤 <b>Sin ventas en el mes (${sinVentas.length}):</b>`)
      sinVentas.forEach(o => adminLines.push(`   · ${escapeHtml(o.nombre)}`))
    }

    if (isMidMonth) {
      adminLines.push(``)
      adminLines.push(`⚠️ <b>MITAD DE MES — ALERTA DE META</b>`)
      const atRisk = todosOps.filter(o => o.pct < 50)
      if (atRisk.length > 0) {
        adminLines.push(`Operativos en riesgo (< 50% meta):`)
        atRisk.forEach(o => adminLines.push(`   🔴 ${escapeHtml(o.nombre)}: ${o.pct.toFixed(1)}% de ${formatMoney(o.meta)}`))
      } else {
        adminLines.push(`✅ Todo el equipo supera el 50% de meta. ¡Excelente ritmo!`)
      }
    }

    const telRes = await notifyAdmin(adminLines.join('\n'))
    if (!telRes || !telRes.ok) {
      throw new Error(`Telegram error (admin): ${JSON.stringify(telRes)}`)
    }

    return Response.json({ ok: true, operativos: allOps.length, isMidMonth })
  } catch (err) {
    console.error('notify/morning error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
