export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { ventaId, cotizacionId, motivo } = await req.json()
    if (!ventaId) return Response.json({ ok: false, error: 'Falta ventaId' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // 1. Anular la Venta
    const { error: errVenta } = await supabaseAdmin.from('ventas').update({ estado: 'anulada' }).eq('id', ventaId)
    if (errVenta) throw errVenta

    // 2. Inactivar el Voucher
    await supabaseAdmin.from('vouchers').update({ estado: 'inactivo' }).eq('venta_id', ventaId)

    // 3. Anular la Cotización
    if (cotizacionId) {
      const { error: errCot } = await supabaseAdmin.from('cotizaciones').update({ 
        estado: 'anulada',
        motivo_perdida: motivo || 'Anulada por sistema'
      }).eq('id', cotizacionId)
      if (errCot) throw errCot
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error en anular-venta:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
