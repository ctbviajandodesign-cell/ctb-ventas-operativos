export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { notifyCity } from '@/lib/telegram'

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
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Obtener todos los vouchers activos que tienen recordatorio
    const { data: vouchers, error } = await supabase
      .from('vouchers')
      .select('*, profiles!inner(nombre, ciudad)')
      .eq('estado', 'activo')
      .not('recordatorio_dias_antes', 'is', null)

    if (error) throw error

    let notificados = 0

    for (const v of vouchers) {
      if (!v.fecha_viaje_desde || !v.recordatorio_dias_antes) continue

      const fechaViaje = new Date(v.fecha_viaje_desde + 'T00:00:00')
      
      // Calcular fecha del recordatorio
      const fechaRecordatorio = new Date(fechaViaje)
      fechaRecordatorio.setDate(fechaViaje.getDate() - v.recordatorio_dias_antes)
      
      // Comprobar si hoy es exactamente el día del recordatorio
      if (
        today.getFullYear() === fechaRecordatorio.getFullYear() &&
        today.getMonth() === fechaRecordatorio.getMonth() &&
        today.getDate() === fechaRecordatorio.getDate()
      ) {
        const ciudad = (v.profiles?.ciudad || 'otra').toLowerCase()
        const mensaje = [
          `⏰ <b>RECORDATORIO DE VOUCHER</b> ⏰`,
          `<i>Aviso programado para el operativo ${v.profiles?.nombre?.split(' ')[0] || 'N/A'}</i>`,
          ``,
          `📝 <b>Nota:</b> ${v.recordatorio_texto || 'Revisar pendientes de este voucher'}`,
          `🧳 <b>Destino:</b> ${v.destino || 'N/A'}`,
          `🛫 <b>Inicio de Viaje:</b> ${v.fecha_viaje_desde}`,
          `🔖 <b>Voucher:</b> ${v.codigo}`,
          `🏢 <b>Agencia:</b> ${v.agencia || 'Directo'}`
        ].join('\n')

        await notifyCity(ciudad, mensaje)
        notificados++
      }
    }

    return Response.json({ ok: true, notificados })
  } catch (err) {
    console.error('notify/vouchers error:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
