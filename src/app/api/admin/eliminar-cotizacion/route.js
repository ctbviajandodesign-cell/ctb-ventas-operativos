/**
 * POST /api/admin/eliminar-cotizacion
 * Elimina PERMANENTEMENTE una cotización de la base de datos,
 * incluyendo sus ventas y vouchers asociados.
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

    const { cotizacionId } = await req.json()
    if (!cotizacionId) return Response.json({ ok: false, error: 'Falta cotizacionId' }, { status: 400 })

    // Obtener datos para el log antes de borrar
    const { data: quote } = await supabaseAdmin
      .from('cotizaciones')
      .select('codigo, agencia, destino, valor_total')
      .eq('id', cotizacionId)
      .single()

    // 1. Obtener ventas asociadas
    const { data: ventas } = await supabaseAdmin
      .from('ventas')
      .select('id')
      .eq('cotizacion_id', cotizacionId)

    // 2. Borrar vouchers de esas ventas
    if (ventas && ventas.length > 0) {
      for (const v of ventas) {
        await supabaseAdmin.from('vouchers').delete().eq('venta_id', v.id)
      }
      // 3. Borrar las ventas
      await supabaseAdmin.from('ventas').delete().eq('cotizacion_id', cotizacionId)
    }

    // 4. Borrar la cotización
    const { error: errDel } = await supabaseAdmin
      .from('cotizaciones')
      .delete()
      .eq('id', cotizacionId)

    if (errDel) throw errDel

    // 5. Log de auditoría
    await supabaseAdmin.from('logs_actividad').insert([{
      usuario_id: user.id,
      usuario_nombre: profile?.nombre || 'Desconocido',
      usuario_email: user.email || profile?.email || '',
      accion: 'ELIMINAR_PERMANENTE_cotizacion',
      detalles: `⚠️ ELIMINACIÓN PERMANENTE: Cotización #${quote?.codigo || cotizacionId} | Agencia: ${quote?.agencia || 'N/A'} | Destino: ${quote?.destino || 'N/A'} | Total: $${quote?.valor_total || 0} — ${ventas?.length || 0} venta(s) y voucher(s) también eliminados.`
    }])

    return Response.json({ ok: true, ventasEliminadas: ventas?.length || 0 })
  } catch (err) {
    console.error('Error en eliminar-cotizacion:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
