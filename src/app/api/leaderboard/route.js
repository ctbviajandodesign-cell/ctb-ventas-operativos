import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    )

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'mes'

    const startDate = new Date()
    if (period === 'mes') {
      startDate.setDate(1)
    } else {
      startDate.setMonth(0, 1)
    }
    startDate.setHours(0, 0, 0, 0)

    // Traer todos los operativos
    const { data: allOps, error: opsErr } = await supabaseAdmin
      .from('profiles')
      .select('id, nombre, meta_mensual, ciudad')
      .eq('rol', 'operativo')
    
    if (opsErr) throw opsErr

    // Traer ventas del período de todos
    const { data: allVentasPeriod, error: ventErr } = await supabaseAdmin
      .from('ventas')
      .select('total, comision, utilidad, operativo_id')
      .eq('estado', 'activa')
      .gte('created_at', startDate.toISOString())

    if (ventErr) throw ventErr

    const board = allOps?.map(op => {
      const opVentas = (allVentasPeriod || []).filter(v => v.operativo_id === op.id)
      const totalOp = opVentas.reduce((acc, v) => acc + (Number(v.comision) || 0) + (Number(v.utilidad) || 0), 0)
      const meta = (Number(op.meta_mensual) || 5000) * (period === 'año' ? 12 : 1)
      return {
        id: op.id,
        nombre: op.nombre?.split(' ')[0] || 'N/A',
        nombreCompleto: op.nombre || 'N/A',
        total: totalOp,
        meta,
        cumplimiento: meta > 0 ? (totalOp / meta) * 100 : 0,
        avatar: op.nombre?.charAt(0)?.toUpperCase() || '?',
        ciudad: op.ciudad
      }
    }).sort((a, b) => b.cumplimiento - a.cumplimiento) || []

    return NextResponse.json({ success: true, leaderboard: board })

  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
