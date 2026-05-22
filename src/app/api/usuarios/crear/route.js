import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Evitar pre-rendering estático de esta ruta en el build
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    // Instanciamos el cliente DENTRO del handler para que no se ejecute en build time
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

    const { email, password, nombre, meta_mensual, rol, ciudad, celular } = await request.json()

    // 1. Verificar si ya existe en la tabla de perfiles (público)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'El correo electrónico ya está registrado.' }, { status: 400 })
    }

    // 2. Verificar si existe un usuario huérfano en Auth (creado en Auth pero sin perfil)
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (!listError && listData?.users) {
      const orphanedUser = listData.users.find(u => u.email === email)
      if (orphanedUser) {
        // Eliminar el usuario huérfano para poder recrearlo limpiamente con los datos actuales
        await supabaseAdmin.auth.admin.deleteUser(orphanedUser.id)
      }
    }

    // 3. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) throw authError

    const userId = authData.user.id

    // 4. Crear el perfil en la tabla 'profiles'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        { 
          id: userId, 
          email, 
          nombre, 
          meta_mensual: parseFloat(meta_mensual) || 0, 
          rol: rol || 'operativo',
          ciudad: ciudad || null,
          celular: celular || null
        }
      ])

    if (profileError) {
      // Revertir creación en Auth para mantener consistencia
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw profileError
    }

    // Insert activity log
    await supabaseAdmin.from('logs_actividad').insert([{
      usuario_id: user.id,
      usuario_nombre: adminProfile?.nombre || 'Desconocido',
      usuario_email: user.email || adminProfile?.email || '',
      accion: 'crear_usuario',
      detalles: `Se creó al usuario/operativo ${nombre} (${email}) con rol ${rol || 'operativo'} y meta mensual de $${meta_mensual || 0}.`
    }])

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
