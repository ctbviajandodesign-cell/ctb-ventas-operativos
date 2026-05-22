export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { ventaId, cotizacionId } = await req.json()
    if (!ventaId) return Response.json({ ok: false, error: 'Falta ventaId' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

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

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error en desactivar-venta:', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
