/**
 * GET /api/notify/monthly
 * Informe mensual de cierre — último día del mes.
 * Cron: último día del mes a las 8pm Ecuador (01:00 UTC)
 * Protegido por CRON_SECRET header.
 * Mejoras: análisis de motivos de pérdida por frecuencia,
 *           tasa de conversión por operativo, desglose completo.
 */
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin, notifyCity, formatMoney, progressBar } from '@/lib/telegram'

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
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const mesNombre = now.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })

    // Ventas del mes
    const { data: ventas } = await supabase
      .from('ventas')
      .select('total, comision, utilidad, operativo_id, profiles!inner(nombre, ciudad, meta_mensual)')
      .eq('estado', 'activa')
      .gte('created_at', startOfMonth.toISOString())

    // Cotizaciones del mes (para tasa de cierre y motivos de pérdida)
    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('estado, operativo_id, motivo_perdida, profiles!inner(nombre, ciudad)')
      .gte('created_at', startOfMonth.toISOString())

    // Todos los operativos
    const { data: allOps } = await supabase
      .from('profiles')
      .select('id, nombre, ciudad, meta_mensual')
      .eq('rol', 'operativo')

    // --- Construir mapa de operativos ---
    const ops = {}

    // Inicializar todos los operativos (incluso sin ventas)
    for (const op of (allOps || [])) {
      ops[op.id] = {
        nombre: op.nombre,
        ciudad: op.ciudad || '',
        meta: Number(op.meta_mensual || 5000),
        ventas: 0, comision: 0, utilidad: 0, count: 0,
        ganadas: 0, perdidas: 0, anuladas: 0, abiertas: 0
      }
    }

    // Sumar ventas
    for (const v of (ventas || [])) {
      const id = v.operativo_id
      if (!ops[id]) continue
      ops[id].ventas += Number(v.total || 0)
      ops[id].comision += Number(v.comision || 0)
      ops[id].utilidad += Number(v.utilidad || 0)
      ops[id].count += 1
    }

    // Sumar cotizaciones
    for (const c of (cots || [])) {
      const id = c.operativo_id
      if (!ops[id]) continue
      if (c.estado === 'vendida' || c.estado === 'ganada') ops[id].ganadas++
      else if (c.estado === 'perdida') ops[id].perdidas++
      else if (c.estado === 'anulada') ops[id].anuladas++
      else ops[id].abiertas++
    }

    // --- Análisis global de motivos de pérdida ---
    const motivosMap = {}
    for (const c of (cots || [])) {
      if ((c.estado === 'perdida' || c.estado === 'anulada') && c.motivo_perdida) {
        const m = c.motivo_perdida.trim()
        if (m) motivosMap[m] = (motivosMap[m] || 0) + 1
      }
    }
    const motivosOrdenados = Object.entries(motivosMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // Top 8 razones

    // --- Totales globales ---
    const globalVentas = Object.values(ops).reduce((a, o) => a + o.ventas, 0)
    const globalComision = Object.values(ops).reduce((a, o) => a + o.comision, 0)
    const globalUtilidad = Object.values(ops).reduce((a, o) => a + o.utilidad, 0)
    const globalAporte = globalComision + globalUtilidad
    const globalMeta = Object.values(ops).reduce((a, o) => a + o.meta, 0)
    const globalPct = globalMeta > 0 ? (globalAporte / globalMeta) * 100 : 0
    const globalGanadas = Object.values(ops).reduce((a, o) => a + o.ganadas, 0)
    const globalPerdidas = Object.values(ops).reduce((a, o) => a + o.perdidas + o.anuladas, 0)

    // Agrupar por ciudad
    const porCiudad = {}
    for (const op of Object.values(ops)) {
      const c = (op.ciudad || 'otra').toLowerCase()
      if (!porCiudad[c]) porCiudad[c] = []
      porCiudad[c].push(op)
    }

    // --- Mensaje por ciudad ---
    for (const [ciudad, opsList] of Object.entries(porCiudad)) {
      const sorted = opsList.sort((a, b) => b.ventas - a.ventas)

      // Motivos de pérdida de esta ciudad
      const motivosCiudad = {}
      for (const c of (cots || [])) {
        const op = ops[c.operativo_id]
        if (!op || (op.ciudad || '').toLowerCase() !== ciudad) continue
        if ((c.estado === 'perdida' || c.estado === 'anulada') && c.motivo_perdida?.trim()) {
          const m = c.motivo_perdida.trim()
          motivosCiudad[m] = (motivosCiudad[m] || 0) + 1
        }
      }
      const top3Motivos = Object.entries(motivosCiudad)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

      const lines = [
        `🏁 <b>CIERRE DE MES — ${ciudad.toUpperCase()}</b>`,
        `<i>${mesNombre}</i>`,
        ``
      ]

      for (const [i, op] of sorted.entries()) {
        const aporte = op.comision + op.utilidad
        const pct = op.meta > 0 ? (aporte / op.meta) * 100 : 0
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️'
        const totalCots = op.ganadas + op.perdidas + op.anuladas + op.abiertas
        const tasaCierre = totalCots > 0 ? ((op.ganadas / totalCots) * 100).toFixed(0) : 0
        const metaIcon = pct >= 100 ? '🏆' : pct >= 75 ? '🔥' : pct >= 50 ? '📈' : '⚠️'

        lines.push(`${medal} <b>${op.nombre}</b> ${metaIcon}`)
        lines.push(`   💰 Ventas: ${formatMoney(op.ventas)}  |  Aporte: ${formatMoney(aporte)}`)
        lines.push(`   <code>${progressBar(pct)}</code> ${pct.toFixed(1)}% de ${formatMoney(op.meta)}`)
        lines.push(`   ✅ ${op.ganadas} cierres · ❌ ${op.perdidas + op.anuladas} pérdidas · 📊 Cierre: ${tasaCierre}%`)
      }

      const totalVentasCiudad = opsList.reduce((a, o) => a + o.ventas, 0)
      const totalAporteCiudad = opsList.reduce((a, o) => a + o.comision + o.utilidad, 0)
      lines.push(``)
      lines.push(`🏙 Total ${ciudad.toUpperCase()}: <b>${formatMoney(totalVentasCiudad)}</b>  |  Aporte: ${formatMoney(totalAporteCiudad)}`)

      if (top3Motivos.length > 0) {
        lines.push(``)
        lines.push(`📋 <b>Por qué no cerramos:</b>`)
        top3Motivos.forEach(([m, n], i) => {
          lines.push(`   ${i + 1}. ${m} (${n}x)`)
        })
      }

      await notifyCity(ciudad, lines.join('\n'))
    }

    // --- Informe admin global completo ---
    const adminLines = [
      `📊 <b>INFORME DE CIERRE MENSUAL CTB</b>`,
      `<i>${mesNombre}</i>`,
      ``,
      `💼 <b>Total Facturado: ${formatMoney(globalVentas)}</b>`,
      `💰 Comisiones: ${formatMoney(globalComision)}  |  Utilidades: ${formatMoney(globalUtilidad)}`,
      `📈 <b>Aporte total CTB: ${formatMoney(globalAporte)}</b>`,
      `🎯 Meta Global: ${formatMoney(globalMeta)}`,
      `<code>${progressBar(globalPct)}</code> ${globalPct.toFixed(1)}%`,
      ``
    ]

    // Resumen por ciudad
    for (const [ciudad, opsList] of Object.entries(porCiudad)) {
      const top = opsList.sort((a, b) => (b.comision + b.utilidad) - (a.comision + a.utilidad))[0]
      const cityAporte = opsList.reduce((a, o) => a + o.comision + o.utilidad, 0)
      const cityVentas = opsList.reduce((a, o) => a + o.ventas, 0)
      adminLines.push(`🏙 <b>${ciudad.toUpperCase()}</b>: ${formatMoney(cityVentas)} · Aporte: ${formatMoney(cityAporte)}`)
      if (top) adminLines.push(`   MVP: ${top.nombre} · ${((top.comision + top.utilidad) / (top.meta || 1) * 100).toFixed(0)}% meta`)
    }

    adminLines.push(``)
    adminLines.push(`✅ Cierres ganados: <b>${globalGanadas}</b>  |  ❌ Pérdidas/Anuladas: ${globalPerdidas}`)

    // Quién llegó a meta y quién no
    const allOpsList = Object.values(ops)
    const llegaron = allOpsList.filter(o => (o.comision + o.utilidad) >= o.meta)
    const noLlegaron = allOpsList.filter(o => (o.comision + o.utilidad) < o.meta)
      .sort((a, b) => {
        const pctA = (a.comision + a.utilidad) / a.meta
        const pctB = (b.comision + b.utilidad) / b.meta
        return pctB - pctA
      })

    if (llegaron.length > 0) {
      adminLines.push(``)
      adminLines.push(`🏆 <b>Cumplieron meta (${llegaron.length}):</b>`)
      llegaron.forEach(o => adminLines.push(`   🟢 ${o.nombre} (${o.ciudad}) — ${((o.comision + o.utilidad) / o.meta * 100).toFixed(0)}%`))
    }
    if (noLlegaron.length > 0) {
      adminLines.push(``)
      adminLines.push(`⚠️ <b>No cumplieron meta (${noLlegaron.length}):</b>`)
      noLlegaron.forEach(o => {
        const pct = o.meta > 0 ? ((o.comision + o.utilidad) / o.meta * 100).toFixed(0) : 0
        adminLines.push(`   🔴 ${o.nombre} (${o.ciudad}) — ${pct}% · Faltó: ${formatMoney(Math.max(0, o.meta - (o.comision + o.utilidad)))}`)
      })
    }

    // Motivos de pérdida globales ordenados por frecuencia
    if (motivosOrdenados.length > 0) {
      adminLines.push(``)
      adminLines.push(`📋 <b>¿Por qué no se vendió? — Top razones del mes:</b>`)
      motivosOrdenados.forEach(([m, n], i) => {
        adminLines.push(`   ${i + 1}. ${m} — <b>${n} caso${n > 1 ? 's' : ''}</b>`)
      })
    } else {
      adminLines.push(``)
      adminLines.push(`📋 Sin motivos de pérdida registrados este mes.`)
    }

    await notifyAdmin(adminLines.join('\n'))

    return Response.json({ ok: true, operativos: allOpsList.length, motivosCount: motivosOrdenados.length })
  } catch (err) {
    console.error('notify/monthly error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
