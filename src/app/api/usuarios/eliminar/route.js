import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
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
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token)
    if (verifyError || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    
    // Verificar que quien hace la petición sea superadmin
    const { data: adminProfile } = await supabaseAdmin.from('profiles').select('rol, nombre, email').eq('id', user.id).single()
    if (adminProfile?.rol !== 'superadmin') return NextResponse.json({ error: 'Permisos insuficientes. Solo el Super Admin puede realizar esta acción.' }, { status: 403 })
    // ============================================

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 })
    }

    // Obtener datos del usuario a eliminar para el registro de auditoría
    const { data: targetUser } = await supabaseAdmin.from('profiles').select('nombre, email').eq('id', id).single()

    // 1. Eliminar de la tabla 'profiles'
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id)

    if (profileErr) throw profileErr

    // 2. Eliminar de Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (authErr) throw authErr

    // Insert activity log
    await supabaseAdmin.from('logs_actividad').insert([{
      usuario_id: user.id,
      usuario_nombre: adminProfile?.nombre || 'Desconocido',
      usuario_email: user.email || adminProfile?.email || '',
      accion: 'eliminar_usuario',
      detalles: `Se eliminó al usuario/operativo ${targetUser?.nombre || 'Desconocido'} (${targetUser?.email || 'N/A'}).`
    }])

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
