export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { notifyAll, formatMoney, progressBar } from '@/lib/telegram'

export async function POST(req) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // === PROTECCIÓN DE API (MÁXIMA SEGURIDAD) ===
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token)
    if (verifyError || !user) return Response.json({ ok: false, error: 'Sesión inválida' }, { status: 401 })
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('rol, nombre, email').eq('id', user.id).single()
    if (profile?.rol !== 'superadmin') {
      return Response.json({ ok: false, error: 'Permisos insuficientes. Solo el Super Admin puede realizar esta acción.' }, { status: 403 })
    }
    // ============================================

    const { ventaId, cotizacionId } = await req.json()
    if (!ventaId) return Response.json({ ok: false, error: 'Falta ventaId' }, { status: 400 })

    // Fetch details of the sale being deactivated before deleting it
    const { data: venta } = await supabaseAdmin
      .from('ventas')
      .select('*, profiles(nombre, ciudad, meta_mensual, id), cotizaciones(codigo, agencia, destino)')
      .eq('id', ventaId)
      .single()

    // Fetch quote details for audit logging
    const { data: quote } = await supabaseAdmin.from('cotizaciones').select('codigo, agencia, destino, valor_total').eq('id', cotizacionId).single()
    const logDetails = `Venta de la Cotización ${quote?.codigo || cotizacionId} (Agencia: ${quote?.agencia || 'Directo'}, Destino: ${quote?.destino || 'Desconocido'}) fue desactivada y devuelta a cotización en espera.`

    // 1. Eliminar el Voucher asociado a la venta
    const { error: errVoucher } = await supabaseAdmin.from('vouchers').delete().eq('venta_id', ventaId)
    if (errVoucher) throw errVoucher

    // 2. Eliminar la Venta (para quitarla de Proformas)
    const { error: errVenta } = await supabaseAdmin.from('ventas').delete().eq('id', ventaId)
    if (errVenta) throw errVenta

    // 3. Regresar la Cotización al estado 'abierta' (En Espera) y limpiar objeción
    if (cotizacionId) {
      const { error: errCot } = await supabaseAdmin.from('cotizaciones').update({ 
        estado: 'abierta',
        motivo_perdida: null
      }).eq('id', cotizacionId)
      if (errCot) throw errCot
    }

    // Insert log
    await supabaseAdmin.from('logs_actividad').insert([{
      usuario_id: user.id,
      usuario_nombre: profile?.nombre || 'Desconocido',
      usuario_email: user.email || profile?.email || '',
      accion: 'desactivar_venta',
      detalles: logDetails
    }])

    // Send Telegram Notification
    try {
      if (venta) {
        const opId = venta.profiles?.id
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        // Fetch active sales for this month, excluding the one we are about to deactivate
        const { data: activeVentas } = await supabaseAdmin
          .from('ventas')
          .select('comision, utilidad')
          .eq('operativo_id', opId)
          .eq('estado', 'activa')
          .neq('id', ventaId)
          .gte('created_at', startOfMonth.toISOString())

        const newAporteTotal = activeVentas?.reduce((a, v) => a + (Number(v.comision) || 0) + (Number(v.utilidad) || 0), 0) || 0
        const metaAmount = Number(venta.profiles?.meta_mensual || 5000)
        const newPct = metaAmount > 0 ? (newAporteTotal / metaAmount) * 100 : 0

        const cancellationAporte = (Number(venta.comision) || 0) + (Number(venta.utilidad) || 0)
        const cancellationTotal = Number(venta.total) || 0

        const deactivateMsg = [
          `🔄 <b>VENTA REVERTIDA A COTIZACIÓN — ${(venta.profiles?.ciudad || '').toUpperCase()}</b>`,
          ``,
          `👤 <b>Asesor:</b> ${venta.profiles?.nombre}`,
          `✈️ <b>Destino:</b> ${venta.cotizaciones?.destino || 'N/A'}  |  🏢 <b>Agencia:</b> ${venta.cotizaciones?.agencia || 'Directo'}`,
          `📉 <b>Descuento Aporte:</b> -${formatMoney(cancellationAporte)}`,
          `💰 <b>Descuento Total:</b> -${formatMoney(cancellationTotal)}`,
          `ℹ️ La venta ha sido devuelta al estado de Cotización en Espera.`,
          ``,
          `📊 <b>Nueva Meta del mes:</b> ${newPct.toFixed(1)}% (${formatMoney(newAporteTotal)} de ${formatMoney(metaAmount)})`,
          `<code>${progressBar(newPct)}</code>`,
        ].join('\n')

        await notifyAll(venta.profiles?.ciudad, deactivateMsg)
      }
    } catch (tgErr) {
      console.error('Error sending Telegram notification on deactivation:', tgErr)
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error en desactivar-venta:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
