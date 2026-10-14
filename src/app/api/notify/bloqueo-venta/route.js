import { NextResponse } from 'next/server'
import { escapeHtml, getChatIds, sendTelegram } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const body = await req.json()
    const {
      bloqueoTitulo,
      bloqueoCodigo,
      destino,
      fechaSalida,
      cuposVendidos,
      pasajerosNombres,
      agencia,
      ciudad,
      operativoNombre,
      comercialNombre,
      cuposRestantes,
      cuposTotales,
      hoteles
    } = body

    const ciudadStr = ciudad || 'Nacional'
    const chatIds = getChatIds(ciudadStr)

    const mensajeHtml = `✈️ <b>¡NUEVA RESERVA DE BLOQUEO!</b>
<b>Bloqueo:</b> ${escapeHtml(bloqueoTitulo)} (${escapeHtml(bloqueoCodigo)})
<b>Destino:</b> ${escapeHtml(destino)}
<b>Fecha Salida:</b> ${escapeHtml(fechaSalida || 'Por definir')}
──────────────────────────
👥 <b>Cupos Vendidos:</b> <b>${escapeHtml(cuposVendidos)} PAX</b>
👤 <b>Pasajeros:</b> ${escapeHtml(pasajerosNombres || 'Por definir')}
🏢 <b>Agencia:</b> ${escapeHtml(agencia || 'Directo')} (${escapeHtml(ciudadStr)})
🏨 <b>Hoteles:</b> ${escapeHtml(hoteles || 'Estándar')}
🧑‍💼 <b>Operativo:</b> ${escapeHtml(operativoNombre || 'Asignado')}
💼 <b>Comercial:</b> ${escapeHtml(comercialNombre || 'N/A')}
──────────────────────────
🎯 <b>Disponibilidad:</b> <b>Quedan ${escapeHtml(cuposRestantes)} cupos</b> de ${escapeHtml(cuposTotales)} totales`

    await Promise.all(chatIds.map(id => sendTelegram(id, mensajeHtml)))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error sending Telegram bloqueo notification:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
