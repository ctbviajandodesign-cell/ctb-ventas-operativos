/**
 * POST /api/notify/venta
 * Se llama cuando se registra una venta nueva.
 * Body: { operativo, ciudad, destino, agencia, valorTotal, metaPct, meta, aporteVenta, operativoId }
 * - Envía notificación inmediata de venta a ciudad + admin
 * - Si el operativo cruza 100% de meta → mensaje motivacional
 * - Si es el primero en llegar a meta → mensaje especial empresa
 * - Si supera 150% → mensaje extraordinario
 */
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { notifyAll, notifyGlobal, formatMoney, progressBar } from '@/lib/telegram'

export async function POST(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    const {
      operativo, ciudad, destino, agencia,
      valorTotal, metaPct, meta, aporteVenta, operativoId, isEdit
    } = await req.json()

    const pct         = Number(metaPct || 0)
    const metaAmount  = Number(meta || 5000)
    const thisAporte  = Number(aporteVenta || 0)
    // % antes de esta venta
    const pctAnterior = metaAmount > 0
      ? ((pct / 100 * metaAmount) - thisAporte) / metaAmount * 100
      : 0

    const emoji = isEdit ? '✏️' : pct >= 100 ? '🏆' : pct >= 75 ? '🔥' : pct >= 50 ? '📈' : '⚡'
    const titleText = isEdit ? 'VENTA ACTUALIZADA' : 'NUEVA VENTA'

    // ── 1. Notificación estándar de venta ─────────────────────
    const ventaText = [
      `${emoji} <b>¡${titleText} CTB — ${(ciudad || '').toUpperCase()}!</b>`,
      ``,
      `👤 <b>Asesor:</b> ${operativo}`,
      `✈️ <b>Destino:</b> ${destino || 'N/A'}  |  🏢 <b>Agencia:</b> ${agencia || 'Directo'}`,
      `💵 <b>Utilidad de CTB:</b> ${formatMoney(thisAporte)}`,
      `💰 <b>Valor Total:</b> ${formatMoney(valorTotal)}`,
      ``,
      `📊 <b>Meta del mes:</b> ${pct.toFixed(1)}% (${formatMoney((pct / 100) * metaAmount)} de ${formatMoney(metaAmount)})`,
      `<code>${progressBar(pct)}</code>`,
    ].join('\n')

    const tgRes = await notifyAll(ciudad, ventaText)

    // ── 2. Mensajes de hito de meta ────────────────────────────
    const cruzó100  = pctAnterior < 100 && pct >= 100
    const cruzó150  = pctAnterior < 150 && pct >= 150

    if (cruzó100 || cruzó150) {
      const now        = new Date()
      const mesNombre  = now.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
      const diaDelMes  = now.getDate()
      const aporteTotal = (pct / 100) * metaAmount

      // Verificar si es el primero en llegar al 100% este mes
      let esPrimero = false
      if (operativoId && cruzó100 && !cruzó150) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const { data: otrosOps }   = await supabase.from('profiles').select('id, meta_mensual').eq('rol', 'operativo').neq('id', operativoId)
        const { data: otrasVentas } = await supabase.from('ventas').select('operativo_id, comision, utilidad').eq('estado', 'activa').gte('created_at', startOfMonth.toISOString()).neq('operativo_id', operativoId)

        const aporteOtros = {}
        for (const v of (otrasVentas || [])) {
          if (!aporteOtros[v.operativo_id]) aporteOtros[v.operativo_id] = 0
          aporteOtros[v.operativo_id] += Number(v.comision || 0) + Number(v.utilidad || 0)
        }
        esPrimero = !(otrosOps || []).some(op => {
          const a = aporteOtros[op.id] || 0
          return a >= Number(op.meta_mensual || 5000)
        })
      }

      let motivMsg

      if (cruzó150) {
        // ── Resultado extraordinario (150%+) ──
        motivMsg = [
          `🚀💥 <b>¡RESULTADO EXTRAORDINARIO — ${(ciudad || '').toUpperCase()}!</b>`,
          ``,
          `<b>${operativo}</b> cerró ${mesNombre} en un nivel`,
          `que merece reconocimiento especial.`,
          ``,
          `<code>${progressBar(Math.min(pct, 100))}</code> <b>${pct.toFixed(0)}%</b> 🔥`,
          `💰 ${formatMoney(aporteTotal)} sobre ${formatMoney(metaAmount)} de meta`,
          ``,
          `Resultado de un trabajo sostenido,`,
          `consistente y bien ejecutado.`,
          ``,
          `<b>¡Felicitaciones ${operativo}, mes histórico! 🏅</b>`,
          ``,
          `— Gerencia CTB`
        ].join('\n')

      } else if (esPrimero) {
        // ── Primero en llegar a meta en la empresa ──
        motivMsg = [
          `⚡🏆 <b>¡PRIMERO EN META — CTB!</b>`,
          ``,
          `<b>${operativo}</b> (${ciudad || ''}) es el primero`,
          `en cerrar su meta de ${mesNombre}.`,
          ``,
          `<code>${progressBar(100)}</code> <b>100%</b> ✅`,
          `💰 ${formatMoney(aporteTotal)} · 🗓 Día ${diaDelMes} del mes`,
          ``,
          `Enfoque y dedicación día a día.`,
          `Así se construye un gran mes. 👑`,
          ``,
          `<b>¡Felicitaciones ${operativo}, bien merecido!</b>`,
          ``,
          `🎁 <i>Consulta tu incentivo con Admin por llegar primero a la meta a nivel nacional.</i>`,
          ``,
          `— Gerencia CTB`
        ].join('\n')

      } else {
        // ── Meta cumplida (100%–149%) ──
        motivMsg = [
          `🏆 <b>¡META CUMPLIDA — ${(ciudad || '').toUpperCase()}!</b>`,
          ``,
          `<b>${operativo}</b> cerró su meta de ${mesNombre}.`,
          ``,
          `<code>${progressBar(100)}</code> <b>100%</b> ✅`,
          `💰 ${formatMoney(aporteTotal)} alcanzados`,
          ``,
          `Cada visita, cada seguimiento,`,
          `cada cierre cuenta. Y hoy se nota.`,
          ``,
          `<b>¡Felicitaciones ${operativo}! 🔥</b>`,
          ``,
          `— Gerencia CTB`
        ].join('\n')
      }

      if (esPrimero) {
        await notifyGlobal(motivMsg)
      } else {
        await notifyAll(ciudad, motivMsg)
      }
    }

    return Response.json({ ok: true, telegram_debug: tgRes })
  } catch (err) {
    console.error('notify/venta error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
