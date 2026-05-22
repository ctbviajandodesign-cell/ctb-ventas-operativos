export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { cotizacionId, anularVentas } = await req.json()
    if (!cotizacionId) return Response.json({ ok: false, error: 'Falta cotizacionId' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    if (anularVentas) {
      const { data: ventasMatch } = await supabaseAdmin.from('ventas').select('id').eq('cotizacion_id', cotizacionId)
      if (ventasMatch && ventasMatch.length > 0) {
        for (const v of ventasMatch) {
          await supabaseAdmin.from('ventas').update({ estado: 'anulada' }).eq('id', v.id)
          await supabaseAdmin.from('vouchers').update({ estado: 'inactivo' }).eq('venta_id', v.id)
        }
      }
    }

    const { error: errCot } = await supabaseAdmin.from('cotizaciones').update({ 
      estado: 'anulada',
      motivo_perdida: 'Anulada por Administrador'
    }).eq('id', cotizacionId)
    if (errCot) throw errCot

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error en anular-cotizacion:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
