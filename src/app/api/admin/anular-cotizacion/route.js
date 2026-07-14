export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
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

    const { cotizacionId, anularVentas } = await req.json()
    if (!cotizacionId) return Response.json({ ok: false, error: 'Falta cotizacionId' }, { status: 400 })

    // Fetch quote details for audit logging
    const { data: quote } = await supabaseAdmin.from('cotizaciones').select('codigo, agencia, destino, valor_total').eq('id', cotizacionId).single()
    const logDetails = `Cotización ${quote?.codigo || cotizacionId} (Agencia: ${quote?.agencia || 'Directo'}, Destino: ${quote?.destino || 'Desconocido'}, Total: $${quote?.valor_total || 0}) fue anulada y archivada.`

    if (anularVentas) {
      const { data: ventasMatch } = await supabaseAdmin.from('ventas').select('id').eq('cotizacion_id', cotizacionId)
      if (ventasMatch && ventasMatch.length > 0) {
        for (const v of ventasMatch) {
          await supabaseAdmin.from('ventas').update({ estado: 'anulada' }).eq('id', v.id)
          await supabaseAdmin.from('vouchers').update({ estado: 'anulado' }).eq('venta_id', v.id)
        }
      }
    }

    const { error: errCot } = await supabaseAdmin.from('cotizaciones').update({ 
      estado: 'anulada',
      motivo_perdida: 'Anulada por Administrador'
    }).eq('id', cotizacionId)
    if (errCot) throw errCot

    // Insert log
    await supabaseAdmin.from('logs_actividad').insert([{
      usuario_id: user.id,
      usuario_nombre: profile?.nombre || 'Desconocido',
      usuario_email: user.email || profile?.email || '',
      accion: 'anular_cotizacion',
      detalles: logDetails
    }])

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error en anular-cotizacion:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
