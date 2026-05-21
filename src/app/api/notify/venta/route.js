/**
 * POST /api/notify/venta
 * Se llama cuando se registra una venta nueva.
 * Body: { operativo, ciudad, destino, agencia, valorTotal, metaPct }
 */
export const dynamic = 'force-dynamic'
import { notifyAll, formatMoney, progressBar } from '@/lib/telegram'

export async function POST(req) {
  try {
    const { operativo, ciudad, destino, agencia, valorTotal, metaPct } = await req.json()

    const pct = Number(metaPct || 0)
    const bar = progressBar(pct)
    const emoji = pct >= 100 ? '🏆' : pct >= 75 ? '🔥' : pct >= 50 ? '📈' : '⚡'

    const text = [
      `${emoji} <b>¡NUEVA VENTA CTB — ${(ciudad || '').toUpperCase()}!</b>`,
      ``,
      `👤 <b>Asesor:</b> ${operativo}`,
      `✈️ <b>Destino:</b> ${destino || 'N/A'}  |  🏢 <b>Agencia:</b> ${agencia || 'Directo'}`,
      `💰 <b>Valor:</b> ${formatMoney(valorTotal)}`,
      ``,
      `📊 <b>Meta del mes:</b> ${pct.toFixed(1)}%`,
      `<code>${bar}</code>`,
    ].join('\n')

    await notifyAll(ciudad, text)

    return Response.json({ ok: true })
  } catch (err) {
    console.error('notify/venta error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
