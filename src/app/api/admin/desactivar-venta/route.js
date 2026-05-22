export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

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

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error en desactivar-venta:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
