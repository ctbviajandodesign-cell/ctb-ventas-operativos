/**
 * POST /api/admin/eliminar-venta
 * Elimina PERMANENTEMENTE una venta/proforma de la base de datos,
 * incluyendo su voucher. Devuelve la cotización a estado 'abierta'.
 * Solo superadmin. Queda log de auditoría.
 */
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // === PROTECCIÓN: solo superadmin ===
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token)
    if (verifyError || !user) return Response.json({ ok: false, error: 'Sesión inválida' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('rol, nombre, email')
      .eq('id', user.id)
      .single()

    if (profile?.rol !== 'superadmin') {
      return Response.json({ ok: false, error: 'Solo el Super Admin puede eliminar registros permanentemente.' }, { status: 403 })
    }
    // =====================================

    const { ventaId, cotizacionId } = await req.json()
    if (!ventaId) return Response.json({ ok: false, error: 'Falta ventaId' }, { status: 400 })

    // Obtener datos para el log
    const { data: venta } = await supabaseAdmin
      .from('ventas')
      .select('total, comision, utilidad, cotizacion_id')
      .eq('id', ventaId)
      .single()

    const targetCotId = cotizacionId || venta?.cotizacion_id

    // 1. Borrar vouchers
    await supabaseAdmin.from('vouchers').delete().eq('venta_id', ventaId)

    // 2. Borrar la venta
    const { error: errDel } = await supabaseAdmin
      .from('ventas')
      .delete()
      .eq('id', ventaId)

    if (errDel) throw errDel

    // 3. Si hay cotización, devolverla a estado 'abierta'
    if (targetCotId) {
      await supabaseAdmin
        .from('cotizaciones')
        .update({ estado: 'abierta', motivo_perdida: null })
        .eq('id', targetCotId)
    }

    // 4. Log de auditoría
    await supabaseAdmin.from('logs_actividad').insert([{
      usuario_id: user.id,
      usuario_nombre: profile?.nombre || 'Desconocido',
      usuario_email: user.email || profile?.email || '',
      accion: 'ELIMINAR_PERMANENTE_venta',
      detalles: `⚠️ ELIMINACIÓN PERMANENTE: Venta ID ${ventaId} | Total: $${venta?.total || 0} | Utilidad de CTB: $${(Number(venta?.comision || 0) + Number(venta?.utilidad || 0)).toFixed(2)} — Voucher eliminado. Cotización devuelta a estado abierta.`
    }])

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error en eliminar-venta:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
